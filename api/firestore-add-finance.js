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

  const { userId, finance } = req.body;
  if (!userId || !finance || !finance.id) {
    // Missing required data
    return res.status(400).json({ error: 'Missing userId or finance or finance.id' });
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
    const docRef = db.collection('finances').doc(finance.id.toString());

    // If the doc already exists, enforce ownership to prevent cross-user overwrites.
    const existingSnap = await docRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() || {};
      if (existing.userId && existing.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized: finance record belongs to another user' });
      }
    }

    // Never allow client-provided userId to override ownership.
    const safeFinance = { ...finance };
    delete safeFinance.userId;

    await docRef.set({ ...safeFinance, userId });
    // Finance data saved successfully
    res.status(200).json({ success: true, finance: { ...finance, userId } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};