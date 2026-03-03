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

  const { userId, id } = req.body;
  if (!userId || !id) {
    return res.status(400).json({ error: 'Missing userId or id' });
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
    // Delete the finance document (ownership enforced server-side; Admin SDK bypasses rules)
    const financeRef = db.collection('finances').doc(id);
    const financeSnap = await financeRef.get();
    if (!financeSnap.exists) {
      return res.status(404).json({ error: 'Finance record not found' });
    }
    const financeData = financeSnap.data() || {};
    if (financeData.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this finance record' });
    }
    await financeRef.delete();

    // Delete all tradovate fills for this user and account
    const fillsSnap = await db.collection('tradovateFills')
      .where('userId', '==', userId)
      .where('accountId', '==', id)
      .get();

    const batch = db.batch();
    fillsSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.status(200).json({ success: true, deletedFills: fillsSnap.size });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};