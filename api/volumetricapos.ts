import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { loadProto } from './volumetricaProto';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
  });
}

const db = getFirestore();

type VolumetricaEnvironment = 0 | 1;

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function isAdminUid(decodedToken: any, uid: string): boolean {
  const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
    .split(',')
    .map((v: string) => v.trim())
    .filter(Boolean);
  return decodedToken?.admin === true || ADMIN_UIDS.includes(uid);
}

async function assertTradeCopierSubscription(decodedToken: any, uid: string) {
  if (isAdminUid(decodedToken, uid)) return;

  const subscriptionDoc = await db.collection('subscriptions').doc(uid).get();
  const subscription = subscriptionDoc.data() as any;

  if (
    !subscription?.hasSubscription ||
    subscription?.subscriptionStatus !== 'complete' ||
    subscription?.paymentStatus !== 'paid'
  ) {
    const err: any = new Error('Active subscription required to access this feature');
    err.httpStatus = 403;
    err.payload = { requiresSubscription: true, source: 'subscription' };
    throw err;
  }

  const hasTradecopierAccess = ['pro', 'proplus'].includes(String(subscription?.subscriptionType || '').toLowerCase());
  if (!hasTradecopierAccess) {
    const err: any = new Error('Trade Copier subscription required. Please upgrade your plan.');
    err.httpStatus = 403;
    err.payload = { requiresSubscription: true, currentPlan: subscription?.subscriptionType, source: 'subscription' };
    throw err;
  }
}

function credsDocIdFor(userId: string) {
  return `${userId}_volumetrica_creds`;
}

function tokenDocIdFor(userId: string) {
  return `${userId}_volumetrica_token`;
}

async function getVolumetricaCreds(userId: string): Promise<{ login: string; password: string; environment: VolumetricaEnvironment } | null> {
  const snap = await db.collection('volumetricaCreds').doc(credsDocIdFor(userId)).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  const login = data?.login ? String(data.login) : '';
  const password = data?.password ? String(data.password) : '';
  const environment = (data?.environment === 0 ? 0 : 1) as VolumetricaEnvironment;
  if (!login || !password) return null;
  return { login, password, environment };
}

