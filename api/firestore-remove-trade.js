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

  // Support both single trade removal and account-wide removal
  const { userId, id, accountId } = req.body;

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

  // Remove all trades for an account
  if (userId && accountId) {
    try {
      const accountIdStr = String(accountId);

      // Collect refs across potential type variants (string vs number) so deletes work even
      // if older data was written with a different type.
      const refsByPath = new Map();

      const collectRefs = async (query) => {
        const snap = await query.get();
        snap.forEach(doc => refsByPath.set(doc.ref.path, doc.ref));
      };

      // Preferred: string (matches current TopstepX writes)
      await collectRefs(
        db.collection('trades')
          .where('userId', '==', userId)
          .where('accountId', '==', accountIdStr)
      );

      // Fallback: number (in case legacy writes used numeric accountId)
      const accountIdNum = Number(accountIdStr);
      if (Number.isFinite(accountIdNum) && String(accountIdNum) === accountIdStr) {
        await collectRefs(
          db.collection('trades')
            .where('userId', '==', userId)
            .where('accountId', '==', accountIdNum)
        );
      }

      const refs = Array.from(refsByPath.values());
      if (refs.length === 0) {
        // Treat as successful no-op so the UI can proceed cleanly.
        return res.status(200).json({ success: true, removed: 0 });
      }

      // Firestore batches are limited to 500 ops; stay safely under.
      const MAX_BATCH = 450;
      for (let i = 0; i < refs.length; i += MAX_BATCH) {
        const batch = db.batch();
        const chunk = refs.slice(i, i + MAX_BATCH);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      return res.status(200).json({ success: true, removed: refs.length });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Remove a single trade by id
  if (userId && id) {
    try {
      // Try to delete by document ID first (covers trades saved with auto-generated doc IDs)
      const docRef = db.collection('trades').doc(id);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const docData = docSnap.data() || {};
        if (docData.userId === userId) {
          await docRef.delete();
          return res.status(200).json({ success: true });
        } else {
          return res.status(403).json({ error: 'Unauthorized to delete this trade' });
        }
      }

      // Fallback: older trades may store the id inside a field named 'id'
      const snapshot = await db.collection('trades')
        .where('userId', '==', userId)
        .where('id', '==', id)
        .get();
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Trade not found' });
      }
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // If neither id nor accountId is provided
  return res.status(400).json({ error: 'Missing userId and either id or accountId' });
};