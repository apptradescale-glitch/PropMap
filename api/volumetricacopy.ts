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

function safeFirestoreId(value: string) {
  return String(value).replace(/\//g, '_');
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

  let credsFromInput = true;
  if (!login || !password) {
    const stored = await getVolumetricaCreds(userId);
    if (!stored) throw new Error('Missing Volumetrica credentials');
    login = stored.login;
    password = stored.password;
    environment = stored.environment;
    credsFromInput = false;
  }

  // Only await creds write when new creds are provided; skip when using stored creds
  if (credsFromInput) {
    await upsertVolumetricaCreds(userId, String(login), String(password), environment);
  }

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
  const tradingRestReportHost = payload?.tradingRestReportHost ? String(payload.tradingRestReportHost) : null;
  const tradingRestReportToken = payload?.tradingRestReportToken ? String(payload.tradingRestReportToken) : null;
  const tradingRestTokenExpiration = typeof payload?.tradingRestTokenExpiration === 'number' ? payload.tradingRestTokenExpiration : null;

  if (!tradingWssEndpoint || !tradingWssToken) {
    throw new Error('Volumetrica auth response missing tradingWssEndpoint/tradingWssToken');
  }

  // Fire-and-forget Firestore write — don't block on it since we return tokens directly
  db.collection('volumetricaTokens').doc(tokenDocIdFor(userId)).set(
    {
      userId,
      provider: 'Volumetrica',
      tradingWssEndpoint,
      tradingWssToken,
      tradingRestReportHost,
      tradingRestReportToken,
      tradingRestTokenExpiration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  ).catch(() => {});

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

// ── In-memory warm token cache (per-user) ──────────────────────────────────
// Volumetrica WSS tokens are single-use.  Instead of authenticating on every
// order (~2 s), we keep one pre-fetched token ready and replace it immediately
// after it is consumed.
const warmTokenCache = new Map<string, { tradingWssEndpoint: string; tradingWssToken: string; fetchedAt: number }>();
const warmTokenInFlight = new Set<string>(); // prevents duplicate pre-fetches

function startWarmTokenFetch(userId: string) {
  if (warmTokenInFlight.has(userId)) return;
  warmTokenInFlight.add(userId);
  authenticateVolumetrica(userId, { environment: 0 })
    .then(result => {
      if (result.tradingWssEndpoint && result.tradingWssToken) {
        warmTokenCache.set(userId, {
          tradingWssEndpoint: result.tradingWssEndpoint,
          tradingWssToken: result.tradingWssToken,
          fetchedAt: Date.now(),
        });
      }
    })
    .catch(() => { /* best-effort */ })
    .finally(() => { warmTokenInFlight.delete(userId); });
}

const WARM_TOKEN_MAX_AGE_MS = 4 * 60 * 1000; // 4 minutes — discard if too old

async function ensureFreshVolumetricaTradingToken(userId: string): Promise<{ tradingWssEndpoint: string; tradingWssToken: string }> {
  // 1. Try the warm cache first
  const cached = warmTokenCache.get(userId);
  if (cached && (Date.now() - cached.fetchedAt) < WARM_TOKEN_MAX_AGE_MS) {
    warmTokenCache.delete(userId);
    // Fire-and-forget: pre-warm the next token immediately
    startWarmTokenFetch(userId);
    return { tradingWssEndpoint: cached.tradingWssEndpoint, tradingWssToken: cached.tradingWssToken };
  }

  // 2. No warm token — fall back to synchronous auth
  warmTokenCache.delete(userId);
  const result = await authenticateVolumetrica(userId, { environment: 0 });
  if (!result.tradingWssEndpoint || !result.tradingWssToken) {
    throw new Error('Missing Volumetrica trading websocket token/endpoint');
  }
  // Pre-warm the next token
  startWarmTokenFetch(userId);
  return { tradingWssEndpoint: result.tradingWssEndpoint, tradingWssToken: result.tradingWssToken };
}

type WsClient = {
  send: (data: Uint8Array) => void;
  close: () => void;
};

async function withVolumetricaWs<T>(opts: {
  userId: string;
  accountNumber: number;
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

  ws.onopen = () => { openResolve?.(); };
  ws.onerror = (e: any) => {
    openReject?.(e);
  };
  ws.onclose = (ev: any) => {
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
    }
  };

  const sendClientRequest = (msg: any) => {
    if (closed) throw new Error('WebSocket already closed');
    const err = ClientRequestMsg.verify(msg);
    if (err) {
      throw new Error(`Invalid ClientRequestMsg: ${err}`);
    }
    const created = ClientRequestMsg.create(msg);
    const encoded = ClientRequestMsg.encode(created).finish();
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
      await sleep(10);
    }
    throw new Error('Timed out waiting for Volumetrica server response');
  };

  await opened;

  // Login
  sendClientRequest({
    LoginReq: { Token: tradingWssToken },
  });

  const loginResp = await waitForServer(m => !!m?.LoginMsg, 8_000);
  if (!loginResp?.LoginMsg?.Success) {
    throw new Error(String(loginResp?.LoginMsg?.Reason || 'Volumetrica login failed'));
  }

  // Subscribe accounts (required before orders)
  sendClientRequest({ InfoReq: { Mode: 1 } });
  await waitForServer(m => !!m?.InfoMsg, 5_000).catch(() => null);
  // Send OrdAndPos but don't wait — let it arrive in background
  sendClientRequest({ InfoReq: { Mode: 2 } });
  // Brief pause to let server process
  await sleep(100);

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

function parseRootMonthYear(input: string): { root: string; month: string; yy: string } | null {
  const s = String(input || '').trim().toUpperCase();
  if (!s) return null;
  // Accept formats like MNQH6, MNQH26, /MNQH26:XCME, MNQH2026
  const cleaned = s.replace(/^\/+/, '').split(/[:.]/)[0];
  const m = cleaned.match(/^([A-Z0-9]+)([FGHJKMNQUVXZ])([0-9]{1,4})$/);
  if (!m) return null;
  const root = m[1];
  const month = m[2];
  let yearDigits = m[3];
  if (yearDigits.length === 1) {
    // Assume current decade.
    const now = new Date();
    const decade = Math.floor(now.getFullYear() / 10) * 10;
    const y = decade + Number(yearDigits);
    yearDigits = String(y).slice(-2);
  } else if (yearDigits.length === 4) {
    yearDigits = yearDigits.slice(-2);
  }
  if (yearDigits.length !== 2) return null;
  return { root, month, yy: yearDigits };
}

function buildSymbolLookupFilter(symbol: string): string {
  const parsed = parseRootMonthYear(symbol);
  if (parsed) return parsed.root;
  const s = String(symbol || '').trim();
  if (!s) return '';
  // If it already looks like /ESZ25:XCME, search by the token without / and exchange.
  return s.replace(/^\/+/, '').split(/[:.]/)[0];
}

function pickContractFromLookup(symbol: string, symbols: any[]): { contractId: number; feedSymbol?: string } | null {
  if (!Array.isArray(symbols) || !symbols.length) return null;
  const parsed = parseRootMonthYear(symbol);
  const target = parsed ? `${parsed.root}${parsed.month}${parsed.yy}` : null;

  const normalize = (v: any) => String(v || '').toUpperCase().replace(/^\/+/, '');

  if (target) {
    const exact = symbols.find((x: any) => normalize(x?.Symbol).includes(target) || normalize(x?.FeedSymbol).includes(target));
    if (exact?.ContractId != null) {
      return { contractId: Number(exact.ContractId), feedSymbol: exact?.FeedSymbol || exact?.Symbol };
    }
  }

  const first = symbols[0];
  if (first?.ContractId == null) return null;
  return { contractId: Number(first.ContractId), feedSymbol: first?.FeedSymbol || first?.Symbol };
}

function mapOrderType(orderType: string): number {
  switch (String(orderType || '').toLowerCase()) {
    case 'market':
      return 0;
    case 'limit':
      return 1;
    case 'stop':
      return 2;
    case 'stoplimit':
      return 3;
    default:
      return 0;
  }
}

export const config = { maxDuration: 30 };

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

    const { action, userId, accountId } = req.body || {};
    if (!userId || userId !== authenticatedUserId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }

    if (!accountId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing accountId' });
    }

    await assertTradeCopierSubscription(decodedToken, authenticatedUserId);

    const accountNumber = Number(accountId);
    if (!Number.isFinite(accountNumber)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Invalid accountId (expected numeric account number)' });
    }


    if (action === 'getContract' || action === 'findContract') {
      const symbol = String(req.body?.symbol || '').trim();
      if (!symbol) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing symbol' });
      }

      const filter = buildSymbolLookupFilter(symbol);
      if (!filter) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Unable to derive symbol lookup filter' });
      }

      const result = await withVolumetricaWs({
        userId,
        accountNumber,
        work: async ({ sendClientRequest, waitForServer }) => {
          sendClientRequest({
            SymbolLookup: {
              RequestId: Date.now(),
              Filter: filter,
            },
          });

          const resp = await waitForServer(m => !!m?.SymbolLookup && Array.isArray(m?.SymbolLookup?.Symbols), 15_000);
          const symbols = resp?.SymbolLookup?.Symbols || [];
          const picked = pickContractFromLookup(symbol, symbols);
          if (!picked) throw new Error('Contract not found');
          return picked;
        },
      });

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        id: result.contractId,
        ContractId: result.contractId,
        feedSymbol: result.feedSymbol,
        source: 'symbolLookup',
      });
    }

    if (action === 'placeOrder') {
      const orderPayload = req.body?.orderPayload;
      if (!orderPayload) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing orderPayload' });
      }

      const contractId = Number(orderPayload.contractId);
      if (!Number.isFinite(contractId)) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Invalid orderPayload.contractId (expected number)' });
      }

      const actionStr = String(orderPayload.action || '').toLowerCase();
      const orderQty = Number(orderPayload.orderQty ?? 0);
      if (!Number.isFinite(orderQty) || orderQty === 0) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Invalid orderPayload.orderQty' });
      }

      const signedQty = actionStr === 'sell' ? -Math.abs(orderQty) : Math.abs(orderQty);
      const orderType = String(orderPayload.orderType || 'Market');
      const mappedOrderType = mapOrderType(orderType);

      const seqClientId = Date.now() % 1_000_000_000; // must fit int32

      const price = orderPayload.price != null ? Number(orderPayload.price) : undefined;
      const stopPrice = orderPayload.stopPrice != null ? Number(orderPayload.stopPrice) : undefined;

      const insert: any = {
        ContractId: contractId,
        SeqClientId: seqClientId,
        Quantity: signedQty,
        OrderType: mappedOrderType,
        AccNumber: accountNumber,
        // Source omitted — C# example does not set it (defaults to 0 = Unknown)
      };

      // Limit: Price
      if (orderType === 'Limit') {
        if (!Number.isFinite(price)) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(400).json({ error: 'Limit order requires price' });
        }
        insert.Price = price;
      }

      // Stop: Price is trigger price
      if (orderType === 'Stop') {
        if (!Number.isFinite(stopPrice)) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(400).json({ error: 'Stop order requires stopPrice' });
        }
        insert.Price = stopPrice;
      }

      // StopLimit: Price is trigger, LimitPrice is execution limit
      if (orderType === 'StopLimit') {
        if (!Number.isFinite(stopPrice) || !Number.isFinite(price)) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(400).json({ error: 'StopLimit order requires stopPrice and price' });
        }
        insert.Price = stopPrice;
        insert.LimitPrice = price;
      }

      const placed = await withVolumetricaWs({
        userId,
        accountNumber,
        work: async ({ sendClientRequest, waitForServer }) => {
          sendClientRequest({
            Order: [{ OrderInsert: insert }],
          });

          // Match on AccNumber + ContractId — OrgClientId may be sign-wrapped
          try {
            const info = await waitForServer(
              m =>
                Array.isArray(m?.OrderInfo) &&
                m.OrderInfo.some((o: any) =>
                  Number(o?.AccNumber) === accountNumber &&
                  Number(o?.ContractId) === contractId &&
                  !o?.IsValidationError
                ),
              3_000
            );

            const match = (info?.OrderInfo || []).find(
              (o: any) =>
                Number(o?.AccNumber) === accountNumber &&
                Number(o?.ContractId) === contractId &&
                !o?.IsValidationError
            );

            if (match?.OrgServerId) {
              return { orderId: Number(match.OrgServerId) };
            }
          } catch {
            // timeout — order was still sent
          }

          return { orderId: seqClientId };
        },
      });

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, orderId: placed.orderId, id: placed.orderId });
    }

    if (action === 'findAndPlaceOrder') {
      const symbol = String(req.body?.symbol || '').trim();
      const orderPayload = req.body?.orderPayload;
      if (!symbol || !orderPayload) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing symbol or orderPayload' });
      }

      const filter = buildSymbolLookupFilter(symbol);
      if (!filter) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Unable to derive symbol lookup filter' });
      }

      const actionStr = String(orderPayload.action || '').toLowerCase();
      const orderQty = Number(orderPayload.orderQty ?? 0);
      if (!Number.isFinite(orderQty) || orderQty === 0) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Invalid orderPayload.orderQty' });
      }

      const signedQty = actionStr === 'sell' ? -Math.abs(orderQty) : Math.abs(orderQty);
      const orderType = String(orderPayload.orderType || 'Market');
      const mappedOrderType = mapOrderType(orderType);
      const seqClientId = Date.now() % 1_000_000_000;
      const price = orderPayload.price != null ? Number(orderPayload.price) : undefined;
      const stopPrice = orderPayload.stopPrice != null ? Number(orderPayload.stopPrice) : undefined;

      const result = await withVolumetricaWs({
        userId,
        accountNumber,
        work: async ({ sendClientRequest, waitForServer }) => {
          // 1. Symbol lookup
          sendClientRequest({ SymbolLookup: { RequestId: Date.now(), Filter: filter } });
          const lookupResp = await waitForServer(m => !!m?.SymbolLookup && Array.isArray(m?.SymbolLookup?.Symbols), 8_000);
          const symbols = lookupResp?.SymbolLookup?.Symbols || [];
          const picked = pickContractFromLookup(symbol, symbols);
          if (!picked) throw new Error('Contract not found');

          // 2. Build and send order
          const insert: any = {
            ContractId: picked.contractId,
            SeqClientId: seqClientId,
            Quantity: signedQty,
            OrderType: mappedOrderType,
            AccNumber: accountNumber,
          };
          if (orderType === 'Limit' && Number.isFinite(price)) insert.Price = price;
          if (orderType === 'Stop' && Number.isFinite(stopPrice)) insert.Price = stopPrice;
          if (orderType === 'StopLimit') {
            if (Number.isFinite(stopPrice)) insert.Price = stopPrice;
            if (Number.isFinite(price)) insert.LimitPrice = price;
          }

          sendClientRequest({ Order: [{ OrderInsert: insert }] });

          // 3. Wait for confirmation
          let orderId = seqClientId;
          try {
            const info = await waitForServer(
              m => Array.isArray(m?.OrderInfo) && m.OrderInfo.some((o: any) =>
                Number(o?.AccNumber) === accountNumber && Number(o?.ContractId) === picked.contractId && !o?.IsValidationError
              ),
              3_000
            );
            const match = (info?.OrderInfo || []).find((o: any) =>
              Number(o?.AccNumber) === accountNumber && Number(o?.ContractId) === picked.contractId && !o?.IsValidationError
            );
            if (match?.OrgServerId) orderId = Number(match.OrgServerId);
          } catch { /* timeout — order was still sent */ }

          return { contractId: picked.contractId, feedSymbol: picked.feedSymbol, orderId };
        },
      });

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        id: result.contractId,
        ContractId: result.contractId,
        feedSymbol: result.feedSymbol,
        orderId: result.orderId,
      });
    }

    if (action === 'cancelOrder') {
      const orderId = Number(req.body?.orderId);
      if (!Number.isFinite(orderId)) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing/invalid orderId' });
      }

      await withVolumetricaWs({
        userId,
        accountNumber,
        work: async ({ sendClientRequest, waitForServer }) => {
          sendClientRequest({
            Order: [
              {
                OrderRemove: {
                  OrgServerId: orderId,
                  AccNumber: accountNumber,
                },
              },
            ],
          });

          await waitForServer(
            m =>
              Array.isArray(m?.OrderInfo) &&
              m.OrderInfo.some((o: any) => Number(o?.AccNumber) === accountNumber && Number(o?.OrgServerId) === orderId),
            2_000
          ).catch(() => null);
        },
      });

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, orderId });
    }

    if (action === 'modifyOrder') {
      const orderId = Number(req.body?.orderId);
      const modifyPayload = req.body?.modifyPayload;
      if (!Number.isFinite(orderId) || !modifyPayload) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing/invalid orderId or modifyPayload' });
      }

      const contractId = modifyPayload.contractId != null ? Number(modifyPayload.contractId) : undefined;
      const newSeqClientId = Date.now() % 1_000_000_000; // must fit int32
      const price = modifyPayload.price != null ? Number(modifyPayload.price) : undefined;
      const stopPrice = modifyPayload.stopPrice != null ? Number(modifyPayload.stopPrice) : undefined;
      const orderQty = modifyPayload.orderQty != null ? Number(modifyPayload.orderQty) : undefined;
      const actionStr = String(modifyPayload.action || '').toLowerCase();

      await withVolumetricaWs({
        userId,
        accountNumber,
        work: async ({ sendClientRequest, waitForServer }) => {
          const modify: any = {
            OrgServerId: orderId,
            NewSeqClientId: newSeqClientId,
            AccNumber: accountNumber,
          };
          if (Number.isFinite(contractId)) modify.ContractId = contractId;

          // Quantity — if action (Buy/Sell) is known, use signed qty; otherwise send as-is
          // Server keeps original direction on modify, so positive qty is usually fine
          if (Number.isFinite(orderQty) && orderQty !== 0) {
            if (actionStr === 'sell') {
              modify.Quantity = -Math.abs(orderQty!);
            } else if (actionStr === 'buy') {
              modify.Quantity = Math.abs(orderQty!);
            } else {
              // No action provided — send positive; server preserves original direction
              modify.Quantity = Math.abs(orderQty!);
            }
          }

          // Match your existing UI payload conventions:
          // - Limit modifies use price
          // - Stop modifies use stopPrice
          // - StopLimit modifies use stopPrice + price
          if (Number.isFinite(stopPrice)) {
            modify.Price = stopPrice;
            if (Number.isFinite(price)) {
              modify.LimitPrice = price;
            }
          } else if (Number.isFinite(price)) {
            modify.Price = price;
          }


          sendClientRequest({
            Order: [
              {
                OrderModify: modify,
              },
            ],
          });

          const resp = await waitForServer(
            m =>
              Array.isArray(m?.OrderInfo) &&
              m.OrderInfo.some((o: any) => Number(o?.AccNumber) === accountNumber && Number(o?.OrgServerId) === orderId),
            3_000
          ).catch(() => null);

        },
      });

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, orderId });
    }

    if (action === 'flattenAllPositions') {
      const requestId = Date.now();

      const result = await withVolumetricaWs({
        userId,
        accountNumber,
        work: async ({ sendClientRequest, waitForServer }) => {
          sendClientRequest({
            CancelFlatReq: {
              RequestId: requestId,
              AccNumber: accountNumber,
              Action: 2, // FLAT_CANCEL
            },
          });

          const resp = await waitForServer(
            m => !!m?.CancelFlatMsg && Number(m?.CancelFlatMsg?.RequestId) === requestId,
            5_000
          ).catch(() => null);
          return resp?.CancelFlatMsg || null;
        },
      });

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        cancelResult: { canceledOrders: [], failedCancellations: [] },
        closeResult: { closedPositions: [], failedClosures: [] },
        raw: result,
      });
    }

    if (action === 'warmToken') {
      // Pre-fetch a WSS token so the next order is instant
      startWarmTokenFetch(userId);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, warmed: true });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Invalid action' });
  } catch (err: any) {
    const status = typeof err?.httpStatus === 'number' ? err.httpStatus : 500;
    console.error('[volumetricacopy] error:', err?.message, {
      status,
      action: req.body?.action,
      accountId: req.body?.accountId,
    });
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).json({
      error: err?.message || 'Server error',
      ...(err?.payload ? err.payload : {}),
    });
  }
}
