import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

function initFirebaseAdmin() {
  if (admin.apps.length) return;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return;
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    } as any),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // --- Authenticate the user via Firebase ---
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }
    initFirebaseAdmin();
    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.substring(7));
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    const db = admin.firestore();

    // --- Check if user has a bank connection ---
    const connectionSnap = await db.collection('plaid_connections').doc(uid).get();
    const hasConnection = connectionSnap.exists;

    // --- Get stored transactions ---
    const txSnap = await db.collection('plaid_transactions').doc(uid).get();

    if (!txSnap.exists) {
      return res.status(200).json({
        connected: hasConnection,
        transactions: [],
        accounts: [],
        total_transactions: 0,
        last_fetched: null,
      });
    }

    const data = txSnap.data();

    return res.status(200).json({
      connected: hasConnection,
      transactions: data?.transactions || [],
      accounts: data?.accounts || [],
      total_transactions: data?.total_transactions || 0,
      last_fetched: data?.last_fetched || null,
    });
  } catch (error: any) {
    console.error('Error getting transactions:', error);
    return res.status(500).json({ error: 'Failed to get transactions', details: error.message });
  }
}
