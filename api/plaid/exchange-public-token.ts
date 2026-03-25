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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
    const PLAID_SECRET = process.env.PLAID_SECRET;
    const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return res.status(500).json({ error: 'Plaid credentials not configured' });
    }

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

    const { public_token, institution, accounts } = req.body || {};
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    // --- Exchange public_token for access_token via Plaid API ---
    const plaidBaseUrl = PLAID_ENV === 'production'
      ? 'https://production.plaid.com'
      : 'https://sandbox.plaid.com';

    const plaidResponse = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    });

    const plaidData = await plaidResponse.json();
    if (!plaidResponse.ok) {
      console.error('Plaid API error:', plaidData);
      return res.status(plaidResponse.status).json({ error: 'Plaid API error', details: plaidData });
    }

    // --- Store the connection in Firestore ---
    const db = admin.firestore();
    const connectionData = {
      access_token: plaidData.access_token,
      item_id: plaidData.item_id,
      institution: institution || null,
      accounts: accounts || [],
      connected_at: new Date().toISOString(),
    };

    await db.collection('plaid_connections').doc(uid).set(connectionData, { merge: true });

    console.log('Bank connected & saved for user:', uid, {
      item_id: plaidData.item_id,
      institution: institution?.name || 'Unknown',
    });

    return res.status(200).json({
      item_id: plaidData.item_id,
      institution: institution || null,
      accounts: accounts || [],
    });
  } catch (error: any) {
    console.error('Error exchanging public token:', error);
    return res.status(500).json({ error: 'Failed to exchange public token', details: error.message });
  }
}
