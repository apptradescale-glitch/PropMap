import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
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

const db = admin.firestore();

type VolumetricaEnvironment = 0 | 1;

const AUTH_URL = 'https://authdxfeed.volumetricatrading.com/api/v2/auth/token';

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function fetchAccountsViaWss(userId: string): Promise<any[]> {
  const { ClientRequestMsg, ServerResponseMsg } = await loadProto();
  // WSS tokens are single-use — always authenticate fresh
  await authenticateVolumetrica(userId);
  const stored = await getStoredToken(userId);
  const wssEndpoint = stored?.tradingWssEndpoint;
  const wssToken = stored?.tradingWssToken;
  if (!wssEndpoint || !wssToken) {
    throw new Error('Missing Volumetrica WSS endpoint/token');
  }

  const WebSocketImpl: any = (globalThis as any).WebSocket;
  if (typeof WebSocketImpl !== 'function') {
    throw new Error('WebSocket is not available in this runtime');
  }

  const ws: any = new WebSocketImpl(wssEndpoint);
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
  ws.onerror = (e: any) => { openReject?.(e); };
  ws.onclose = () => { closed = true; };
  ws.onmessage = (event: any) => {
    try {
      const data = event?.data;
      const buf: Uint8Array =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array((data as any).buffer, (data as any).byteOffset, (data as any).byteLength)
            : typeof Buffer !== 'undefined' && Buffer.isBuffer(data)
              ? new Uint8Array(data)
              : new Uint8Array();
      if (!buf.length) return;
      const decoded = ServerResponseMsg.decode(buf);
      const obj = ServerResponseMsg.toObject(decoded, { longs: Number, enums: Number, defaults: true });
      incoming.push(obj);
    } catch (decodeErr: any) {
      console.error('decode error:', decodeErr);
    }
  };

  const sendMsg = (msg: any) => {
    if (closed) throw new Error('WebSocket already closed');
    const err = ClientRequestMsg.verify(msg);
    if (err) throw new Error(`Invalid ClientRequestMsg: ${err}`);
    const encoded = ClientRequestMsg.encode(msg).finish();
    ws.send(encoded);
  };

  const waitFor = async (predicate: (msg: any) => boolean, timeoutMs: number) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      for (let i = 0; i < incoming.length; i++) {
        if (predicate(incoming[i])) {
          const found = incoming[i];
          incoming.splice(i, 1);
          return found;
        }
      }
      await sleep(25);
    }
    throw new Error('Timed out waiting for Volumetrica WSS response');
  };

  try {
    await opened;

    sendMsg({ LoginReq: { Token: wssToken, AccountSubscriptionMode: 2 } });
    const loginResp = await waitFor(m => !!m?.LoginMsg, 8_000);
    if (!loginResp?.LoginMsg?.Success) {
      throw new Error(String(loginResp?.LoginMsg?.Reason || 'Volumetrica WSS login failed'));
    }

    sendMsg({ InfoReq: { Mode: 1, RequestId: Date.now() } });
    const infoResp = await waitFor(m => !!m?.InfoMsg && Array.isArray(m?.InfoMsg?.AccountList), 8_000);
    const accountList: any[] = infoResp?.InfoMsg?.AccountList || [];
    return accountList;
  } finally {
    try { ws.close(); } catch {}
  }
}

