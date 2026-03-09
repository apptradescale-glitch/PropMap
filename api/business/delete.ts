import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  // Prefer a single JSON env var if provided.
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  // Fallback to discrete env vars.
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    } as any),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  initFirebaseAdmin();

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid auth token' });
  }

  const token = authHeader.substring(7);
  let uid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }

  const { index } = req.body || {};
  if (index === undefined) {
    return res.status(400).json({ error: 'Business index is required' });
  }

  const db = admin.firestore();
  const businessesRef = db.collection('businesses').doc(uid);
  const businessesSnap = await businessesRef.get();

  if (!businessesSnap.exists) {
    return res.status(404).json({ error: 'No businesses found' });
  }

  const data = businessesSnap.data();
  const businesses = data?.businesses || [];

  if (index < 0 || index >= businesses.length) {
    return res.status(400).json({ error: 'Invalid business index' });
  }

  // Remove the business at the specified index
  businesses.splice(index, 1);

  await businessesRef.set({
    userId: uid,
    businesses: businesses,
    updatedAt: new Date().toISOString()
  });

  return res.status(200).json({ 
    success: true, 
    businesses: businesses 
  });
}
