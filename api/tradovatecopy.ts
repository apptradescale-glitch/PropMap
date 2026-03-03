import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import '../src/config/firebase-admin';

const db = getFirestore();

// Copy the same getValidToken function from tradovate.ts
async function getValidToken(userId: string, accountId: string, retryCount = 0) {
  const MAX_RETRIES = 3;
  const REFRESH_LOCK_MS = 30_000;
  const WAIT_ON_LOCK_MS = 2_000;
  const lockId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let tokenDocId: string | null = null; // Move this to function scope
  
  try {
    // ✅ FIX: First try to find which token document contains this accountId
    const tokensSnapshot = await db.collection('tradovateTokens')
      .where('userId', '==', userId)
      .get();
    
    let tokenDoc: any = null;
    
    // Find the token document that contains this accountId
    for (const doc of tokensSnapshot.docs) {
      const data = doc.data();
      if (data.accountIds && data.accountIds.includes(parseInt(accountId))) {
        tokenDoc = doc;
        tokenDocId = doc.id;
        break;
      }
    }
    
    if (!tokenDoc || !tokenDocId) {
      return null;
    }
    
    const tokenData = tokenDoc.data();
    const { access_token, refresh_token, expires_at, last_refresh_attempt } = tokenData!;
    
    if (!access_token || !refresh_token) {
      return null;
    }

    const now = Date.now();
    const bufferTime = 30 * 1000;
    const needsRefresh = !expires_at || (now + bufferTime) >= expires_at;
    
    if (!needsRefresh) {
      return access_token;
    }

    // Prevent concurrent refresh attempts (transaction lock)
    const tokenRef = db.collection('tradovateTokens').doc(tokenDocId);
    const lockAcquired = await db.runTransaction(async tx => {
      const snap = await tx.get(tokenRef);
      if (!snap.exists) return false;
      const data = snap.data() as any;
      const refreshLockUntil = typeof data.refresh_lock_until === 'number' ? data.refresh_lock_until : 0;

      if (refreshLockUntil && refreshLockUntil > now) return false;

      tx.update(tokenRef, {
        refresh_lock_until: now + REFRESH_LOCK_MS,
        refresh_lock_id: lockId,
        last_refresh_attempt: now,
        last_refresh_debug_id: debugId,
      });
      return true;
    });

    if (!lockAcquired) {
      await new Promise(resolve => setTimeout(resolve, WAIT_ON_LOCK_MS));
      if (retryCount < MAX_RETRIES) {
        return getValidToken(userId, accountId, retryCount + 1);
      }
      return null;
    }

    // Re-read latest token doc after acquiring the lock.
    const latestSnap = await tokenRef.get();
    const latestData = latestSnap.data() as any;
    if (!latestData?.access_token || !latestData?.refresh_token) {
      await tokenRef.update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
        refresh_failures: ((tokenData!.refresh_failures) || 0) + 1,
        last_error: 'Missing token data after lock',
        needs_reauth: ((tokenData!.refresh_failures) || 0) + 1 >= 3,
        last_refresh_debug_id: debugId,
      });
      return null;
    }

    const latestAccessToken = latestData.access_token as string;
    const latestRefreshToken = latestData.refresh_token as string;
    const latestExpiresAt = latestData.expires_at as number | undefined;

    const stillNeedsRefresh = !latestExpiresAt || (now + bufferTime) >= latestExpiresAt;
    if (!stillNeedsRefresh) {
      await tokenRef.update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
      });
      return latestAccessToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', process.env.TRADOVATE_CLIENT_ID as string);
    params.append('client_secret', process.env.TRADOVATE_CLIENT_SECRET as string);
    params.append('refresh_token', latestRefreshToken);

    const refreshRes = await fetch('https://demo.tradovateapi.com/auth/oauthtoken', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'TradescaleApp/1.0'
      },
      body: params.toString(),
    });

    const refreshData = await refreshRes.json();

    if (refreshData.error) {
      await db.collection('tradovateTokens').doc(tokenDocId).update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
        refresh_failures: ((tokenData!.refresh_failures) || 0) + 1,
        last_error: refreshData.error_description || refreshData.error,
        needs_reauth: ((tokenData!.refresh_failures) || 0) + 1 >= 3,
        last_refresh_debug_id: debugId,
        last_refresh_http_status: refreshRes.status,
        last_refresh_error_code: refreshData.error,
        last_refresh_error_description: refreshData.error_description || null,
      });
      return null;
    }

    // Tradovate endpoints are not always consistent about snake_case vs camelCase.
    const newAccessToken = refreshData.access_token ?? refreshData.accessToken;
    const rotatedRefreshToken = refreshData.refresh_token ?? refreshData.refreshToken;
    const newRefreshToken =
      typeof rotatedRefreshToken === 'string' && rotatedRefreshToken.trim() !== ''
        ? rotatedRefreshToken
        : latestRefreshToken;
    const newExpiresAt = now + ((refreshData.expires_in || 3600) * 1000);

    if (!newAccessToken || typeof newAccessToken !== 'string') {
      await db.collection('tradovateTokens').doc(tokenDocId).update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
        refresh_failures: ((tokenData!.refresh_failures) || 0) + 1,
        last_error: 'Refresh response missing access_token',
        needs_reauth: ((tokenData!.refresh_failures) || 0) + 1 >= 3,
        last_refresh_debug_id: debugId,
        last_refresh_http_status: refreshRes.status,
      });
      return null;
    }
    
    await db.collection('tradovateTokens').doc(tokenDocId).update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
      last_refreshed: now,
      last_refresh_attempt: null,
      refresh_lock_until: 0,
      refresh_lock_id: null,
      needs_reauth: false,
      last_error: null,
      refresh_failures: 0,
      last_refresh_debug_id: debugId,
      last_refresh_http_status: refreshRes.status,
      last_refresh_error_code: null,
      last_refresh_error_description: null,
      last_refresh_rotated: newRefreshToken !== latestRefreshToken,
    });
    
    return newAccessToken;
    
  } catch {
    
    try {
      if (tokenDocId) {
        await db.collection('tradovateTokens').doc(tokenDocId).update({
          last_refresh_attempt: null,
          refresh_lock_until: 0,
          refresh_lock_id: null
        });
      }
    } catch (clearError) {
      // Silent cleanup
    }
    
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return getValidToken(userId, accountId, retryCount + 1);
    }
    
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, userId, accountId } = req.body;
    
    if (!userId || !accountId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing userId or accountId' });
    }

    // ✅ CONDITIONAL AUTH: Only validate for actions that modify data
    let authenticatedUserId: string | null = null;
    let decodedToken: any = null;
    if (action !== 'getContract' && action !== 'getQuote') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(401).json({ error: 'Missing or invalid auth token', source: 'firebase_auth' });
      }

      const token = authHeader.substring(7);
      try {
          decodedToken = await admin.auth().verifyIdToken(token);
          authenticatedUserId = decodedToken.uid;
      } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(401).json({ error: 'Invalid or expired auth token', source: 'firebase_auth' });
      }

      // ✅ VERIFY USER OWNERSHIP (prevent unauthorized access)
      if (userId !== authenticatedUserId) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user', source: 'firebase_auth_user_mismatch' });
      }

      // ✅ VERIFY ACTIVE SUBSCRIPTION (Trade Copier is a premium feature, skip for admin UIDs)
        const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map((uid: string) => uid.trim()).filter(Boolean);
        const isAdmin = decodedToken?.admin === true || ADMIN_UIDS.includes(authenticatedUserId);

      if (!isAdmin) {
        try {
          const subscriptionDoc = await db.collection('subscriptions').doc(authenticatedUserId).get();
          const subscription = subscriptionDoc.data();

          if (!subscription?.hasSubscription || 
              subscription?.subscriptionStatus !== 'complete' || 
              subscription?.paymentStatus !== 'paid') {
            res.setHeader('Content-Type', 'application/json');
            return res.status(403).json({ 
              error: 'Active subscription required to access Trade Copier',
              requiresSubscription: true,
              source: 'subscription'
            });
          }

          // ✅ VERIFY TRADE COPIER ACCESS (not just basic AutoSync)
          const hasTradecopierAccess = ['pro', 'proplus'].includes(subscription?.subscriptionType);
          if (!hasTradecopierAccess) {
            res.setHeader('Content-Type', 'application/json');
            return res.status(403).json({ 
              error: 'Trade Copier subscription required. Please upgrade your plan.',
              requiresSubscription: true,
              currentPlan: subscription?.subscriptionType,
              source: 'subscription'
            });
          }
        } catch {
          res.setHeader('Content-Type', 'application/json');
          return res.status(500).json({ error: 'Failed to verify subscription status' });
        }
      }
    }
    
    // Get valid token using same logic as other files
    const access_token = await getValidToken(userId, accountId);
    if (!access_token) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ 
        error: 'No valid token',
        accountId: accountId,
        details: 'Token refresh failed or token needs re-authentication'
      });
    }

    // Handle different actions
    switch (action) {
      case 'getUserInfo':
        return await handleGetUserInfo(req, res, access_token);
      case 'getContract':
        return await handleGetContract(req, res, access_token);
        case 'findContract':
          return await handleFindContract(req, res, access_token);
      case 'placeOrder':
        return await handlePlaceOrder(req, res, access_token);
      case 'getFillsForOrder':
        return await handleGetFillsForOrder(req, res, access_token);
      case 'modifyOrder':
        return await handleModifyOrder(req, res, access_token);
      case 'cancelOrder':
        return await handleCancelOrder(req, res, access_token);
      case 'cancelAllOrders':
        return await handleCancelAllOrders(req, res, access_token, accountId);
      case 'closeAllPositions':
        return await handleCloseAllPositions(req, res, access_token, accountId);
      case 'flattenAllPositions':
        return await handleFlattenAllPositions(req, res, access_token, accountId);
      case 'getQuote':
        return await handleGetQuote(req, res, access_token);
      default:
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Invalid action' });
    }
    
  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Server error', 
      details: err.message
    });
  }
}