async function fetchTradesViaWss(userId: string, accountId: string): Promise<any[]> {
  const { ClientRequestMsg, ServerResponseMsg } = await loadProto();
  // WSS tokens are single-use — always authenticate fresh
  await authenticateVolumetrica(userId);
  const stored = await getStoredToken(userId);
  const wssEndpoint = stored?.tradingWssEndpoint;
  const wssToken = stored?.tradingWssToken;
  if (!wssEndpoint || !wssToken) {
    throw new Error('Missing Volumetrica WSS endpoint/token');
  }

  const WebSocketImpl: any = (globalThis as any).WebSocket;
  if (typeof WebSocketImpl !== 'function') {
    throw new Error('WebSocket is not available in this runtime');
  }

  const ws: any = new WebSocketImpl(wssEndpoint);
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
  ws.onerror = (e: any) => { openReject?.(e); };
  ws.onclose = () => { closed = true; };
  ws.onmessage = (event: any) => {
    try {
      const data = event?.data;
      const buf: Uint8Array =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array((data as any).buffer, (data as any).byteOffset, (data as any).byteLength)
            : typeof Buffer !== 'undefined' && Buffer.isBuffer(data)
              ? new Uint8Array(data)
              : new Uint8Array();
      if (!buf.length) return;
      const decoded = ServerResponseMsg.decode(buf);
      const obj = ServerResponseMsg.toObject(decoded, { longs: Number, enums: Number, defaults: true });
      incoming.push(obj);
    } catch (decodeErr: any) {
      // decode error
    }
  };

  const sendMsg = (msg: any) => {
    if (closed) throw new Error('WebSocket already closed');
    const err = ClientRequestMsg.verify(msg);
    if (err) throw new Error(`Invalid ClientRequestMsg: ${err}`);
    const encoded = ClientRequestMsg.encode(msg).finish();
    ws.send(encoded);
  };

  const waitFor = async (predicate: (msg: any) => boolean, timeoutMs: number) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      for (let i = 0; i < incoming.length; i++) {
        if (predicate(incoming[i])) {
          const found = incoming[i];
          incoming.splice(i, 1);
          return found;
        }
      }
      await sleep(25);
    }
    throw new Error('Timed out waiting for Volumetrica WSS response');
  };

  try {
    await opened;

    sendMsg({ LoginReq: { Token: wssToken } });
    const loginResp = await waitFor(m => !!m?.LoginMsg, 8_000);
    if (!loginResp?.LoginMsg?.Success) {
      throw new Error(String(loginResp?.LoginMsg?.Reason || 'Volumetrica WSS login failed'));
    }

    // Get account snapshot first (required by protocol)
    sendMsg({ InfoReq: { Mode: 1 } });
    await waitFor(m => !!m?.InfoMsg, 8_000).catch(() => null);

    // Request historical trades for this account
    const reqId = Date.now();
    const acctNum = Number(accountId);
    sendMsg({
      AccountHistoricalSessionReq: {
        RequestId: reqId,
        AccountIds: Number.isFinite(acctNum) ? [acctNum] : [],
        Entity: 2, // Trades
      },
    });

    // Collect all partial responses
    const allTrades: any[] = [];
    let done = false;
    while (!done) {
      const resp = await waitFor(m => !!m?.AccountHistoricalSessionResp, 15_000);
      const histResp = resp?.AccountHistoricalSessionResp;
      const trades = Array.isArray(histResp?.Trades) ? histResp.Trades : [];
      allTrades.push(...trades);
      if (!histResp?.IsPartial) done = true;
    }

    return allTrades;
  } finally {
    try { ws.close(); } catch {}
  }
}

function sanitizeForLog(value: unknown, maxLen = 800): string {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (!str) return '';
    return str.length > maxLen ? `${str.slice(0, maxLen)}...<truncated>` : str;
  } catch {
    return '[unserializable]';
  }
}

function makeRequestId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isAdminUid(decodedToken: any, uid: string): boolean {
  const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
    .split(',')
    .map((v: string) => v.trim())
    .filter(Boolean);
  return decodedToken?.admin === true || ADMIN_UIDS.includes(uid);
}

function assertBetaPasswordOrThrow(decodedToken: any, uid: string, betaPassword: unknown) {
  const required = process.env.VOLUMETRICA_BETA_PASSWORD;
  if (!required) return;
  if (isAdminUid(decodedToken, uid)) return;
  if (typeof betaPassword !== 'string' || betaPassword !== required) {
    throw new Error('Volumetrica Beta access denied');
  }
}

