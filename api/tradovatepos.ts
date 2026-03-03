import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import '../src/config/firebase-admin';

const db = getFirestore();

// Token fetcher with refresh logic
async function getValidToken(userId: string, accountId: string, retryCount = 0) {
  const MAX_RETRIES = 3;
  const REFRESH_LOCK_MS = 30_000;
  const WAIT_ON_LOCK_MS = 2_000;
  const lockId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let tokenDocId: string | null = null;
  
  try {
    // Find which token document contains this accountId
    const tokensSnapshot = await db.collection('tradovateTokens')
      .where('userId', '==', userId)
      .get();
    
    let tokenDoc: any = null;
    
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
      }).catch(() => {});
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
      }).catch(() => {});
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
      }).catch(() => {});
      return null;
    }
    
    await db.collection('tradovateTokens').doc(tokenDocId).update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: newExpiresAt,
      last_refresh_attempt: null,
      refresh_lock_until: 0,
      refresh_lock_id: null,
      refresh_failures: 0,
      needs_reauth: false,
      last_error: null,
      last_refresh_debug_id: debugId,
      last_refresh_http_status: refreshRes.status,
      last_refresh_error_code: null,
      last_refresh_error_description: null,
      last_refresh_rotated: newRefreshToken !== latestRefreshToken,
    });

    return newAccessToken;
  } catch {
    if (tokenDocId) {
      await db.collection('tradovateTokens').doc(tokenDocId).update({
        last_refresh_attempt: null,
        refresh_lock_until: 0,
        refresh_lock_id: null
      }).catch(() => {});
    }
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, accountId } = req.body;

    if (!userId || !accountId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing userId or accountId' });
    }

    // Verify Firebase auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Missing or invalid authorization header', source: 'firebase_auth' });
    }

    const token = authHeader.split('Bearer ')[1];
    let authenticatedUserId: string;
    let decodedToken: any;

    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      authenticatedUserId = decodedToken.uid;
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Invalid or expired auth token', source: 'firebase_auth' });
    }

    // Verify user ownership
    if (userId !== authenticatedUserId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user', source: 'firebase_auth_user_mismatch' });
    }

    // Verify active subscription (skip for admins)
    const adminUids = (process.env.ADMIN_UIDS || '')
      .split(',')
      .map((uid: string) => uid.trim())
      .filter(Boolean);
    const isAdmin = decodedToken?.admin === true || adminUids.includes(authenticatedUserId);

    if (!isAdmin) {
      try {
        const subscriptionDoc = await db.collection('subscriptions').doc(authenticatedUserId).get();
        const subscription = subscriptionDoc.data();

        if (!subscription?.hasSubscription || 
            subscription?.subscriptionStatus !== 'complete' || 
            subscription?.paymentStatus !== 'paid') {
          res.setHeader('Content-Type', 'application/json');
          return res.status(403).json({ 
            error: 'Active subscription required to access this feature',
            requiresSubscription: true,
            source: 'subscription'
          });
        }
      } catch {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Failed to verify subscription status' });
      }
    }

    // Get valid token
    const access_token = await getValidToken(userId, accountId);
    if (!access_token) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ 
        error: 'No valid token',
        accountId: accountId,
        details: 'Token refresh failed or token needs re-authentication',
        source: 'tradovate_token'
      });
    }

    // Fetch positions from Tradovate
    const positionsUrl = `https://demo.tradovateapi.com/v1/position/list`;
    const positionsRes = await fetch(positionsUrl, {
      headers: { 
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!positionsRes.ok) {
      const errorText = await positionsRes.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(positionsRes.status).json({ 
        error: 'Failed to fetch positions from Tradovate', 
        details: errorText 
      });
    }

    const allPositions = await positionsRes.json();
    
    // Filter positions for this specific account
    // Only include positions with non-zero netPos (open positions)
    const accountPositions = allPositions.filter((pos: any) => 
      pos.accountId === parseInt(accountId) && 
      pos.netPos !== 0
    );

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(accountPositions);

  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Server error', 
      details: err.message
    });
  }
}
