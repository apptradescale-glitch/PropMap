const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ VERIFY AUTH TOKEN (SECURITY)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid auth token' });
  }

  const token = authHeader.substring(7);
  let authenticatedUserId;
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
    authenticatedUserId = decodedToken.uid;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }

  const { userId, trade } = req.body;

  if (!userId || !trade) {
    return res.status(400).json({ error: 'Missing userId or trade' });
  }

  // ✅ VERIFY USER OWNERSHIP
  if (userId !== authenticatedUserId) {
    return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
  }

  // ✅ VERIFY ACTIVE SUBSCRIPTION (skip for admin UIDs and free plan users)
  const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(uid => uid.trim()).filter(Boolean);
  const isAdmin = decodedToken?.admin === true || ADMIN_UIDS.includes(authenticatedUserId);

  if (!isAdmin) {
    try {
      const subscriptionDoc = await db.collection('subscriptions').doc(authenticatedUserId).get();
      const subscription = subscriptionDoc.data();

      // Allow if: has active paid subscription OR has free plan with freedefalutl=true
      const hasFreePlan = await db.collection('FREEPLAN').doc(authenticatedUserId).get().then(doc => doc.data()?.freedefalutl === true);
      
      const hasPaidSubscription = subscription?.hasSubscription && 
          subscription?.subscriptionStatus === 'complete' && 
          subscription?.paymentStatus === 'paid';

      if (!hasPaidSubscription && !hasFreePlan) {
        return res.status(403).json({ 
          error: 'Subscription or free plan required to access this feature',
          requiresSubscription: true
        });
      }
    } catch {
      return res.status(500).json({ error: 'Failed to verify subscription status' });
    }
  }

  try {
    // Detect manual trade (no entryTime, exitTime, accountId)
    const isManualTrade = !trade.entryTime && !trade.exitTime && !trade.accountId;

    let existing;
    if (isManualTrade) {
      // Manual trade: check for duplicate by userId, symbol, account, date
      existing = await db.collection('trades')
        .where('userId', '==', userId)
        .where('symbol', '==', trade.symbol)
        .where('account', '==', trade.account)
        .where('date', '==', trade.date)
        .get();
    } else {
      // Automatic trade: check for duplicate by userId, accountId, symbol, entryTime, exitTime
      existing = await db.collection('trades')
        .where('userId', '==', userId)
        .where('accountId', '==', trade.accountId)
        .where('symbol', '==', trade.symbol)
        .where('entryTime', '==', trade.entryTime)
        .where('exitTime', '==', trade.exitTime)
        .get();
    }

    if (!existing.empty) {
      return res.status(200).json({ success: false, duplicate: true });
    }

    const id = trade.id || require('crypto').randomUUID();

    // If a client provides an id, ensure it can't overwrite someone else's trade.
    const existingById = await db.collection('trades').doc(id).get();
    if (existingById.exists) {
      const existingData = existingById.data() || {};
      if (existingData.userId && existingData.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized: trade id belongs to another user' });
      }
    }

    await db.collection('trades').doc(id).set({ ...trade, id, userId });
    res.status(200).json({ success: true, trade: { ...trade, id, userId } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}