async function assertBetaPasswordOrConnectedOrThrow(decodedToken: any, uid: string, betaPassword: unknown) {
  const required = process.env.VOLUMETRICA_BETA_PASSWORD;
  if (!required) return;
  if (isAdminUid(decodedToken, uid)) return;
  if (typeof betaPassword === 'string' && betaPassword === required) return;
  const tokSnap = await db.collection('volumetricaTokens').doc(tokenDocIdFor(uid)).get();
  if (tokSnap.exists) return;
  throw new Error('Volumetrica Beta access denied');
}

function credsDocIdFor(userId: string) {
  return `${userId}_volumetrica_creds`;
}

function tokenDocIdFor(userId: string) {
  return `${userId}_volumetrica_token`;
}

async function upsertVolumetricaCreds(userId: string, login: string, password: string, environment: VolumetricaEnvironment) {
  const ref = db.collection('volumetricaCreds').doc(credsDocIdFor(userId));
  await ref.set(
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

async function getVolumetricaCreds(userId: string): Promise<{ login: string; password: string; environment: VolumetricaEnvironment } | null> {
  const ref = db.collection('volumetricaCreds').doc(credsDocIdFor(userId));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  const login = data?.login ? String(data.login) : '';
  const password = data?.password ? String(data.password) : '';
  const environment = (data?.environment === 0 ? 0 : 1) as VolumetricaEnvironment;
  if (!login || !password) return null;
  return { login, password, environment };
}

async function authenticateVolumetrica(userId: string, input?: { login?: string; password?: string; environment?: VolumetricaEnvironment }) {
  const platformKey = process.env.VOLUMETRICA_PLATFORM_KEY;
  if (!platformKey) {
    throw new Error('VOLUMETRICA_PLATFORM_KEY is not set');
  }

  let login = input?.login;
  let password = input?.password;
  // Per PDF: 0 = Production (prop firm users), 1 = Staging (testing)
  let environment: VolumetricaEnvironment = (input?.environment === 1 ? 1 : 0) as VolumetricaEnvironment;

  if (!login || !password) {
    const stored = await getVolumetricaCreds(userId);
    if (!stored) {
      throw new Error('Missing Volumetrica credentials');
    }
    login = login || stored.login;
    password = password || stored.password;
    environment = stored.environment;
  }

  // Persist creds server-side for refresh/reconnect.
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
  const data = (() => {
    try {
      return rawText ? JSON.parse(rawText) : null;
    } catch {
      return null;
    }
  })();
  if (!resp.ok) {
    console.error('[volumetrica] auth failed', {
      status: resp.status,
      environment,
      userId,
      body: sanitizeForLog(data || rawText),
    });
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
  const tradingRestTokenExpiration = typeof payload?.tradingRestTokenExpiration === 'number'
    ? payload.tradingRestTokenExpiration
    : null;

  const tokenRef = db.collection('volumetricaTokens').doc(tokenDocIdFor(userId));
  await tokenRef.set(
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
  );

  return {
    tradingWssEndpoint,
    tradingRestReportHost,
    tradingRestTokenExpiration,
  };
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

async function ensureFreshVolumetricaToken(userId: string): Promise<{
  tradingRestReportHost: string;
  tradingRestReportToken: string;
  tradingWssEndpoint?: string | null;
  tradingWssToken?: string | null;
  tradingRestTokenExpiration?: number | null;
}> {
  const now = Date.now();
  const bufferMs = 2 * 60 * 1000;

  const existing = await getStoredToken(userId);
  const exp = existing?.tradingRestTokenExpiration ?? null;
  const needsRefresh = !existing || (typeof exp === 'number' && Number.isFinite(exp) && (now + bufferMs) >= exp);

  if (needsRefresh) {
    await authenticateVolumetrica(userId);
  }

  const stored = await getStoredToken(userId);
  if (!stored) {
    throw new Error('Missing Volumetrica token (authenticate required)');
  }
  return stored;
}

async function fetchHistoricalWithAutoReauth(opts: {
  requestId: string;
  userId: string;
  pathAfterHistorical: string;
  method: 'GET' | 'POST';
  body?: any;
}): Promise<{ url: string; status: number; ok: boolean; rawText: string; data: any; usedFallbackAuth: boolean }> {
  const doRequest = async (attempt: number): Promise<{ url: string; status: number; ok: boolean; rawText: string; data: any; usedFallbackAuth: boolean }> => {
    const stored = await ensureFreshVolumetricaToken(opts.userId);
    if (!stored.tradingRestReportHost) {
      return { url: '', status: 503, ok: false, rawText: '', data: { message: 'REST reporting not available (trading-only connection)' }, usedFallbackAuth: false };
    }
    const url = buildHistoricalUrl(stored.tradingRestReportHost, opts.pathAfterHistorical);

    const headers: Record<string, string> = {
      Authorization: String(stored.tradingRestReportToken),
      accept: 'application/json',
    };
    let bodyStr: string | undefined;
    if (opts.method === 'POST') {
      headers['Content-Type'] = 'application/json';
      bodyStr = JSON.stringify(opts.body ?? {});
    }

    const resp = await fetch(url, {
      method: opts.method,
      headers,
      body: bodyStr,
    });

    const rawText = await resp.text().catch(() => '');
    const data = (() => {
      try {
        return rawText ? JSON.parse(rawText) : null;
      } catch {
        return null;
      }
    })();

    if (isUnauthorizedStatus(resp.status) && attempt === 0) {
      await authenticateVolumetrica(opts.userId);
      return doRequest(1);
    }

    return {
      url,
      status: resp.status,
      ok: resp.ok,
      rawText,
      data,
      usedFallbackAuth: attempt > 0,
    };
  };

  return doRequest(0);
}

async function getStoredToken(userId: string): Promise<{
  tradingRestReportHost: string;
  tradingRestReportToken: string;
  tradingWssEndpoint?: string | null;
  tradingWssToken?: string | null;
  tradingRestTokenExpiration?: number | null;
} | null> {
  const snap = await db.collection('volumetricaTokens').doc(tokenDocIdFor(userId)).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  const tradingRestReportHost = data?.tradingRestReportHost ? String(data.tradingRestReportHost) : '';
  const tradingRestReportToken = data?.tradingRestReportToken ? String(data.tradingRestReportToken) : '';
  return {
    tradingRestReportHost,
    tradingRestReportToken,
    tradingWssEndpoint: data?.tradingWssEndpoint ?? null,
    tradingWssToken: data?.tradingWssToken ?? null,
    tradingRestTokenExpiration: typeof data?.tradingRestTokenExpiration === 'number' ? data.tradingRestTokenExpiration : null,
  };
}

function normalizeBaseUrl(raw: string): string {
  return String(raw || '').trim().replace(/\/+$/, '');
}

function buildHistoricalUrl(tradingRestReportHost: string, pathAfterHistorical: string): string {
  const base = normalizeBaseUrl(tradingRestReportHost);
  const normalizedPath = String(pathAfterHistorical || '').replace(/^\/+/, '');
  if (/\/api\/historical$/i.test(base)) {
    return `${base}/${normalizedPath}`;
  }
  return `${base}/api/historical/${normalizedPath}`;
}

function epochToIso(value: any): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '';
  const ms = num > 1e12 ? num : num * 1000;
  try {
    return new Date(ms).toISOString();
  } catch {
    return '';
  }
}

function safeFirestoreId(value: string) {
  return String(value).replace(/\//g, '_');
}

async function fetchAccountBalanceFromSnapshots(opts: {
  requestId: string;
  userId: string;
  accountId: string;
}): Promise<number | null> {
  const url = buildHistoricalUrl((await ensureFreshVolumetricaToken(opts.userId)).tradingRestReportHost, `TradingAccount/SessionSnapshots/${encodeURIComponent(opts.accountId)}`);
  const getResp = await fetchHistoricalWithAutoReauth({
    requestId: opts.requestId,
    userId: opts.userId,
    pathAfterHistorical: `TradingAccount/SessionSnapshots/${encodeURIComponent(opts.accountId)}`,
    method: 'GET',
  });

  if (!getResp.ok) {
    const msg = String(getResp.data?.message || getResp.data?.reason || '');
    const shouldFallback = getResp.status === 404 && /account not found/i.test(msg);
    if (!shouldFallback) {
      return null;
    }

    const stored = await ensureFreshVolumetricaToken(opts.userId);
    const postUrl = buildHistoricalUrl(stored.tradingRestReportHost, 'TradingAccount/SessionSnapshots');
    const postBody = {
      model: {
        accountIds: [String(opts.accountId)],
        period: 'today',
      },
    };

    const postResp = await fetchHistoricalWithAutoReauth({
      requestId: opts.requestId,
      userId: opts.userId,
      pathAfterHistorical: 'TradingAccount/SessionSnapshots',
      method: 'POST',
      body: postBody,
    });

    if (!postResp.ok) {
      return null;
    }

    // POST response shape (per swagger): { success, data: { accountId, ..., data: HistoricalTradingAccountSnapshot[] } }
    // But some hosts return a top-level array:
    // - HistoricalTradingAccountSnapshot[]
    // - or [{ accountId, data: HistoricalTradingAccountSnapshot[] }, ...]
    // So handle multiple shapes defensively.
    const nestedSnaps: any[] = (() => {
      // Top-level array cases
      if (Array.isArray(postResp.data)) {
        const first = postResp.data[0];
        // Direct array of snapshots
        if (first && typeof first === 'object' && ('balance' in first || 'equity' in first)) return postResp.data;
        // Array of wrappers { accountId, data: [...] }
        if (first && typeof first === 'object' && Array.isArray((first as any).data)) return (first as any).data;
        if (first && typeof first === 'object' && Array.isArray((first as any).data?.data)) return (first as any).data.data;
        return [];
      }

      // Object cases
      const d = postResp.data?.data;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d?.data?.data)) return d.data.data;
      if (Array.isArray(d)) return d;
      return [];
    })();

    if (!nestedSnaps.length) return null;
    const pick = nestedSnaps
      .slice()
      .sort((a, b) => {
        const at = Date.parse(a?.maximumBalanceUtc || a?.maximumEquityUtc || '') || 0;
        const bt = Date.parse(b?.maximumBalanceUtc || b?.maximumEquityUtc || '') || 0;
        return bt - at;
      })[0];
    const equity = typeof pick?.equity === 'number' ? pick.equity : null;
    const balance = typeof pick?.balance === 'number' ? pick.balance : null;
    const value = equity ?? balance;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  const snaps: any[] = Array.isArray(getResp.data?.data) ? getResp.data.data : [];
  if (!snaps.length) return null;

  // Prefer equity if present, else balance. Choose the snapshot with the latest max balance timestamp if provided.
  const pick = snaps
    .slice()
    .sort((a, b) => {
      const at = Date.parse(a?.maximumBalanceUtc || a?.maximumEquityUtc || '') || 0;
      const bt = Date.parse(b?.maximumBalanceUtc || b?.maximumEquityUtc || '') || 0;
      return bt - at;
    })[0];

  const equity = typeof pick?.equity === 'number' ? pick.equity : null;
  const balance = typeof pick?.balance === 'number' ? pick.balance : null;
  const value = equity ?? balance;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const config = { maxDuration: 30 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const requestId = makeRequestId();
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Firebase auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }

    const firebaseToken = authHeader.substring(7);
    let authenticatedUserId: string;
    let decodedToken: any;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
      authenticatedUserId = decodedToken.uid;
    } catch {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    const { action, userId, betaPassword } = req.body || {};
    if (userId && userId !== authenticatedUserId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }
    const effectiveUserId = userId || authenticatedUserId;

    if (action === 'beta-check') {
      try {
        assertBetaPasswordOrThrow(decodedToken, authenticatedUserId, betaPassword);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ success: true });
      } catch (e: any) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(403).json({ error: e?.message || 'Access denied' });
      }
    }

    if (action === 'authenticate') {
      assertBetaPasswordOrThrow(decodedToken, authenticatedUserId, betaPassword);
      const { login, password, environment } = req.body || {};
      const env = (environment === 0 ? 0 : 1) as VolumetricaEnvironment;
      const result = await authenticateVolumetrica(effectiveUserId, {
        login,
        password,
        environment: env,
      });
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, ...result });
    }

    if (action === 'connect') {
      assertBetaPasswordOrThrow(decodedToken, authenticatedUserId, betaPassword);

      // Use WSS-based account discovery (connectOnlyTrading=true means REST historical API is unavailable)
      const wssAccounts = await fetchAccountsViaWss(effectiveUserId);

      const accounts: any[] = [];
      for (const acc of wssAccounts) {
        const accountId = String(acc.accountNumber ?? acc.accountId ?? acc.id ?? '');
        const name = String(acc.accountHeader ?? acc.accountDescription ?? `Account ${accountId}`);
        if (!accountId) continue;

        // Extract balance from WSS AccountHeaderMsg.Balance
        const balanceMsg = acc.Balance || acc.balance;
        const balanceValue = typeof balanceMsg?.Balance === 'number' ? balanceMsg.Balance
          : typeof balanceMsg?.Equity === 'number' ? balanceMsg.Equity
          : typeof balanceMsg === 'number' ? balanceMsg
          : null;

        const financeRef = db.collection('finances').doc(accountId);
        const existing = await financeRef.get();
        const exists = existing.exists;

        const baseUpdate: any = {
          id: accountId,
          accountId,
          name,
          platform: 'Volumetrica',
          userId: effectiveUserId,
        };
        if (typeof balanceValue === 'number' && Number.isFinite(balanceValue)) {
          baseUpdate.balance = balanceValue;
        }
        if (!exists) {
          baseUpdate.firm = '';
          baseUpdate.type = 'Account';
        }

        await financeRef.set(baseUpdate, { merge: true });
        accounts.push({ accountId, name, balance: balanceValue });
      }

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, provider: 'Volumetrica', accounts });
    }

    if (action === 'fetchTrades') {
      await assertBetaPasswordOrConnectedOrThrow(decodedToken, authenticatedUserId, betaPassword);

      const { accountId, startTimestamp, endTimestamp, startDt, endDt, period } = req.body || {};
      const acct = String(accountId ?? '').trim();
      if (!acct) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing accountId' });
      }

      // Get account name from finances collection (like TopstepX does)
      const financeSnap = await db.collection('finances').doc(acct).get();
      const accountName = financeSnap.data()?.name || acct;

      const startIso = String(startTimestamp || startDt || '').trim();
      const endIso = String(endTimestamp || endDt || '').trim();
      const query = new URLSearchParams();
      if (startIso) query.set('startDt', startIso);
      if (endIso) query.set('endDt', endIso);
      if (period) query.set('period', String(period));

      const path = `TradingAccount/Trades/${encodeURIComponent(acct)}${query.toString() ? `?${query.toString()}` : ''}`;

      const tradesResp = await fetchHistoricalWithAutoReauth({
        requestId,
        userId: effectiveUserId,
        pathAfterHistorical: path,
        method: 'GET',
      });

      let upstreamTrades: any[] = [];
      let usedWss = false;

      if (tradesResp.ok) {
        // REST succeeded — parse response
        upstreamTrades = Array.isArray(tradesResp.data?.data)
          ? tradesResp.data.data
          : Array.isArray(tradesResp.data)
            ? tradesResp.data
            : [];
      } else if (tradesResp.status === 503 || (tradesResp.status === 404 && /account not found/i.test(String(tradesResp.data?.message || '')))) {
        // REST not available or account not found (connectOnlyTrading=true) — fall back to WSS
        try {
          const wssTrades = await fetchTradesViaWss(effectiveUserId, acct);
          usedWss = true;
          // Map TradeReportMsg fields to the same shape as REST ReportTradeViewModel
          upstreamTrades = wssTrades.map((t: any) => ({
            tradeId: t?.TradeId ?? t?.tradeId ?? '',
            contractId: t?.ContractId ?? t?.contractId ?? '',
            contract: { symbol: t?.FeedSymbol ?? t?.feedSymbol ?? '' },
            quantity: t?.Quantity ?? t?.quantity ?? 0,
            entryDate: t?.EntryUtc ?? t?.entryUtc ?? 0,
            exitDate: t?.ExitUtc ?? t?.exitUtc ?? 0,
            entryPrice: t?.OpenPrice ?? t?.openPrice ?? 0,
            exitPrice: t?.ClosePrice ?? t?.closePrice ?? 0,
            grossPl: t?.GrossPL ?? t?.grossPL ?? 0,
            netPl: (t?.GrossPL ?? t?.grossPL ?? 0) - (t?.Commissions ?? t?.commissions ?? 0),
          }));
        } catch (wssErr: any) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(503).json({ error: 'Failed to fetch Volumetrica trades (REST unavailable, WSS fallback failed)', details: wssErr?.message });
        }
      } else {
        res.setHeader('Content-Type', 'application/json');
        return res.status(tradesResp.status).json({ error: 'Failed to fetch Volumetrica trades', details: tradesResp.data || tradesResp.rawText });
      }

      type WriteOp = { ref: any; data: any };
      const writeOps: WriteOp[] = [];
      const savedTrades: any[] = [];
      let saved = 0;

      for (const t of upstreamTrades) {
        const tradeIdRaw = t?.tradeId ?? t?.id ?? '';
        const tradeId = String(tradeIdRaw || '').trim();
        // entryDate/exitDate are epoch int64 (seconds or ms)
        const entryTime = epochToIso(t?.entryDate);
        const exitTime = epochToIso(t?.exitDate);
        const dateStr = (exitTime || entryTime) ? String((exitTime || entryTime).split('T')[0]) : '';

        // Infer side from quantity: positive = Buy, negative = Sell
        const rawQty = typeof t?.quantity === 'number' ? t.quantity : Number(t?.quantity);
        const side = Number.isFinite(rawQty) ? (rawQty >= 0 ? 'Buy' : 'Sell') : '';
        const absQty = Number.isFinite(rawQty) ? Math.abs(rawQty) : null;

        // Symbol from contract info
        const symbol = t?.contract?.symbol || t?.contract?.contractName || t?.contract?.name || String(t?.contractId ?? '');

        // PnL: prefer netPl (after fees), fallback to grossPl
        const grossPl = typeof t?.grossPl === 'number' ? t.grossPl : 0;
        const netPl = typeof t?.netPl === 'number' ? t.netPl : grossPl;
        const fees = Math.abs(grossPl - netPl);

        // Idempotent doc ID (prevents duplicates across repeated syncs)
        const canonicalSource = tradeId
          ? `vol_${effectiveUserId}_${acct}_${tradeId}`
          : `vol_${effectiveUserId}_${acct}_${String(t?.entryDate ?? '')}_${String(t?.exitDate ?? '')}_${String(t?.contractId ?? '')}_${String(t?.quantity ?? '')}_${String(t?.grossPl ?? '')}`;
        const docId = safeFirestoreId(canonicalSource);
        const ref = db.collection('trades').doc(docId);

        const tradeData = {
          userId: effectiveUserId,
          accountId: acct,
          account: accountName,
          symbol,
          date: dateStr,
          side,
          qty: absQty,
          entryPrice: t?.entryPrice ?? null,
          exitPrice: t?.exitPrice ?? null,
          entryTime,
          exitTime,
          pnl: netPl,
          fees,
          platform: 'Volumetrica',
          provider: 'Volumetrica',
          volumetricaTradeId: tradeId || undefined,
          contractId: t?.contractId ?? undefined,
          tradeId: tradeId ? `Volumetrica-${acct}-${tradeId}` : undefined,
        };

        savedTrades.push({ ...tradeData, id: ref.id });
        writeOps.push({ ref, data: tradeData });
      }

      // Batch upserts to Firestore (450 ops max per batch, like TopstepX)
      const MAX_BATCH_OPS = 450;
      for (let i = 0; i < writeOps.length; i += MAX_BATCH_OPS) {
        const chunk = writeOps.slice(i, i + MAX_BATCH_OPS);

        // Count new docs for metrics
        try {
          const snaps = await (db as any).getAll(...chunk.map((c: WriteOp) => c.ref));
          for (const snap of snaps) {
            if (!snap.exists) saved++;
          }
        } catch {
          // If getAll is unavailable, approximate
        }

        const batch = db.batch();
        for (const op of chunk) {
          batch.set(op.ref, op.data, { merge: true });
        }
        await batch.commit();
      }

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, provider: 'Volumetrica', total: upstreamTrades.length, saved, trades: savedTrades });
    }

    if (action === 'syncAccounts') {
      await assertBetaPasswordOrConnectedOrThrow(decodedToken, authenticatedUserId, betaPassword);

      // Re-fetch accounts via WSS to get latest balances
      const wssAccounts = await fetchAccountsViaWss(effectiveUserId);
      const updated: any[] = [];

      for (const acc of wssAccounts) {
        const accountId = String(acc.accountNumber ?? acc.accountId ?? acc.id ?? '');
        if (!accountId) continue;

        // Extract balance from WSS AccountHeaderMsg.Balance
        const balanceMsg = acc.Balance || acc.balance;
        const balanceValue = typeof balanceMsg?.Balance === 'number' ? balanceMsg.Balance
          : typeof balanceMsg?.Equity === 'number' ? balanceMsg.Equity
          : typeof balanceMsg === 'number' ? balanceMsg
          : null;

        // Try REST snapshot as fallback if WSS didn't provide a balance
        let finalBalance = balanceValue;
        if (finalBalance == null || !Number.isFinite(finalBalance)) {
          try {
            const snapshotBalance = await fetchAccountBalanceFromSnapshots({
              requestId,
              userId: effectiveUserId,
              accountId,
            });
            if (typeof snapshotBalance === 'number' && Number.isFinite(snapshotBalance)) {
              finalBalance = snapshotBalance;
            }
          } catch {}
        }

        const financeRef = db.collection('finances').doc(accountId);
        const updateData: any = {
          userId: effectiveUserId,
          platform: 'Volumetrica',
        };
        if (typeof finalBalance === 'number' && Number.isFinite(finalBalance)) {
          updateData.balance = finalBalance;
        }

        await financeRef.set(updateData, { merge: true });
        updated.push({ accountId, balance: finalBalance });
      }

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, provider: 'Volumetrica', updated });
    }

    if (action === 'getWssToken') {
      await assertBetaPasswordOrConnectedOrThrow(decodedToken, authenticatedUserId, betaPassword);

      // Ensure a fresh token, then return WSS credentials to the browser
      await authenticateVolumetrica(effectiveUserId, { environment: 0 });
      const stored = await getStoredToken(effectiveUserId);
      if (!stored?.tradingWssEndpoint || !stored?.tradingWssToken) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Missing Volumetrica WSS credentials after authentication' });
      }

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        tradingWssEndpoint: stored.tradingWssEndpoint,
        tradingWssToken: stored.tradingWssToken,
      });
    }

    if (action === 'removeToken') {
      assertBetaPasswordOrThrow(decodedToken, authenticatedUserId, betaPassword);
      await db.collection('volumetricaTokens').doc(tokenDocIdFor(effectiveUserId)).delete().catch(() => {});
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Invalid action' });
  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}