async function handleGetUserInfo(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  let userRes = await fetch('https://demo.tradovateapi.com/v1/user/list', {
    headers: { 
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!userRes.ok) {
    const errorText = await userRes.text();
    
    const accountRes = await fetch('https://demo.tradovateapi.com/v1/account/list', {
      headers: { 
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (accountRes.ok) {
      const accounts = await accountRes.json();
      
      if (accounts && accounts.length > 0) {
        const userId = accounts[0].userId;
        
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ 
          id: userId,
          name: accounts[0].name || 'Unknown',
          accounts: accounts,
          source: 'account_fallback'
        });
      }
    }
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(userRes.status).json({ 
      error: 'Failed to get user info', 
      details: errorText,
      status: userRes.status 
    });
  }

  const userData = await userRes.json();
  const userInfo = Array.isArray(userData) ? userData[0] : userData;
  
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(userInfo);
}

async function handleGetContract(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { contractId } = req.body;

  if (!contractId) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing contractId' });
  }

  try {
    const contractRes = await fetch(`https://demo.tradovateapi.com/v1/contract/item?id=${contractId}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (contractRes.ok) {
      const contractData = await contractRes.json();
      const symbol = contractData?.name ||
        contractData?.symbol ||
        contractData?.contractName ||
        contractData?.displayName ||
        contractData?.description ||
        `Contract_${contractId}`;

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        ...contractData,
        symbol,
        normalizedSymbol: symbol,
        contractId
      });
    }

    const errorText = await contractRes.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(contractRes.status).json({
      error: 'Failed to get contract info',
      details: errorText,
      contractId
    });
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Error fetching contract info',
      details: error.message,
      contractId
    });
  }
}

async function handleFindContract(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { symbol } = req.body;

  if (!symbol || typeof symbol !== 'string') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing symbol' });
  }

  // Tradovate docs:
  // - GET /contract/find?name=... returns a single Contract object
  // - GET /contract/suggest?t=...&l=... returns an array of Contract objects
  const findUrl = `https://demo.tradovateapi.com/v1/contract/find?name=${encodeURIComponent(symbol)}`;
  const suggestUrl = `https://demo.tradovateapi.com/v1/contract/suggest?t=${encodeURIComponent(symbol)}&l=20`;

  // 1) Try exact name lookup
  try {
    const contractRes = await fetch(findUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (contractRes.ok) {
      const contract: any = await contractRes.json();
      if (contract?.id) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          id: contract.id,
          name: contract.name,
          contract,
          source: 'find',
        });
      }
    }
  } catch {
    // fall through to suggest
  }

  // 2) Fallback to suggest (substring search)
  try {
    const suggestRes = await fetch(suggestUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (suggestRes.ok) {
      const list: any[] = await suggestRes.json();
      if (Array.isArray(list) && list.length) {
        const exact = list.find((c: any) => typeof c?.name === 'string' && c.name.toUpperCase() === symbol.toUpperCase());
        const contract = exact || list[0];
        if (contract?.id) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json({
            id: contract.id,
            name: contract.name,
            contract,
            source: 'suggest',
          });
        }
      }
    }
  } catch {
    // ignore
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({ error: 'Contract not found', symbol });
}

async function handleGetQuote(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { contractId } = req.body;
  if (!contractId) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing contractId' });
  }
  try {
    let tradePrice: number | null = null;
    const debugResponses: any[] = [];

    // Strategy 1: Tradovate md/getQuote (GET) — try demo then live
    for (const base of ['https://md-demo.tradovateapi.com', 'https://md.tradovateapi.com']) {
      try {
        const url = `${base}/v1/md/getQuote?id=${contractId}`;
        const mdRes = await fetch(url, {
          headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
        });
        const text = await mdRes.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = text; }
        debugResponses.push({ url, status: mdRes.status, data });
        if (mdRes.ok && data) {
          // Try various known response shapes
          const p = data?.entries?.Trade?.price ?? data?.trade?.price ?? data?.Trade?.price
            ?? data?.last ?? data?.lastPrice ?? data?.price ?? null;
          if (typeof p === 'number' && p > 0) { tradePrice = p; break; }
        }
      } catch { /* try next */ }
    }

    // Strategy 2: Tradovate md/subscribeQuote (POST) — some versions use POST body
    if (!tradePrice) {
      for (const base of ['https://md-demo.tradovateapi.com', 'https://md.tradovateapi.com']) {
        try {
          const url = `${base}/v1/md/subscribeQuote`;
          const mdRes = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ symbol: contractId }),
          });
          const text = await mdRes.text();
          let data: any;
          try { data = JSON.parse(text); } catch { data = text; }
          debugResponses.push({ url, status: mdRes.status, data });
          if (mdRes.ok && data) {
            const p = data?.entries?.Trade?.price ?? data?.trade?.price ?? data?.Trade?.price
              ?? data?.last ?? data?.lastPrice ?? data?.price ?? null;
            if (typeof p === 'number' && p > 0) { tradePrice = p; break; }
          }
        } catch { /* try next */ }
      }
    }

    // Strategy 3: Tradovate contract/item to get contract name for Yahoo Finance lookup
    let contractName: string | null = null;
    if (!tradePrice) {
      try {
        const url = `https://demo.tradovateapi.com/v1/contract/item?id=${contractId}`;
        const cRes = await fetch(url, {
          headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
        });
        const text = await cRes.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = text; }
        debugResponses.push({ url, status: cRes.status, data });
        if (data?.name) contractName = data.name;
      } catch { /* ignore */ }
    }

    // Strategy 4: Yahoo Finance API for NQ/ES/etc futures price (free, no auth needed)
    if (!tradePrice && contractName) {
      // Map Tradovate contract names to Yahoo Finance symbols
      // e.g. MNQH6 -> NQ=F (front month NQ), ESH6 -> ES=F
      const root = contractName.replace(/[A-Z]\d+$/i, ''); // strip month+year: MNQH6 -> MNQ
      const yahooSymbolMap: Record<string, string> = {
        'MNQ': 'NQ=F', 'NQ': 'NQ=F', 'MES': 'ES=F', 'ES': 'ES=F',
        'MCL': 'CL=F', 'CL': 'CL=F', 'MGC': 'GC=F', 'GC': 'GC=F',
        'MYM': 'YM=F', 'YM': 'YM=F', 'M2K': 'RTY=F', 'RTY': 'RTY=F',
        'MBT': 'BTC=F', 'BTC': 'BTC=F', 'MET': 'ETH=F', 'ETH': 'ETH=F',
        'ZB': 'ZB=F', 'ZN': 'ZN=F', 'ZF': 'ZF=F', 'ZT': 'ZT=F',
        '6E': 'EURUSD=X', '6J': 'JPYUSD=X', '6B': 'GBPUSD=X',
      };
      const yahooSym = yahooSymbolMap[root];
      if (yahooSym) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1m&range=1d`;
          const yRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const text = await yRes.text();
          let data: any;
          try { data = JSON.parse(text); } catch { data = text; }
          debugResponses.push({ url, status: yRes.status, dataKeys: data?.chart ? Object.keys(data.chart) : 'n/a' });
          const meta = data?.chart?.result?.[0]?.meta;
          const p = meta?.regularMarketPrice ?? meta?.previousClose ?? null;
          if (typeof p === 'number' && p > 0) tradePrice = p;
        } catch { /* ignore */ }
      }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ contractId, tradePrice, debug: debugResponses });
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Error getting quote', details: error.message });
  }
}

async function handlePlaceOrder(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { orderPayload } = req.body;
  
  if (!orderPayload) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing orderPayload' });
  }

  // Tradovate sometimes returns HTTP 200 with failureReason/failureText in body.
  // Validate a few expected fields early to make debugging easier.
  const accountId = (orderPayload as any)?.accountId;
  const contractId = (orderPayload as any)?.contractId;
  if (accountId == null || contractId == null) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({
      error: 'Invalid orderPayload: missing accountId/contractId',
      details: { accountId, contractId }
    });
  }

  try {
    const orderRes = await fetch('https://demo.tradovateapi.com/v1/order/placeorder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    if (orderRes.ok) {
      const orderResult: any = await orderRes.json();

      // ✅ Treat logical failures as errors even if HTTP 200
      if (orderResult?.failureReason || orderResult?.failureText) {
        res.setHeader('Content-Type', 'application/json');
        // 403 is a reasonable mapping for "Access is denied"
        return res.status(403).json({
          error: 'Order rejected by Tradovate',
          failureReason: orderResult?.failureReason,
          failureText: orderResult?.failureText,
          tradovate: orderResult
        });
      }

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(orderResult);
    } else {
      const errorText = await orderRes.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(orderRes.status).json({ 
        error: 'Failed to place order', 
        details: errorText 
      });
    }
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error placing order', 
      details: error.message 
    });
  }
}

// ✅ NEW: Cancel a single order
async function handleCancelOrder(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { orderId } = req.body;
  
  if (!orderId) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing orderId' });
  }

  try {
    const cancelResponse = await fetch('https://demo.tradovateapi.com/v1/order/cancelorder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId: orderId
      })
    });

    if (cancelResponse.ok) {
      const cancelResult = await cancelResponse.json();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        orderId,
        result: cancelResult
      });
    } else {
      const errorText = await cancelResponse.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(cancelResponse.status).json({ 
        error: 'Failed to cancel order', 
        orderId,
        details: errorText 
      });
    }
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error canceling order', 
      orderId,
      details: error.message 
    });
  }
}

// ✅ NEW: Modify an existing order
async function handleModifyOrder(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { orderId, modifyPayload } = req.body;
  
  if (!orderId || !modifyPayload) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing orderId or modifyPayload' });
  }

  try {
    const modifyResponse = await fetch('https://demo.tradovateapi.com/v1/order/modifyorder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId: orderId,
        ...modifyPayload
      })
    });

    if (modifyResponse.ok) {
      const modifyResult = await modifyResponse.json();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        orderId,
        result: modifyResult
      });
    } else {
      const errorText = await modifyResponse.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(modifyResponse.status).json({ 
        error: 'Failed to modify order', 
        orderId,
        details: errorText 
      });
    }
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error modifying order', 
      orderId,
      details: error.message 
    });
  }
}

// ✅ NEW: Cancel all pending orders for an account
async function handleCancelAllOrders(req: NextApiRequest, res: NextApiResponse, access_token: string, accountId: string) {
  try {
    // Get all working orders for this account
    const ordersResponse = await fetch('https://demo.tradovateapi.com/v1/order/list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: parseInt(accountId)
      })
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(ordersResponse.status).json({ 
        error: 'Failed to fetch orders', 
        details: errorText 
      });
    }

    const orders = await ordersResponse.json();
    
    // Filter for all non-completed order statuses
    // Check both orderStatus (API response) and ordStatus (WebSocket) fields
    const workingOrders = orders.filter((order: any) => {
      const status = order.orderStatus || order.ordStatus;
      return status === 'Working' || 
             status === 'Pending' || 
             status === 'PendingNew' ||
             status === 'Submitted' ||
             status === 'Queued' ||
             status === 'Suspended';
    });

    if (workingOrders.length === 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ 
        success: true,
        message: 'No pending orders found to cancel',
        canceledOrders: []
      });
    }

    const canceledOrders = [];
    const failedCancellations = [];

    // Cancel each working order
    for (const order of workingOrders) {
      try {
        const cancelResponse = await fetch('https://demo.tradovateapi.com/v1/order/cancelorder', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId: order.id
          })
        });

        if (cancelResponse.ok) {
          canceledOrders.push({
            orderId: order.id,
            orderType: order.orderType,
            status: order.orderStatus || order.ordStatus,
            success: true
          });
        } else {
          const errorText = await cancelResponse.text();
          failedCancellations.push({
            orderId: order.id,
            orderType: order.orderType,
            status: order.orderStatus || order.ordStatus,
            error: errorText
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (orderError: any) {
        failedCancellations.push({
          orderId: order.id,
          orderType: order.orderType,
          status: order.orderStatus || order.ordStatus,
          error: orderError.message
        });
      }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      totalOrders: workingOrders.length,
      canceledOrders,
      failedCancellations,
      message: `Canceled ${canceledOrders.length} orders, ${failedCancellations.length} failed`
    });

  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error canceling pending orders', 
      details: error.message 
    });
  }
}

// ✅ NEW: Close all open positions for an account
async function handleCloseAllPositions(req: NextApiRequest, res: NextApiResponse, access_token: string, accountId: string) {
  try {
    // Get all positions for this account
    const positionsResponse = await fetch('https://demo.tradovateapi.com/v1/position/list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: parseInt(accountId)
      })
    });

    if (!positionsResponse.ok) {
      const errorText = await positionsResponse.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(positionsResponse.status).json({ 
        error: 'Failed to fetch positions', 
        details: errorText 
      });
    }

    const positions = await positionsResponse.json();
    const openPositions = positions.filter((pos: any) => pos.netPos !== 0);

    if (openPositions.length === 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ 
        success: true,
        message: 'No open positions found to close',
        closedPositions: []
      });
    }

    const closedPositions = [];
    const failedClosures = [];

    // ✅ Use liquidatePosition endpoint for each position
    for (const position of openPositions) {
      try {
        // Use Tradovate's liquidatePosition endpoint (correct endpoint and parameters)
        const liquidateResponse = await fetch('https://demo.tradovateapi.com/v1/order/liquidateposition', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId: parseInt(accountId),
            contractId: position.contractId,
            admin: false // Set to false for non-admin liquidation
          })
        });

        if (liquidateResponse.ok) {
          const liquidateResult = await liquidateResponse.json();
          closedPositions.push({
            contractId: position.contractId,
            originalNetPos: position.netPos,
            liquidateResult,
            success: true
          });
        } else {
          const errorText = await liquidateResponse.text();
          
          // ✅ FALLBACK: If liquidatePosition fails, try manual market order
          
          const side = position.netPos > 0 ? 'Sell' : 'Buy';
          const quantity = Math.abs(position.netPos);

          const closeResponse = await fetch('https://demo.tradovateapi.com/v1/order/placeorder', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              accountSpec: accountId.toString(),
              accountId: parseInt(accountId),
              contractId: position.contractId,
              action: side,
              orderQty: quantity,
              orderType: 'Market',
              timeInForce: 'IOC' // Immediate or Cancel
            })
          });

          if (closeResponse.ok) {
            const orderResult = await closeResponse.json();
            closedPositions.push({
              contractId: position.contractId,
              side,
              quantity,
              orderId: orderResult.orderId,
              method: 'fallback_market_order',
              success: true
            });
          } else {
            const fallbackError = await closeResponse.text();
            failedClosures.push({
              contractId: position.contractId,
              originalNetPos: position.netPos,
              liquidateError: errorText,
              fallbackError: fallbackError,
              success: false
            });
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (positionError: any) {
        failedClosures.push({
          contractId: position.contractId,
          originalNetPos: position.netPos,
          error: positionError.message,
          success: false
        });
      }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      totalPositions: openPositions.length,
      closedPositions,
      failedClosures,
      message: `Liquidated ${closedPositions.length} positions, ${failedClosures.length} failed`
    });

  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error closing positions', 
      details: error.message 
    });
  }
}

// ✅ NEW: Flatten all positions - Cancel orders and close positions in sequence
async function handleFlattenAllPositions(req: NextApiRequest, res: NextApiResponse, access_token: string, accountId: string) {
  try {
    // Step 1: Cancel all pending orders
    const cancelResult = await handleCancelAllOrders(req, { 
      status: () => ({ json: (data: any) => data }),
      setHeader: () => {}
    } as any, access_token, accountId);
    
    // Step 2: Close all open positions  
    const closeResult = await handleCloseAllPositions(req, {
      status: () => ({ json: (data: any) => data }),
      setHeader: () => {}
    } as any, access_token, accountId);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      accountId,
      cancelResult,
      closeResult,
      message: 'Flatten operation completed'
    });

  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error during flatten operation', 
      details: error.message 
    });
  }
}

async function handleGetFillsForOrder(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { orderId } = req.body;
  const orderIdNum = Number(orderId);

  if (!Number.isFinite(orderIdNum)) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing or invalid orderId' });
  }

  try {
    const fillsRes = await fetch('https://demo.tradovateapi.com/v1/fill/list', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!fillsRes.ok) {
      const errorText = await fillsRes.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(fillsRes.status).json({ error: 'Failed to fetch fills', details: errorText });
    }

    const allFills: any[] = await fillsRes.json();
    const fills = (Array.isArray(allFills) ? allFills : []).filter(f => Number(f?.orderId) === orderIdNum);

    // Compute weighted avg price if we have qty/price.
    let totalQty = 0;
    let totalPxQty = 0;
    let lastPrice: number | undefined = undefined;

    for (const f of fills) {
      const px = Number(f?.price);
      const qty = Math.abs(Number(f?.qty ?? f?.fillQty ?? 0));
      if (Number.isFinite(px) && Number.isFinite(qty) && qty > 0) {
        totalQty += qty;
        totalPxQty += px * qty;
        lastPrice = px;
      }
    }

    const avgPrice = totalQty > 0 ? totalPxQty / totalQty : undefined;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      orderId: orderIdNum,
      fills,
      avgPrice,
      lastPrice
    });
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Error fetching fills', details: error?.message ?? String(error) });
  }
}