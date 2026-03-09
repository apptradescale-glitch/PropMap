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

  if (req.method !== 'POST') {
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

  const { business } = req.body || {};
  if (!business) {
    return res.status(400).json({ error: 'Business data is required' });
  }

  const db = admin.firestore();
  const businessesRef = db.collection('businesses').doc(uid);
  const businessesSnap = await businessesRef.get();

  let businesses: any[] = [];
  if (businessesSnap.exists) {
    const data = businessesSnap.data();
    businesses = data?.businesses || [];
  }

  // Add timestamp to business
  const businessWithTimestamp = {
    ...business,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  businesses.push(businessWithTimestamp);

  await businessesRef.set({
    userId: uid,
    businesses: businesses,
    updatedAt: new Date().toISOString()
  });

  return res.status(200).json({ 
    success: true, 
    business: businessWithTimestamp,
    businesses: businesses 
  });
}
