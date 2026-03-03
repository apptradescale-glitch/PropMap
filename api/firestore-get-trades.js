const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const { userId } = req.query;

  const rawAll = Array.isArray(req.query.all) ? req.query.all[0] : req.query.all;
  const all = rawAll === '1' || rawAll === 'true';

  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit = rawLimit ? Number(rawLimit) : NaN;
  const limit = Number.isFinite(parsedLimit) ? Math.floor(parsedLimit) : 100;
  const safeLimit = all ? null : Math.min(2000, Math.max(1, limit));

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // ✅ VERIFY USER OWNERSHIP (prevent unauthorized access)
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
    let snapshot;
    try {
      let q = db
        .collection('trades')
        .where('userId', '==', userId)
        .orderBy('date', 'desc');
      if (safeLimit != null) q = q.limit(safeLimit);
      snapshot = await q.get();
    } catch (error) {
      let q = db
        .collection('trades')
        .where('userId', '==', userId);
      if (safeLimit != null) q = q.limit(safeLimit);
      snapshot = await q.get();
    }
    const trades = [];
    snapshot.forEach(doc => trades.push({ 
      ...doc.data(), 
      id: doc.id  // ✅ Include the Firestore document ID
    }));
    res.status(200).json({ trades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};