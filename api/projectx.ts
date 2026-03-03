import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

type ProviderName = 'TopstepX';

function safeFirestoreId(value: string) {
  // Firestore doc ids cannot contain '/'. Keep it simple and deterministic.
  return String(value).replace(/\//g, '_');
}

function tokenDocIdFor(userId: string, providerName: ProviderName) {
  return `${userId}_${providerName.toLowerCase()}_token`;
}

function credsDocIdFor(userId: string, providerName: ProviderName) {
  return `${userId}_${providerName.toLowerCase()}_creds`;
}

async function upsertProjectXCreds(userId: string, providerName: ProviderName, userName: string, apiKey: string) {
  const ref = db.collection('projectXCreds').doc(credsDocIdFor(userId, providerName));
  await ref.set(
    {
      userId,
      provider: providerName,
      userName,
      apiKey,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function getProjectXCreds(userId: string, providerName: ProviderName): Promise<{ userName: string; apiKey: string } | null> {
  // Primary: dedicated server-only creds doc.
  const ref = db.collection('projectXCreds').doc(credsDocIdFor(userId, providerName));
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() as any;
    const userName = data?.userName ? String(data.userName) : '';
    const apiKey = data?.apiKey ? String(data.apiKey) : '';
    if (userName && apiKey) return { userName, apiKey };
  }

  // Migration fallback: legacy deployments stored creds in projectXTokens.
  // If present, copy to projectXCreds and scrub them from the token doc.
  const legacyTokenId = tokenDocIdFor(userId, providerName);
  const legacySnap = await db.collection('projectXTokens').doc(legacyTokenId).get();
  if (!legacySnap.exists) return null;
  const legacy = legacySnap.data() as any;
  const legacyUserName = legacy?.userName ? String(legacy.userName) : '';
  const legacyApiKey = legacy?.apiKey ? String(legacy.apiKey) : '';
  if (!legacyUserName || !legacyApiKey) return null;

  await upsertProjectXCreds(userId, providerName, legacyUserName, legacyApiKey);
  await db.collection('projectXTokens').doc(legacyTokenId).set(
    {
      userName: admin.firestore.FieldValue.delete(),
      apiKey: admin.firestore.FieldValue.delete(),
    },
    { merge: true }
  );

  return { userName: legacyUserName, apiKey: legacyApiKey };
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const runWorker = async () => {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  };

  const poolSize = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
  return results;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function loginKeyTopstepX(userName: string, apiKey: string): Promise<string> {
  const base = 'https://api.topstepx.com';
  const authUrl = `${base}/api/Auth/loginKey`;
  const resp = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'accept': 'text/plain' },
    body: JSON.stringify({ userName, apiKey }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`loginKey failed (${resp.status}): ${text}`);
  }

  // Parse response and extract token
  try {
    const data = JSON.parse(text);
    const accessToken = data.token || data.accessToken || data.jwt || '';
    if (!accessToken) {
      throw new Error(`loginKey returned no token: ${text.slice(0, 200)}`);
    }
    return accessToken;
  } catch {
    const accessToken = text.trim();
    if (!accessToken) {
      throw new Error('loginKey returned empty token');
    }
    return accessToken;
  }
}

async function ensureFreshProjectXToken(userId: string, providerName: ProviderName): Promise<{ access_token: string; expires_at?: number }> {
  const tokenDocId = tokenDocIdFor(userId, providerName);
  const tokSnap = await db.collection('projectXTokens').doc(tokenDocId).get();
  const tok = tokSnap.data();

  const now = Date.now();
  const bufferMs = 60 * 1000;
  const accessToken = tok?.access_token ? String(tok.access_token) : '';
  const expiresAt = typeof tok?.expires_at === 'number' ? tok.expires_at : undefined;
  const needsRefresh = !accessToken || (expiresAt != null && (now + bufferMs) >= expiresAt);

  if (!needsRefresh) {
    return { access_token: accessToken, expires_at: expiresAt };
  }

  const creds = await getProjectXCreds(userId, providerName);
  if (!creds) {
    throw new Error('Missing stored userName/apiKey for token refresh');
  }

  const refreshedToken = await loginKeyTopstepX(String(creds.userName), String(creds.apiKey));
  const newExpiresAt = now + 24 * 60 * 60 * 1000;
  await db.collection('projectXTokens').doc(tokenDocId).set(
    {
      userId,
      provider: providerName,
      access_token: refreshedToken,
      created_at: now,
      expires_at: newExpiresAt,
      // Ensure legacy secrets are not left behind on the token doc.
      userName: admin.firestore.FieldValue.delete(),
      apiKey: admin.firestore.FieldValue.delete(),
    },
    { merge: true }
  );

  return { access_token: refreshedToken, expires_at: newExpiresAt };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }
    const token = authHeader.substring(7);
    let authenticatedUserId: string;
    let decodedToken: any;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      authenticatedUserId = decodedToken.uid;
    } catch {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    const { action, userId, provider } = req.body;
    if (!userId || userId !== authenticatedUserId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }

    // ✅ VERIFY ACTIVE SUBSCRIPTION (for premium actions)
    // Skip for authenticate/connect (account setup), require for data fetching, skip for admin UIDs
    const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map((uid: string) => uid.trim()).filter(Boolean);
    const isAdmin = decodedToken?.admin === true || ADMIN_UIDS.includes(authenticatedUserId);

    if (action !== 'authenticate' && action !== 'connect' && !isAdmin) {
      try {
        const subscriptionDoc = await db.collection('subscriptions').doc(authenticatedUserId).get();
        const subscription = subscriptionDoc.data();

        if (!subscription?.hasSubscription || 
            subscription?.subscriptionStatus !== 'complete' || 
            subscription?.paymentStatus !== 'paid') {
          res.setHeader('Content-Type', 'application/json');
          return res.status(403).json({ 
            error: 'Active subscription required to access this feature',
            requiresSubscription: true
          });
        }
      } catch {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Failed to verify subscription status' });
      }
    }

    // Authenticate: obtain a ProjectX JWT using API key or app credentials
    if (action === 'authenticate') {
     
      let { apiKey, userName } = req.body || {};
      const providerName = (provider || 'TopstepX') as ProviderName;
      // Always use TopstepX production endpoint
      const base = 'https://api.topstepx.com';

      // If credentials are not provided, load them from server-only storage.
      // This keeps long-lived secrets out of any client-readable Firestore docs.
      if (!apiKey || !userName) {
        const creds = await getProjectXCreds(userId, providerName);
        if (creds) {
          if (!apiKey) apiKey = creds.apiKey;
          if (!userName) userName = creds.userName;
        }
      }

      if (!apiKey || !userName) {
       
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing apiKey or userName (not provided and not found in server storage)' });
      }

      // Persist/refresh creds server-side (never store them on the token doc).
      // Note: clients can send apiKey/userName only during initial connect.
    
      await upsertProjectXCreds(userId, providerName, String(userName), String(apiKey));
     

      // Docs: Authenticate (with API key): POST /api/Auth/loginKey { userName, apiKey }
      const authUrl = `${base}/api/Auth/loginKey`;
      const resp = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'accept': 'text/plain' },
        body: JSON.stringify({ userName, apiKey }),
      });
      const text = await resp.text();
      if (!resp.ok) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(resp.status).json({ error: 'ProjectX auth failed', details: text });
      }
      
      // Parse response and extract token
      let accessToken: string;
      try {
        const data = JSON.parse(text);
        // TopstepX returns JWT in 'token' field, handle null/undefined
        accessToken = data.token || data.accessToken || data.jwt || '';
        if (!accessToken) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(500).json({ error: 'No token in auth response', details: JSON.stringify(data) });
        }
      } catch {
        // If parsing fails, assume the entire response is the token (plain text)
        accessToken = text.trim();
      }
      
      const tokenDocId = tokenDocIdFor(userId, providerName);
      const now = Date.now();
      const expiresAt = now + 24 * 60 * 60 * 1000;
     
      await db.collection('projectXTokens').doc(tokenDocId).set({
        userId,
        provider: providerName,
        access_token: accessToken,
        created_at: now,
        expires_at: expiresAt, // 24h per docs
        // Explicitly scrub any legacy secrets from prior deployments.
        userName: admin.firestore.FieldValue.delete(),
        apiKey: admin.firestore.FieldValue.delete(),
      }, { merge: true });
     
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, provider: providerName, expires_at: expiresAt });
    }

    // Validate session token (24h lifetime per docs)
    if (action === 'validateSession') {
      const providerName = (provider || 'TopstepX') as ProviderName;
      const base = 'https://api.topstepx.com';
      const tokenDocId = tokenDocIdFor(userId, providerName);
      let accessToken: string;
      try {
        accessToken = (await ensureFreshProjectXToken(userId, providerName)).access_token;
      } catch {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ error: 'No ProjectX token found. Authenticate first.' });
      }
      const url = `${base}/api/Auth/validate`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'accept': 'application/json' },
        body: JSON.stringify({}),
      });
      const text = await resp.text();
      if (!resp.ok) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(resp.status).json({ error: 'ProjectX token validation failed', details: text });
      }
      await db.collection('projectXTokens').doc(tokenDocId).update({
        validated_at: Date.now(),
      });
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true });
    }

    // Connect flow: create a token doc and initial accounts in finances
    if (action === 'connect') {
    
      const providerName = (provider || 'TopstepX') as ProviderName;
      const providerKey = providerName.toLowerCase();
      let accessToken: string;
      try {
        
        accessToken = (await ensureFreshProjectXToken(userId, providerName)).access_token;
       
      } catch (e) {
      
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Authenticate with ProjectX first' });
      }

      // Real accounts call per docs: POST /api/Account/search { onlyActiveAccounts: true }
      const base = 'https://api.topstepx.com';
      const accountsUrl = `${base}/api/Account/search`;
    
      const resp = await fetch(accountsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, 'accept': 'application/json' },
        body: JSON.stringify({ onlyActiveAccounts: true }),
      });
      if (!resp.ok) {
        const t = await resp.text();
      
        res.setHeader('Content-Type', 'application/json');
        return res.status(resp.status).json({ error: 'Failed to fetch ProjectX accounts', details: t });
      }
      const responseData = await resp.json();
      // Avoid logging raw upstream response payloads.
      // Handle different response formats: array, object with accounts array, or wrapped response
      let accounts = Array.isArray(responseData) ? responseData : 
                     (responseData.accounts || responseData.data || responseData.result || []);
      if (!Array.isArray(accounts)) accounts = [];
    
      
      // Persist accounts to finances
      for (const acc of accounts) {
        const accountId = String(acc.id ?? acc.accountId ?? acc.AccountId ?? '');
        const name = acc.name ?? acc.accountName ?? `Account ${accountId}`;
        const balance = acc.balance ?? 0;

        const financeRef = db.collection('finances').doc(accountId);
        const existing = await financeRef.get();
        const exists = existing.exists;

        // IMPORTANT: Don't reset user-configured fields like firm/type on re-connect.
        // Only initialize them for brand new finance docs.
        const baseUpdate: any = {
          balance,
          id: accountId,
          name,
          platform: providerName,
          userId,
          accountId,
        };
        if (!exists) {
          baseUpdate.firm = '';
          baseUpdate.type = 'Account';
        }

        await financeRef.set(baseUpdate, { merge: true });
    
      }

   
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, provider: providerName, accounts });
    }

    // Sync accounts: fetch active accounts from ProjectX and update finances
    if (action === 'syncAccounts') {
      const providerName = (provider || 'TopstepX') as ProviderName;
      let token: string;
      try {
        token = (await ensureFreshProjectXToken(userId, providerName)).access_token;
      } catch (e) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ error: 'No ProjectX token found. Authenticate first.' });
      }
      const base = 'https://api.topstepx.com';
      const accountsUrl = `${base}/api/Account/search`;
      const resp = await fetch(accountsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'accept': 'application/json' },
        body: JSON.stringify({ onlyActiveAccounts: true }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        res.setHeader('Content-Type', 'application/json');
        return res.status(resp.status).json({ error: 'Failed to fetch ProjectX accounts', details: t });
      }
      const responseData = await resp.json();
      // Avoid logging raw upstream response payloads.
      let accounts = Array.isArray(responseData) ? responseData : 
                     (responseData.accounts || responseData.data || responseData.result || []);
      if (!Array.isArray(accounts)) accounts = [];
      for (const acc of accounts) {
        const accountId = String(acc.id ?? acc.accountId ?? acc.AccountId ?? '');
        const name = acc.name ?? acc.accountName ?? `Account ${accountId}`;
        const balance = acc.balance ?? 0;

        const financeRef = db.collection('finances').doc(accountId);
        const existing = await financeRef.get();
        const exists = existing.exists;

        const baseUpdate: any = {
          balance,
          id: accountId,
          name,
          platform: providerName,
          userId,
          accountId,
          lastBalanceUpdate: Date.now(),
          updateSource: 'projectx_sync',
        };
        if (!exists) {
          baseUpdate.firm = '';
          baseUpdate.type = 'Account';
        }

        await financeRef.set(baseUpdate, { merge: true });
      }
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, accounts: accounts.map((a: any) => a.id ?? a.accountId) });
    }

    // Sync trades: accept trades payload from ProjectX and persist directly (no fill matching)
    if (action === 'syncTrades') {
      const { trades } = req.body;
      if (!Array.isArray(trades)) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing trades array in request body' });
      }
      let saved = 0;
      for (const t of trades) {
        const accId = String(t.accountId || t.account || '');
        const symbol = t.symbol || '';
        const tradeId = t.tradeId || `${userId}-${accId}-${symbol}-${t.entryTime || ''}-${t.exitTime || ''}`;
        const dateStr = t.date && !isNaN(Date.parse(t.date)) ? formatDate(new Date(t.date)) : formatDate(new Date());

        // Idempotent write: use stable tradeId as doc id (prevents duplicates across repeated syncs).
        const docId = safeFirestoreId(tradeId);
        const tradeRef = db.collection('trades').doc(docId);
        const existingById = await tradeRef.get();
        if (!existingById.exists) {
          await tradeRef.set(
            {
              userId,
              accountId: accId,
              account: t.accountName || accId,
              symbol,
              date: dateStr,
              tradeId,
              side: t.side,
              qty: t.qty ?? t.size,
              entryPrice: t.entryPrice,
              exitPrice: t.exitPrice,
              entryTime: t.entryTime || '',
              exitTime: t.exitTime || '',
              pnl: t.pnl,
              provider: 'TopstepX',
              platform: 'TopstepX',
            },
            { merge: true }
          );
          saved++;
        }
      }
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, saved });
    }



    // Fetch trades: call TopstepX Trade/search API and save to Firestore
    if (action === 'fetchTrades') {
      const { accountId, startTimestamp, endTimestamp } = req.body;
      const providerName = (provider || 'TopstepX') as ProviderName;

      let token: string;
      try {
        token = (await ensureFreshProjectXToken(userId, providerName)).access_token;
      } catch (e) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ error: 'No TopstepX token found. Authenticate first.' });
      }
      
      const base = 'https://api.topstepx.com';
      const tradesUrl = `${base}/api/Trade/search`;

      const resp = await fetch(tradesUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}`, 
          'accept': 'application/json' 
        },
        body: JSON.stringify({ 
          accountId: parseInt(accountId),
          startTimestamp,
          endTimestamp
        }),
      });
      
      if (!resp.ok) {
        const t = await resp.text();
        res.setHeader('Content-Type', 'application/json');
        return res.status(resp.status).json({ error: 'Failed to fetch TopstepX trades', details: t });
      }
      
      const responseData = await resp.json();
      
      const trades = responseData.trades || [];
      let saved = 0;
      const savedTrades: any[] = [];
      
      // Get account name from finances collection
      const financeSnap = await db.collection('finances').doc(String(accountId)).get();
      const accountName = financeSnap.data()?.name || String(accountId);

      // Prefetch contract names once per unique contractId (bounded concurrency).
      // This replaces per-trade Contract/searchById calls.
      const contractNameById = new Map<string, string>();
      const contractIdsToFetch: string[] = Array.from(
        new Set<string>(
          (trades || [])
            .filter((t: any) => t && t.profitAndLoss !== null && !t.voided)
            .map((t: any) => String(t.contractId ?? ''))
            .filter(Boolean)
        )
      );

      const CONTRACT_LOOKUP_CONCURRENCY = 8;
      await mapWithConcurrency(contractIdsToFetch, CONTRACT_LOOKUP_CONCURRENCY, async (contractIdStr) => {
        // Default: if lookup fails, keep contractId as "symbol".
        contractNameById.set(contractIdStr, contractIdStr);
        try {
          const contractIdNum = Number(contractIdStr);
          if (!Number.isFinite(contractIdNum)) return contractIdStr;

          const contractRes = await fetch(`${base}/api/Contract/searchById`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              accept: 'application/json',
            },
            body: JSON.stringify({ contractId: contractIdNum }),
          });

          if (!contractRes.ok) return contractIdStr;
          const contractData = await contractRes.json();
          const name = contractData?.contract?.name ? String(contractData.contract.name) : '';
          if (name) contractNameById.set(contractIdStr, name);
          return contractIdStr;
        } catch {
          return contractIdStr;
        }
      });

      type WriteOp = { ref: any; data: any };
      const writeOps: WriteOp[] = [];
      
      // Process and save each trade
      for (const trade of trades) {
        // Only process closed trades (profitAndLoss is not null)
        if (trade.profitAndLoss === null) continue;
        // Skip voided trades
        if (trade.voided) continue;
        
        // TopstepX side: 0=Sell, 1=Buy
        const side = trade.side === 1 ? 'Buy' : 'Sell';
        const createdDate = new Date(trade.creationTimestamp);
        const dateStr = formatDate(createdDate);
        
        // Use prefetched contract name (fallback to contractId)
        const contractId = trade.contractId;
        const symbol = contractNameById.get(String(contractId)) || String(contractId);
        
        // TopstepX fees are per-side, so multiply by 2 for total fees (entry + exit)
        const totalFees = (trade.fees || 0) * 2;

        // Guard: TopstepX can return a later "commission-only" adjustment entry
        // (profitAndLoss=0, fees>0) for an already-saved order.
        // If we already have any trade for this orderId/contractId/account, skip this item.
        const profitAndLossNumber = Number(trade.profitAndLoss);
        const isFeeOnlyCandidate = profitAndLossNumber === 0 && totalFees > 0;
        const orderId = trade.orderId;
        if (isFeeOnlyCandidate && orderId && contractId) {
          const existingByOrder = await db
            .collection('trades')
            .where('userId', '==', userId)
            .where('accountId', '==', String(accountId))
            .where('orderId', '==', orderId)
            .where('contractId', '==', contractId)
            .limit(1)
            .get();
          if (!existingByOrder.empty) {
            continue;
          }
        }

        // Idempotent write: use TopstepX trade id as the primary key.
        // This prevents doubles/triples when fetching historical ranges multiple times.
        const topstepXTradeId = String(trade.id ?? '');
        const canonicalIdSource = topstepXTradeId
          ? `tsqx_${userId}_${String(accountId)}_${topstepXTradeId}`
          : `tsqx_${userId}_${String(accountId)}_${String(trade.creationTimestamp)}_${String(orderId ?? '')}_${String(contractId ?? '')}_${String(trade.size ?? '')}_${String(trade.price ?? '')}_${String(trade.side ?? '')}`;
        const canonicalDocId = safeFirestoreId(canonicalIdSource);
        const canonicalRef = db.collection('trades').doc(canonicalDocId);

        const tradeData = {
          userId,
          accountId: String(accountId),
          account: accountName,
          symbol,
          date: dateStr,
          side,
          qty: trade.size,
          entryPrice: trade.price,
          exitPrice: trade.price,
          entryTime: trade.creationTimestamp,
          exitTime: trade.creationTimestamp,
          pnl: profitAndLossNumber - totalFees,
          fees: totalFees,
          platform: 'TopstepX',
          provider: 'TopstepX',
          topstepXTradeId: topstepXTradeId || undefined,
          creationTimestamp: trade.creationTimestamp,
          contractId,
          orderId,
          voided: trade.voided || false,
          tradeId: topstepXTradeId ? `TopstepX-${String(accountId)}-${topstepXTradeId}` : undefined,
        };

        savedTrades.push({ ...tradeData, id: canonicalRef.id });
        writeOps.push({ ref: canonicalRef, data: tradeData });
      }

      // Batch upserts to Firestore (500 ops max per batch).
      const MAX_BATCH_OPS = 450;
      const opChunks = chunkArray(writeOps, MAX_BATCH_OPS);

      for (const chunk of opChunks) {
        // Count how many are "new" (not required for correctness, but preserves saved metric).
        try {
          const snaps = await (db as any).getAll(...chunk.map(c => c.ref));
          for (const snap of snaps) {
            if (!snap.exists) saved++;
          }
        } catch {
          // If getAll is unavailable in this environment, fall back to approximate saved count.
          // This only affects metrics, not writes.
        }

        const batch = db.batch();
        for (const op of chunk) {
          batch.set(op.ref, op.data, { merge: true });
        }
        await batch.commit();
      }
      
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ success: true, total: trades.length, saved, trades: savedTrades });
    }

    // Get open positions for an account
    if (action === 'getPositions') {
      const { accountId } = req.body;
      if (!accountId) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing accountId' });
      }

      const providerName = (provider || 'TopstepX') as 'TopstepX';

      let token: string;
      try {
        token = (await ensureFreshProjectXToken(userId, providerName)).access_token;
      } catch (e) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ error: 'No ProjectX token found. Authenticate first.' });
      }

      const base = 'https://api.topstepx.com';
      const positionsUrl = `${base}/api/Position/searchOpen`;

      const resp = await fetch(positionsUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}`, 
          'accept': 'application/json' 
        },
        body: JSON.stringify({ accountId: parseInt(accountId) }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        res.setHeader('Content-Type', 'application/json');
        return res.status(resp.status).json({ error: 'Failed to fetch positions', details: text });
      }

      const data = await resp.json();
      
      // Response format: { positions: [...], success: true, errorCode: 0, errorMessage: null }
      if (!data.success) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: data.errorMessage || 'Position fetch failed' });
      }
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(data.positions || []);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Invalid request', source: 'projectx' });
  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