async function upsertVolumetricaCreds(userId: string, login: string, password: string, environment: VolumetricaEnvironment) {
  await db.collection('volumetricaCreds').doc(credsDocIdFor(userId)).set(
    {
      userId,
      provider: 'Volumetrica',
      login,
      password,
      environment,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

const AUTH_URL = 'https://authdxfeed.volumetricatrading.com/api/v2/auth/token';

async function authenticateVolumetrica(userId: string, input?: { login?: string; password?: string; environment?: VolumetricaEnvironment }) {
  const platformKey = process.env.VOLUMETRICA_PLATFORM_KEY;
  if (!platformKey) throw new Error('VOLUMETRICA_PLATFORM_KEY is not set');

  let login = input?.login;
  let password = input?.password;
  let environment: VolumetricaEnvironment = (input?.environment === 1 ? 1 : 0) as VolumetricaEnvironment;

  if (!login || !password) {
    const stored = await getVolumetricaCreds(userId);
    if (!stored) throw new Error('Missing Volumetrica credentials');
    login = stored.login;
    password = stored.password;
    environment = stored.environment;
  }

  await upsertVolumetricaCreds(userId, String(login), String(password), environment);

  const body = {
    login: String(login),
    password: String(password),
    environment,
    withDetails: true,
    version: 3,
    connectOnlyTrading: true,
  };

  const resp = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      PltfKey: platformKey,
    },
    body: JSON.stringify(body),
  });

  const rawText = await resp.text().catch(() => '');
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    throw new Error(data?.message || data?.reason || data?.error || `Volumetrica auth failed (${resp.status})`);
  }

  const ok = data?.success === true;
  const payload = data?.data || null;
  if (!ok || !payload) {
    throw new Error(data?.message || data?.reason || 'Volumetrica auth returned invalid response');
  }

  const tradingWssEndpoint = payload?.tradingWssEndpoint ? String(payload.tradingWssEndpoint) : null;
  const tradingWssToken = payload?.tradingWssToken ? String(payload.tradingWssToken) : null;
  const tradingRestTokenExpiration = typeof payload?.tradingRestTokenExpiration === 'number' ? payload.tradingRestTokenExpiration : null;

  await db.collection('volumetricaTokens').doc(tokenDocIdFor(userId)).set(
    {
      userId,
      provider: 'Volumetrica',
      tradingWssEndpoint,
      tradingWssToken,
      tradingRestTokenExpiration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { tradingWssEndpoint, tradingWssToken, tradingRestTokenExpiration };
}

async function getStoredToken(userId: string): Promise<{
  tradingWssEndpoint?: string | null;
  tradingWssToken?: string | null;
  tradingRestTokenExpiration?: number | null;
} | null> {
  const snap = await db.collection('volumetricaTokens').doc(tokenDocIdFor(userId)).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  return {
    tradingWssEndpoint: data?.tradingWssEndpoint ?? null,
    tradingWssToken: data?.tradingWssToken ?? null,
    tradingRestTokenExpiration: typeof data?.tradingRestTokenExpiration === 'number' ? data.tradingRestTokenExpiration : null,
  };
}

async function ensureFreshVolumetricaTradingToken(userId: string): Promise<{ tradingWssEndpoint: string; tradingWssToken: string }> {
  const now = Date.now();
  const bufferMs = 2 * 60 * 1000;

  let tok = await getStoredToken(userId);
  const exp = tok?.tradingRestTokenExpiration ?? null;
  const needsRefresh = !tok || (typeof exp === 'number' && Number.isFinite(exp) && (now + bufferMs) >= exp);

  if (needsRefresh) {
    await authenticateVolumetrica(userId, { environment: 0 });
    tok = await getStoredToken(userId);
  }

  if (!tok?.tradingWssEndpoint || !tok?.tradingWssToken) {
    await authenticateVolumetrica(userId, { environment: 0 });
    tok = await getStoredToken(userId);
  }

  if (!tok?.tradingWssEndpoint || !tok?.tradingWssToken) {
    throw new Error('Missing Volumetrica trading websocket token/endpoint');
  }

  return { tradingWssEndpoint: String(tok.tradingWssEndpoint), tradingWssToken: String(tok.tradingWssToken) };
}

async function withVolumetricaWs<T>(opts: {
  userId: string;
  work: (ctx: {
    sendClientRequest: (msg: any) => void;
    waitForServer: (predicate: (msg: any) => boolean, timeoutMs: number) => Promise<any>;
  }) => Promise<T>;
}): Promise<T> {
  const { ClientRequestMsg, ServerResponseMsg } = await loadProto();
  const { tradingWssEndpoint, tradingWssToken } = await ensureFreshVolumetricaTradingToken(opts.userId);

  const WebSocketImpl: any = (globalThis as any).WebSocket;
  if (typeof WebSocketImpl !== 'function') {
    throw new Error('WebSocket is not available in this runtime');
  }

  const ws: any = new WebSocketImpl(tradingWssEndpoint);
  ws.binaryType = 'arraybuffer';

  const incoming: any[] = [];
  let closed = false;
  let openResolve: (() => void) | null = null;
  let openReject: ((e: any) => void) | null = null;
  const opened = new Promise<void>((resolve, reject) => {
    openResolve = resolve;
    openReject = reject;
  });

  ws.onopen = () => openResolve?.();
  ws.onerror = (e: any) => openReject?.(e);
  ws.onclose = () => {
    closed = true;
  };

  ws.onmessage = (event: any) => {
    try {
      const data = event?.data;
      const buf: Uint8Array =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : typeof Buffer !== 'undefined' && Buffer.isBuffer(data)
              ? new Uint8Array(data)
              : new Uint8Array();
      if (!buf.length) return;
      const decoded = ServerResponseMsg.decode(buf);
      const obj = ServerResponseMsg.toObject(decoded, {
        longs: Number,
        enums: Number,
        defaults: true,
      });
      incoming.push(obj);
    } catch {
      // ignore
    }
  };

  const sendClientRequest = (msg: any) => {
    if (closed) throw new Error('WebSocket already closed');
    const err = ClientRequestMsg.verify(msg);
    if (err) throw new Error(`Invalid ClientRequestMsg: ${err}`);
    const encoded = ClientRequestMsg.encode(msg).finish();
    ws.send(encoded);
  };

  const waitForServer = async (predicate: (msg: any) => boolean, timeoutMs: number) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      for (let i = 0; i < incoming.length; i++) {
        const msg = incoming[i];
        if (predicate(msg)) {
          incoming.splice(i, 1);
          return msg;
        }
      }
      await sleep(25);
    }
    throw new Error('Timed out waiting for Volumetrica server response');
  };

  await opened;

  // Login
  sendClientRequest({
    LoginReq: { Token: tradingWssToken },
  });

  const loginResp = await waitForServer(m => !!m?.LoginMsg, 15_000);
  if (!loginResp?.LoginMsg?.Success) {
    throw new Error(String(loginResp?.LoginMsg?.Reason || 'Volumetrica login failed'));
  }

  try {
    return await opts.work({ sendClientRequest, waitForServer });
  } finally {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }

    const firebaseToken = authHeader.substring(7);
    let decodedToken: any;
    let authenticatedUserId: string;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
      authenticatedUserId = decodedToken.uid;
    } catch {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    const { userId, accountId } = req.body || {};
    if (!userId || userId !== authenticatedUserId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }

    if (accountId == null) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing accountId' });
    }

    await assertTradeCopierSubscription(decodedToken, authenticatedUserId);

    const accountNumber = Number(accountId);
    if (!Number.isFinite(accountNumber)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Invalid accountId (expected numeric account number)' });
    }

    const requestId = Date.now();

    const positions = await withVolumetricaWs({
      userId,
      work: async ({ sendClientRequest, waitForServer }) => {
        sendClientRequest({
          InfoReq: {
            Mode: 3, // Positions
            RequestId: requestId,
          },
        });

        const resp = await waitForServer(m => !!m?.InfoMsg && Array.isArray(m?.InfoMsg?.PositionList), 20_000);
        const all = resp?.InfoMsg?.PositionList || [];
        const scoped = all.filter((p: any) => Number(p?.AccNumber) === accountNumber);

        return scoped.map((p: any) => {
          const openQty = typeof p?.OpenQuantity === 'number' ? p.OpenQuantity : Number(p?.OpenQuantity);
          const openPrice = typeof p?.OpenPrice === 'number' ? p.OpenPrice : Number(p?.OpenPrice);
          return {
            accountId: accountNumber,
            contractId: Number(p?.ContractId),
            netPos: Number.isFinite(openQty) ? openQty : 0,
            netPrice: Number.isFinite(openPrice) ? openPrice : 0,
            feedSymbol: p?.FeedSymbol ? String(p.FeedSymbol) : undefined,
            dailyPl: p?.DailyPl ?? undefined,
            dailyCommissions: p?.DailyCommissions ?? undefined,
          };
        });
      },
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(positions);
  } catch (err: any) {
    console.error('[volumetricapos] error:', err?.message || err);
    const status = typeof err?.httpStatus === 'number' ? err.httpStatus : 500;
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).json({
      error: err?.message || 'Server error',
      ...(err?.payload ? err.payload : {}),
    });
  }
}
