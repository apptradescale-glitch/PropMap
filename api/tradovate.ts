import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import crypto from 'crypto';
import { matchFillsToPositions } from '../src/pages/AutoSync/overview/view/Tradecalc';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

function toBase64Url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string) {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function getOauthStateSecret() {
  // Prefer a dedicated secret if you add one. Fallback to the Tradovate client secret.
  return process.env.TRADOVATE_OAUTH_STATE_SECRET || process.env.TRADOVATE_CLIENT_SECRET;
}

function createSignedOauthState(uid: string) {
  const secret = getOauthStateSecret();
  if (!secret) throw new Error('Missing TRADOVATE_OAUTH_STATE_SECRET/TRADOVATE_CLIENT_SECRET');
  const payload = {
    uid,
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64');
  const sigB64 = sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${payloadB64}.${sigB64}`;
}

function verifySignedOauthState(state: string, expectedUid: string, ttlMs: number) {
  const secret = getOauthStateSecret();
  if (!secret) return { ok: false as const, error: 'Missing server OAuth state secret' };

  const parts = state.split('.');
  if (parts.length !== 2) return { ok: false as const, error: 'Invalid state format' };
  const [payloadB64, sigB64] = parts;

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64');
  const expectedSigB64 = expectedSig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSigB64))) {
    return { ok: false as const, error: 'Invalid state signature' };
  }

  let payload: any;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64).toString('utf8'));
  } catch {
    return { ok: false as const, error: 'Invalid state payload' };
  }

  const uid = typeof payload?.uid === 'string' ? payload.uid : null;
  const iat = typeof payload?.iat === 'number' ? payload.iat : null;
  if (!uid || !iat) return { ok: false as const, error: 'Invalid state payload fields' };
  if (uid !== expectedUid) return { ok: false as const, error: 'OAuth state does not match authenticated user' };
  if (Date.now() - iat > ttlMs) return { ok: false as const, error: 'OAuth state expired' };

  return { ok: true as const };
}

function decodeJwtMeta(token?: string | null) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return { format: 'non-jwt' };
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
    const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
    const secondsToExpiry = exp != null ? exp - nowSec : undefined;
    return {
      exp,
      iat,
      secondsToExpiry,
      expired: secondsToExpiry != null ? secondsToExpiry <= 0 : undefined,
    };
  } catch {
    return { format: 'non-jwt' };
  }
}

const formatDate = (date: Date) => date.toISOString().split('T')[0];

// Enhanced token fetcher with 30-second buffer refresh (Tradovate best practice)
async function getValidToken(userId: string, accountId: string, retryCount = 0) {
  const MAX_RETRIES = 3;
  const REFRESH_LOCK_MS = 30_000;
  const WAIT_ON_LOCK_MS = 2_000;
  const lockId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  
  try {
    // ✅ FIX: First try to find which token document contains this accountId
    const tokensSnapshot = await db.collection('tradovateTokens')
      .where('userId', '==', userId)
      .get();
    
    let tokenDoc: any = null;
    let tokenDocId: string | null = null;
    
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
    let { access_token, refresh_token, expires_at, last_refresh_attempt } = tokenData!;
    
    if (!access_token || !refresh_token) {
   
      return null;
    }

    const now = Date.now();
    // Use 30-second buffer as recommended by Tradovate forum
    const bufferTime = 30 * 1000; // 30 seconds
    const needsRefresh = !expires_at || (now + bufferTime) >= expires_at;
    
    if (!needsRefresh) {
      const expiresInSeconds = Math.round((expires_at - now) / 1000);
   
      return access_token;
    }

    // Prevent concurrent refresh attempts (transaction lock)
    const tokenRef = db.collection('tradovateTokens').doc(tokenDocId);
    const lockAcquired = await db.runTransaction(async tx => {
      const snap = await tx.get(tokenRef);
      if (!snap.exists) return false;
      const data = snap.data() as any;
      const refreshLockUntil = typeof data.refresh_lock_until === 'number' ? data.refresh_lock_until : 0;

      // Someone else is refreshing. Wait + retry to pick up new tokens.
      if (refreshLockUntil && refreshLockUntil > now) return false;

      // Acquire lock for a short window.
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
    // Another request may have refreshed and released the lock quickly.
    const latestSnap = await tokenRef.get();
    const latestData = latestSnap.data() as any;
    if (!latestData?.access_token || !latestData?.refresh_token) {
      await tokenRef.update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
        last_error: 'Missing token data after lock',
        error_timestamp: now,
        last_refresh_debug_id: debugId,
      });
      return null;
    }

    access_token = latestData.access_token;
    refresh_token = latestData.refresh_token;
    expires_at = latestData.expires_at;

    const stillNeedsRefresh = !expires_at || (now + bufferTime) >= expires_at;
    if (!stillNeedsRefresh) {
      await tokenRef.update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
      });
      return access_token;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', process.env.TRADOVATE_CLIENT_ID as string);
    params.append('client_secret', process.env.TRADOVATE_CLIENT_SECRET as string);
    params.append('refresh_token', refresh_token);

    const refreshUrl = 'https://demo.tradovateapi.com/auth/oauthtoken';
    
    let refreshRes, refreshData;
    try {
 
      refreshRes = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'TradescaleApp/1.0'
        },
        body: params.toString(),
      });

      const refreshText = await refreshRes.text();
   
      
      if (!refreshRes.ok) {
        throw new Error(`HTTP ${refreshRes.status}: ${refreshText}`);
      }

      refreshData = JSON.parse(refreshText);
    } catch (fetchError) {
    
      
      // Clear the refresh lock on error
      await db.collection('tradovateTokens').doc(tokenDocId).update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
        last_refresh_debug_id: debugId,
      });
      
      // Retry on network errors with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
    
        await new Promise(resolve => setTimeout(resolve, delay));
        return getValidToken(userId, accountId, retryCount + 1);
      }
      
      return null;
    }

    // Handle Tradovate API errors
    if (refreshData.error) {
      // Clear the refresh lock on error
      await db.collection('tradovateTokens').doc(tokenDocId).update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null,
        last_refresh_debug_id: debugId,
        last_refresh_http_status: refreshRes?.status,
        last_refresh_error_code: refreshData.error,
        last_refresh_error_description: refreshData.error_description || null,
      });

      // Handle specific error types
      if (refreshData.error === 'invalid_grant' || 
          refreshData.error === 'invalid_token' || 
          refreshData.error === 'invalid_request') {
        
        const currentFailures = (tokenData?.refresh_failures || 0) + 1;
        
        // ✅ Mark as needing reauth after 3 failures
        await db.collection('tradovateTokens').doc(tokenDocId).update({
          last_error: refreshData.error_description || refreshData.error,
          error_timestamp: now,
          refresh_failures: currentFailures,
          needs_reauth: currentFailures >= 3,
          last_refresh_debug_id: debugId,
          last_refresh_http_status: refreshRes?.status,
          last_refresh_error_code: refreshData.error,
          last_refresh_error_description: refreshData.error_description || null,
        });
        
        return null;
      }

      // For temporary errors (rate limits, server errors), retry
      if (refreshData.error === 'temporarily_unavailable' || 
          refreshData.error === 'server_error' ||
          refreshRes.status >= 500) {
        
        if (retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      
          await new Promise(resolve => setTimeout(resolve, delay));
          return getValidToken(userId, accountId, retryCount + 1);
        }
      }
      
      return null;
    }

    // Successful refresh - save new tokens immediately

    // Tradovate endpoints are not always consistent about snake_case vs camelCase.
    const newAccessToken = refreshData.access_token ?? refreshData.accessToken;
    const rotatedRefreshToken = refreshData.refresh_token ?? refreshData.refreshToken;
    const newRefreshToken =
      typeof rotatedRefreshToken === 'string' && rotatedRefreshToken.trim() !== ''
        ? rotatedRefreshToken
        : refresh_token; // Preserve old if not provided
    const expiresInSeconds = refreshData.expires_in || 3600; // Default to 1 hour
    const newExpiresAt = now + (expiresInSeconds * 1000);

    if (!newAccessToken || typeof newAccessToken !== 'string') {
      await db.collection('tradovateTokens').doc(tokenDocId).update({
        last_error: 'Refresh response missing access_token',
        error_timestamp: now,
        refresh_lock_until: 0,
        refresh_lock_id: null,
        last_refresh_attempt: null,
        last_refresh_debug_id: debugId,
        last_refresh_http_status: refreshRes?.status,
      });
      return null;
    }
    
    // Save with comprehensive metadata
    await db.collection('tradovateTokens').doc(tokenDocId).update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
      last_refreshed: now,
      last_refresh_attempt: null, // Clear attempt marker
      refresh_lock_until: 0,
      refresh_lock_id: null,
      needs_reauth: false,
      last_error: null,
      refresh_count: (tokenData?.refresh_count || 0) + 1,
      refresh_failures: 0, // Reset failure count on success
      expires_in_seconds: expiresInSeconds,
      last_refresh_debug_id: debugId,
      last_refresh_http_status: refreshRes?.status,
      last_refresh_error_code: null,
      last_refresh_error_description: null,
      last_refresh_rotated: newRefreshToken !== refresh_token,
    });
    
    const expiresInMinutes = Math.round(expiresInSeconds / 60);

    
    return newAccessToken;
    
  } catch (err: any) {

    
    // Clear any refresh lock on unexpected error (if we found a token doc)
    try {
      const tokensSnapshot = await db.collection('tradovateTokens')
        .where('userId', '==', userId)
        .get();
      for (const doc of tokensSnapshot.docs) {
        const data = doc.data();
        if (data.accountIds && data.accountIds.includes(parseInt(accountId))) {
          await db.collection('tradovateTokens').doc(doc.id).update({
            last_refresh_attempt: null,
            refresh_lock_until: 0,
            refresh_lock_id: null,
          });
          break;
        }
      }
    } catch {
      // ignore
    }
    
    // Retry on unexpected errors with exponential backoff
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

    // Prevent caching of any response from this endpoint (may include sensitive data)
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');


    if (req.method !== 'POST') {
   
      res.setHeader('Content-Type', 'application/json');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ✅ VERIFY AUTH TOKEN (SECURITY)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Missing or invalid auth token', source: 'firebase_auth' });
    }

    const token = authHeader.substring(7);
    let authenticatedUserId: string;
    let decodedToken: any;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      authenticatedUserId = decodedToken.uid;
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Invalid or expired auth token', source: 'firebase_auth' });
    }

    const { code, action, userId, accountId, account, state } = req.body;

    // ✅ VERIFY USER OWNERSHIP (for actions that need userId)
    // ✅ VERIFY USER OWNERSHIP (for actions that include userId)
    // Never allow a caller to write/read another user's data by passing a different userId.
    if (userId && userId !== authenticatedUserId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }

    // ✅ VERIFY ACTIVE SUBSCRIPTION (for premium actions)
    // Skip subscription check only for Tradovate OAuth connect/exchange actions and for admin UIDs
    const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map((uid: string) => uid.trim()).filter(Boolean);
    const isAdmin = decodedToken?.admin === true || ADMIN_UIDS.includes(authenticatedUserId);

    const isTradovateOAuthAction = action === 'oauth/start' || action === 'oauth/exchange' || action === 'oauth/callback';

    // --- NEW: OAuth start (issue state + return authorization URL) ---
    // This must run BEFORE subscription gating.
    if (action === 'oauth/start') {
      // Signed, short-lived state binds the OAuth flow to this authenticated user
      // without leaving behind Firestore documents if the user abandons the login.
      let oauthState: string;
      try {
        oauthState = createSignedOauthState(authenticatedUserId);
      } catch (e: any) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: e?.message || 'Failed to create OAuth state' });
      }

      const clientId = process.env.TRADOVATE_CLIENT_ID as string;
      if (!clientId) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Missing TRADOVATE_CLIENT_ID' });
      }

      const redirectUri = 'https://www.tradescale.app/oauth/callback';
      const authUrl = `https://trader.tradovate.com/oauth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(oauthState)}`;

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ authUrl, state: oauthState });
    }

    if (!isTradovateOAuthAction && userId && !isAdmin) {
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

    // --- NEW: Check token health ---
    if (action === 'checkTokenHealth' && userId) {
    
      
      try {
        const snapshot = await db.collection('tradovateTokens')
          .where('userId', '==', userId)
          .where('needs_reauth', '==', true)
          .get();

        const expiredAccounts = snapshot.docs.flatMap(doc => {
          const data = doc.data();
          const accountIds: number[] = Array.isArray(data.accountIds) ? data.accountIds : [];
          const accountNames: any[] = Array.isArray(data.accountNames) ? data.accountNames : [];
          const lastError = data.last_error;

          // Return one entry per account within this token document.
          return accountIds.map((accountId, index) => ({
            accountId,
            accountName: String(accountNames[index] ?? ''),
            lastError,
            tokenDocId: doc.id,
          }));
        }).map(a => ({
          ...a,
          accountName: a.accountName?.trim() ? a.accountName : 'Unknown',
        }));

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ 
          needsReauth: expiredAccounts.length > 0,
          expiredAccounts
        });
      } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Failed to check token health' });
      }
    }

    // --- NEW: Remove token ---
    if (action === 'removeToken' && userId && accountId) {
      try {
        
        // ✅ FIX: Find token document that contains this accountId
        const tokensSnapshot = await db.collection('tradovateTokens')
          .where('userId', '==', userId)
          .get();
        
        let tokenDoc: any = null;
        let tokenDocId: string | null = null;
        
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
          res.setHeader('Content-Type', 'application/json');
          return res.status(404).json({ 
            error: `No token found for account ${accountId}`,
            success: false
          });
        }
        
        const tokenData = tokenDoc.data();
        const currentAccountIds = tokenData.accountIds || [];
        const currentAccountNames = tokenData.accountNames || [];
        
        // Remove the accountId from the arrays
        const updatedAccountIds = currentAccountIds.filter((id: number) => id !== parseInt(accountId));
        const accountIndex = currentAccountIds.indexOf(parseInt(accountId));
        const updatedAccountNames = accountIndex >= 0 && currentAccountNames.length > accountIndex
          ? currentAccountNames.filter((_: any, index: number) => index !== accountIndex)
          : currentAccountNames;
        
        // If this was the only account, delete the entire token document
        if (updatedAccountIds.length === 0) {
          await db.collection('tradovateTokens').doc(tokenDocId).delete();
          
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json({ 
            success: true,
            action: 'token_deleted',
            message: `Token document deleted - account ${accountId} was the last account in this token`
          });
        } else {
          // Update the token document to remove this accountId
          await db.collection('tradovateTokens').doc(tokenDocId).update({
            accountIds: updatedAccountIds,
            accountNames: updatedAccountNames
          });
          
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json({ 
            success: true,
            action: 'account_removed',
            message: `Account ${accountId} removed from token (${updatedAccountIds.length} accounts remaining)`,
            remainingAccounts: updatedAccountIds.length
          });
        }
      } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ 
          error: 'Failed to remove token',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'updateBalance' && userId && accountId) {

  
  try {
    const { balance } = req.body;
    
    if (balance === undefined) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Balance is required' });
    }
    
    // Find and update the finance document
    const financeQuery = await db.collection('finances')
      .where('userId', '==', userId)
      .where('accountId', '==', accountId)
      .limit(1)
      .get();
    
    if (!financeQuery.empty) {
      const financeDoc = financeQuery.docs[0];
      const oldBalance = financeDoc.data().balance || 0;
      const newBalance = parseFloat(balance);
      
      await financeDoc.ref.update({
        balance: newBalance,
        lastBalanceUpdate: Date.now(),
        updateSource: 'sync_button',
        balanceChange: newBalance - oldBalance
      });
      

      
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        success: true,
        oldBalance,
        newBalance,
        balanceChange: newBalance - oldBalance
      });
    } else {

      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Finance record not found' });
    }
    
  } catch (error) {

    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Failed to update balance',
      details: error.message 
    });
  }
}

    // 1. Exchange code for tokens and store in Firestore
    // 1. Exchange code for tokens and store in Firestore (OAuth exchange)
    // NOTE: This must always bind writes to the authenticated UID (never trust userId from the client).
    if ((action === 'oauth/exchange' || action === 'oauth/callback') && code) {
      const effectiveUserId = authenticatedUserId;
      const providedState = typeof state === 'string' ? state : null;
      if (!providedState) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing OAuth state', source: 'oauth_state' });
      }

      // Validate state: signature OK, UID matches, not expired.
      const STATE_TTL_MS = 10 * 60 * 1000;
      const stateCheck = verifySignedOauthState(providedState, effectiveUserId, STATE_TTL_MS);
      if (!stateCheck.ok) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: stateCheck.error || 'Invalid OAuth state', source: 'oauth_state' });
      }
  
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', process.env.TRADOVATE_CLIENT_ID as string);
      params.append('client_secret', process.env.TRADOVATE_CLIENT_SECRET as string);
      params.append('redirect_uri', 'https://www.tradescale.app/oauth/callback');
      params.append('code', code);

      const tokenUrl = 'https://demo.tradovateapi.com/auth/oauthtoken';

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const tokenData = await tokenRes.json();


      if (tokenData.error) {
  
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: tokenData.error_description || tokenData.error, source: 'token_exchange', details: tokenData });
      }

      // Fetch all accounts for this user
      const accRes = await fetch('https://demo.tradovateapi.com/v1/account/list', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const accounts = await accRes.json();

      // ✅ FIX: Support multiple firms per user by detecting account overlap
      const newAccountIds = accounts.map(a => a.id);
      const newAccountNames = accounts.map(a => a.name);
      
      // Find existing token that overlaps with these accounts (same firm/credentials)
      const existingTokens = await db.collection('tradovateTokens')
        .where('userId', '==', effectiveUserId)
        .get();
      
      let tokenDocId: string | null = null;
      
      for (const doc of existingTokens.docs) {
        const data = doc.data();
        const existingAccountIds = data.accountIds || [];
        
        // Check if there's any overlap - if yes, same firm/credentials
        const hasOverlap = existingAccountIds.some((id: number) => newAccountIds.includes(id));
        
        if (hasOverlap) {
          tokenDocId = doc.id;
          break;
        }
      }
      
      // No existing token for this firm, create new one with unique ID
      if (!tokenDocId) {
        tokenDocId = `${effectiveUserId}_tradovate_${Date.now()}`;
        await db.collection('tradovateTokens').doc(tokenDocId).set({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + tokenData.expires_in * 1000,
          expires_in_seconds: tokenData.expires_in,
          userId: effectiveUserId,
          // Store all account IDs that this token can access
          accountIds: newAccountIds,
          accountNames: newAccountNames,
          created_at: Date.now(),
          refresh_count: 0,
          refresh_failures: 0,
          needs_reauth: false,
          last_error: null
        });
      } else {
        // Same firm detected (account overlap) - update with new tokens & account list
        await db.collection('tradovateTokens').doc(tokenDocId).update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + tokenData.expires_in * 1000,
          expires_in_seconds: tokenData.expires_in,
          accountIds: newAccountIds,
          accountNames: newAccountNames,
          needs_reauth: false,
          last_error: null,
          last_reconnected_at: Date.now()
        });
      }

      // ✅ NEW: Build orderIdToAccountMap FIRST by fetching orders for all accounts
      // This is the key: orders properly scope by account, fills do not
      const orderIdToAccountMap: Record<number, number> = {};
      for (const acc of accounts) {
        try {
          const ordersRes = await fetch(`https://demo.tradovateapi.com/v1/order/list?accountId=${acc.id}`, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (ordersRes.ok) {
            const allOrders = await ordersRes.json();
            
            // 🔍 FIX: Filter orders by order.accountId to prevent cross-account contamination
            const accountSpecificOrders = allOrders.filter((order: any) => order.accountId === acc.id);
            
            // Map each orderId to this account
            for (const order of accountSpecificOrders) {
              if (order.id) {
                orderIdToAccountMap[order.id] = acc.id;
              }
            }
          }
        } catch (err) {
        }
      }

      // ✅ Fetch ALL fills once (not per-account, since they're all mixed anyway)
      let allFills: any[] = [];
      try {
        const fillsRes = await fetch('https://demo.tradovateapi.com/v1/fill/list', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (fillsRes.ok) {
          allFills = await fillsRes.json();
        }
      } catch (err) {
      }

      // ✅ Now process each account
      for (const acc of accounts) {

        // Fetch cash balance for each account
        let balance = null;
        try {
          const balanceUrl = `https://demo.tradovateapi.com/v1/cashBalance/getcashbalancesnapshot?accountId=${acc.id}`;
          const balanceRes = await fetch(balanceUrl, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          if (balanceRes.ok) {
            const balanceData = await balanceRes.json();
            balance = balanceData?.totalCashValue ?? null;
          }
        } catch (err) {
      
        }

        // ✅ Filter fills to only those belonging to this account
        // CRITICAL: Use BOTH fill.accountId AND orderIdToAccountMap for double verification
        let fills = allFills.filter((fill: any) => {
          const fillAccountId = fill.accountId; // Primary check: direct account ID from API
          const orderMappedAccountId = orderIdToAccountMap[fill.orderId]; // Secondary check: from order map
          
          // Accept if either matches this account
          const belongsToThisAccount = fillAccountId === acc.id || orderMappedAccountId === acc.id;
          
          return belongsToThisAccount;
        });

        // --- Attach contract info to fills ---
        // 1. Collect contractIds
        const contractIds = new Set();
        fills.forEach(fill => {
          if (fill.contractId) contractIds.add(fill.contractId);
        });

        // 2. Fetch contract details
        const contractDetails: Record<number, any> = {};
        for (const contractId of contractIds) {
          try {
            const contractRes = await fetch(`https://demo.tradovateapi.com/v1/contract/item?id=${contractId}`, {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (contractRes.ok) {
              const contract = await contractRes.json();
              contractDetails[contractId] = contract;
            }
          } catch (err) {
        
          }
        }

        // 3. Attach contract info to each fill
        fills = fills.map(fill => ({
          ...fill,
          contract: contractDetails[fill.contractId] || null,
        }));

        // --- Save fills to tradovateFills collection with duplicate check ---
        for (const fill of fills) {
          try {
            // Duplicate prevention: check for any fill with same userId and orderId
          const existing = await db.collection('tradovateFills')
    .where('userId', '==', effectiveUserId)
  .where('accountId', '==', acc.id)
  .where('orderId', '==', fill.orderId)
  .get();
            if (!existing.empty) continue;
            await db.collection('tradovateFills').add({
                userId: effectiveUserId,
              accountId: acc.id,
              ...fill,
            });
          } catch (err) {
          }
        }

        // --- Save closed positions to 'trades' collection with duplicate check ---
        try {
          const fillsSnapshot = await db.collection('tradovateFills')
            .where('userId', '==', effectiveUserId)
            .where('accountId', '==', acc.id)
            .get();
          const allFills = fillsSnapshot.docs.map(doc => doc.data());

          let firm: string | null = null;
          try {
            const financeSnap = await db.collection('finances').doc(String(acc.id)).get();
            const finance = financeSnap.exists ? financeSnap.data() : null;
            firm = typeof (finance as any)?.firm === 'string' ? String((finance as any).firm) : null;
          } catch {}

          const closedPositions = matchFillsToPositions(allFills, false, { firm });

          for (const pos of closedPositions) {
            // Duplicate check for trades
            const tradeSymbol = pos.symbol ?? (pos.contract?.symbol ?? "");
            const tradeDate = pos.date && !isNaN(Date.parse(pos.date))
              ? formatDate(new Date(pos.date))
              : formatDate(new Date());
            const entryTime = pos.entryTime ?? "";
            const exitTime = pos.exitTime ?? "";

            const existingTrade = await db.collection('trades')
              .where('userId', '==', effectiveUserId)
              .where('accountId', '==', acc.id)
              .where('symbol', '==', tradeSymbol)
              .where('date', '==', tradeDate)
              .where('entryTime', '==', entryTime)
              .where('exitTime', '==', exitTime)
              .get();

            if (!existingTrade.empty) {
       
              continue;
            }

            await db.collection('trades').add({
              userId: effectiveUserId,
              accountId: acc.id,
              symbol: tradeSymbol,
              date: tradeDate,
              account: acc.name ?? acc.id,
              ...pos,
            });
          }
        } catch (err) {
       
        }

        // Save account info with the fetched balance (first connect: write all fields)
        await db.collection('finances').doc(acc.id.toString()).set({
          balance,
          firm: "",
          id: acc.id,
          name: acc.name,
          platform: "Tradovate",
          type: "Account",
          userId: effectiveUserId,
          accountId: acc.id,
        });
      }

      res.setHeader('Content-Type', 'application/json');
        // Do NOT return token exchange payloads to the client.
        // Tokens are stored server-side in Firestore and should not be exposed to the browser.
        return res.status(200).json({ success: true });
    }

      // Never return Tradovate access tokens to the browser.
      // Kept for compatibility: respond with an error instructing callers to use server-side endpoints.
      if (action === 'getToken') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(410).json({
          error: 'getToken is deprecated: access tokens are server-side only',
          source: 'security',
          action: 'getToken'
        });
      }

      // Narrow exception: Tradovate WebSocket auth requires an access token in the client.
      // Prefer migrating to a server-side websocket proxy or polling model if you want tokens fully server-only.
      if (action === 'getWebsocketToken' && userId && accountId) {
        // Extra gate: only allow for TradeCopier-eligible subscriptions (or admins).
        // This reduces the blast radius of the only remaining client-visible token flow.
        if (!isAdmin) {
          try {
            const subscriptionDoc = await db.collection('subscriptions').doc(authenticatedUserId).get();
            const subscription = subscriptionDoc.data();

            const isActive = !!subscription?.hasSubscription &&
              subscription?.subscriptionStatus === 'complete' &&
              subscription?.paymentStatus === 'paid';
            const hasTradecopierAccess = ['pro', 'proplus'].includes(String(subscription?.subscriptionType || '').toLowerCase());

            if (!isActive || !hasTradecopierAccess) {
              res.setHeader('Content-Type', 'application/json');
              return res.status(403).json({
                error: 'Trade Copier subscription required',
                requiresSubscription: true,
                source: 'subscription',
                action: 'getWebsocketToken'
              });
            }
          } catch {
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({ error: 'Failed to verify subscription status', source: 'subscription', action: 'getWebsocketToken' });
          }
        }

        const access_token = await getValidToken(userId, accountId);
        if (!access_token) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(404).json({ error: 'Token not found or needs re-authentication', source: 'tradovate_token', action: 'getWebsocketToken' });
        }

        // Best-effort audit trail (no blocking if it fails).
        try {
          const now = Date.now();
          const tokensSnapshot = await db.collection('tradovateTokens')
            .where('userId', '==', userId)
            .get();

          for (const doc of tokensSnapshot.docs) {
            const data = doc.data() as any;
            if (Array.isArray(data.accountIds) && data.accountIds.includes(parseInt(String(accountId), 10))) {
              await doc.ref.update({
                last_websocket_token_issued_at: now,
                websocket_token_issue_count: (typeof data.websocket_token_issue_count === 'number' ? data.websocket_token_issue_count : 0) + 1,
              }).catch(() => {});
              break;
            }
          }
        } catch {
          // ignore
        }

        res.setHeader('Content-Type', 'application/json');
        // Prevent caching (defense-in-depth)
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ access_token });
      }

      // Ensure a valid token exists (refresh if needed) WITHOUT returning it.
      if (action === 'ensureToken' && userId && accountId) {
        const access_token = await getValidToken(userId, accountId);
        if (!access_token) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(404).json({ error: 'Token not found or needs re-authentication', source: 'tradovate_token', action: 'ensureToken' });
        }

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ ok: true });
      }

    // Enhanced account action with better error handling
    if (userId && accountId && action === 'account') {
    
      
      const access_token = await getValidToken(userId, accountId);
      if (!access_token) {
     
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ 
          error: 'No valid token', 
          accountId: accountId,
          details: 'Token refresh failed or token needs re-authentication'
        });
      }
      
   

      const accUrl = 'https://demo.tradovateapi.com/v1/account/list';
  
      const accRes = await fetch(accUrl, {
        headers: { Authorization: `Bearer ${access_token}` },
      });


      const accText = await accRes.text();
   

      if (!accRes.ok) {
     
        res.setHeader('Content-Type', 'application/json');
        return res.status(accRes.status).json({
          error: 'Tradovate account API error',
          status: accRes.status,
          statusText: accRes.statusText,
          details: accText,
          source: 'account_list',
          environment: 'demo'
        });
      }

      let accounts;
      try {
        accounts = JSON.parse(accText);
        // Only process the requested accountId
        if (Array.isArray(accounts)) {
          const filteredAccounts = accounts.filter(acc => acc.id?.toString() === accountId?.toString());
          const processedAccounts = [];

          // ✅ NEW: Build orderIdToAccountMap for the requested account
          const orderIdToAccountMapSync: Record<number, number> = {};
          for (const acc of filteredAccounts) {
            try {
              const ordersRes = await fetch(`https://demo.tradovateapi.com/v1/order/list?accountId=${acc.id}`, {
                headers: { Authorization: `Bearer ${access_token}` },
              });
              if (ordersRes.ok) {
                const allOrders = await ordersRes.json();
                
                // 🔍 FIX: Filter orders by order.accountId to prevent cross-account contamination
                const accountSpecificOrders = allOrders.filter((order: any) => order.accountId === acc.id);
                
                for (const order of accountSpecificOrders) {
                  if (order.id) {
                    orderIdToAccountMapSync[order.id] = acc.id;
                  }
                }
              }
            } catch (err) {
            }
          }

          // ✅ Fetch ALL fills once
          let allFillsSync: any[] = [];
          try {
            const fillsRes = await fetch('https://demo.tradovateapi.com/v1/fill/list', {
              headers: { Authorization: `Bearer ${access_token}` },
            });
            if (fillsRes.ok) {
              allFillsSync = await fillsRes.json();
            }
          } catch (err) {}

          for (const acc of filteredAccounts) {
            // ✅ Filter fills to only those belonging to this account using orderIdToAccountMapSync
            let fills = allFillsSync.filter((fill: any) => {
              const fillAccountId = orderIdToAccountMapSync[fill.orderId];
              return fillAccountId === acc.id;
            });

            // --- Attach contract info to fills ---
            const contractIds = new Set<number>();
            fills.forEach((fill: any) => {
              if (fill.contractId) contractIds.add(Number(fill.contractId));
            });
            const contractDetails: Record<number, any> = {};
            for (const contractId of contractIds) {
              try {
                const contractRes = await fetch(`https://demo.tradovateapi.com/v1/contract/item?id=${contractId}`, {
                  headers: { Authorization: `Bearer ${access_token}` },
                });
                if (contractRes.ok) {
                  const contract = await contractRes.json();
                  contractDetails[contractId] = contract;
                }
              } catch (err) {}
            }
            fills = fills.map((fill: any) => ({
              ...fill,
              contract: contractDetails[fill.contractId] || null,
            }));

            // --- Save fills to tradovateFills collection with duplicate check ---
            for (const fill of fills) {
              try {
                // Global duplicate prevention: check for userId, orderId, timestamp, id
              const existing = await db.collection('tradovateFills')
  .where('userId', '==', userId)
  .where('accountId', '==', acc.id)
  .where('orderId', '==', fill.orderId)
  .where('timestamp', '==', fill.timestamp)
  .where('id', '==', fill.id)
  .get();
                if (!existing.empty) continue;
                await db.collection('tradovateFills').add({
                  userId,
                  accountId: acc.id,
                  ...fill,
                });
              } catch (err) {}
            }

            // Fetch cash balance snapshot
            let balance = null;
            try {
              const balanceUrl = `https://demo.tradovateapi.com/v1/cashBalance/getcashbalancesnapshot?accountId=${acc.id}`;
              const balanceRes = await fetch(balanceUrl, {
                headers: { Authorization: `Bearer ${access_token}` },
              });
              if (balanceRes.ok) {
                const balanceData = await balanceRes.json();
                acc.balance = balanceData?.totalCashValue ?? null;
                acc.realizedPnL = balanceData?.realizedPnL ?? 0;
              } else {
                acc.balance = null;
                acc.realizedPnL = 0;
              }
            } catch (err) {
              acc.balance = null;
              acc.realizedPnL = 0;
            }

            // --- Save closed positions to 'trades' collection with duplicate check ---
            try {
              const fillsSnapshot = await db.collection('tradovateFills')
                .where('userId', '==', userId)
                .where('accountId', '==', acc.id)
                .get();
              const allFills = fillsSnapshot.docs.map(doc => doc.data());

              let firm: string | null = null;
              try {
                const financeSnap = await db.collection('finances').doc(String(acc.id)).get();
                const finance = financeSnap.exists ? financeSnap.data() : null;
                firm = typeof (finance as any)?.firm === 'string' ? String((finance as any).firm) : null;
              } catch {}

              const closedPositions = matchFillsToPositions(allFills, false, { firm });
              for (const pos of closedPositions) {
                // Duplicate check for trades
                const tradeSymbol = pos.symbol ?? (pos.contract?.symbol ?? "");
                const tradeDate = pos.date && !isNaN(Date.parse(pos.date))
                  ? formatDate(new Date(pos.date))
                  : formatDate(new Date());
                const entryTime = pos.entryTime ?? "";
                const exitTime = pos.exitTime ?? "";
                const existingTrade = await db.collection('trades')
                  .where('userId', '==', userId)
                  .where('accountId', '==', acc.id)
                  .where('symbol', '==', tradeSymbol)
                  .where('date', '==', tradeDate)
                  .where('entryTime', '==', entryTime)
                  .where('exitTime', '==', exitTime)
                  .get();
                if (!existingTrade.empty) continue;
                await db.collection('trades').add({
                  userId,
                  accountId: acc.id,
                  symbol: tradeSymbol,
                  date: tradeDate,
                  account: acc.name ?? acc.id,
                  ...pos,
                });
              }
            } catch (err) {}

            // Save account info with the fetched balance (sync: update only balance, preserve other fields)
            const docRef = db.collection('finances').doc(acc.id.toString());
            const docSnap = await docRef.get();
            let existing = docSnap.exists ? docSnap.data() : {};
            await docRef.set({
              ...existing,
              balance: acc.balance,
              realizedPnL: acc.realizedPnL,
            });
            processedAccounts.push(acc);
          }
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json({ accounts: processedAccounts });
        }
      } catch (parseErr) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Error parsing account API response', details: accText, source: 'account_list_parse' });
      }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Invalid request', source: 'handler' });
  } catch (err: any) {

    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Server error', details: err.message, source: 'server' });
  }
}