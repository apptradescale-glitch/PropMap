const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

module.exports = async function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    // ✅ VERIFY AUTH TOKEN (SECURITY)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }

    const token = authHeader.substring(7);
    let authenticatedUserId;
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      authenticatedUserId = decodedToken.uid;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // ✅ VERIFY USER OWNERSHIP (prevent unauthorized access)
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }
    try {
      const doc = await db.collection('subscriptions').doc(userId).get();
      if (!doc.exists) {
        return res.status(200).json({ subscription: null });
      }
      return res.status(200).json({ subscription: doc.data() });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  } else if (method === 'POST') {
    // ✅ VERIFY AUTH TOKEN (SECURITY)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }

    const token = authHeader.substring(7);
    let authenticatedUserId;
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      authenticatedUserId = decodedToken.uid;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // ✅ VERIFY USER OWNERSHIP (prevent unauthorized access)
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }

    try {
      // Security: never allow client to write paid/entitlement fields.
      // This endpoint only ensures a baseline subscription document exists.
      const ref = db.collection('subscriptions').doc(userId);
      const snap = await ref.get();
      const nowIso = new Date().toISOString();

      if (!snap.exists) {
        await ref.set(
          {
            userId,
            createdAt: nowIso,
            updatedAt: nowIso,
            hasSubscription: false,
            subscriptionType: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            subscriptionStatus: 'none',
            paymentStatus: 'unpaid',
            cancelAtPeriodEnd: false,
          },
          { merge: true }
        );
      } else {
        await ref.set({ updatedAt: nowIso }, { merge: true });
      }

      const updated = await ref.get();
      return res.status(200).json({ success: true, subscription: updated.data() || null });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
};