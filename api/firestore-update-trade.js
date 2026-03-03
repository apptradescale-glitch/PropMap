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

  const { userId, id, updates } = req.body;

  if (!userId || !id || !updates) {
    return res.status(400).json({ error: 'Missing userId, id, or updates' });
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
    const tradeRef = db.collection('trades').doc(id);

    // If the trade already exists, enforce ownership to prevent cross-user updates.
    const existingSnap = await tradeRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() || {};
      if (existing.userId && existing.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized to update this trade' });
      }
    }

    // Never allow userId/id from the client to be merged into the doc.
    const safeUpdates = { ...updates };
    delete safeUpdates.userId;
    delete safeUpdates.id;

    // Upsert: create or update the trade doc by id, merging fields
    await tradeRef.set(
      { userId, id, ...safeUpdates },
      { merge: true }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};