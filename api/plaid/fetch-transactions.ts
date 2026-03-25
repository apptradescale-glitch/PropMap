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

    // --- Get the stored access_token from Firestore ---
    const db = admin.firestore();
    const connectionSnap = await db.collection('plaid_connections').doc(uid).get();

    if (!connectionSnap.exists) {
      return res.status(404).json({ error: 'No bank connection found. Please connect a bank first.' });
    }

    const connectionData = connectionSnap.data();
    const accessToken = connectionData?.access_token;

    if (!accessToken) {
      return res.status(404).json({ error: 'No access token found. Please reconnect your bank.' });
    }

    // --- Fetch transactions from Plaid ---
    const plaidBaseUrl = PLAID_ENV === 'production'
      ? 'https://production.plaid.com'
      : 'https://sandbox.plaid.com';

    // Get transactions for the last 30 days
    const endDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const plaidResponse = await fetch(`${plaidBaseUrl}/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          count: 100,
          offset: 0,
        },
      }),
    });

    const plaidData = await plaidResponse.json();

    if (!plaidResponse.ok) {
      console.error('Plaid transactions error:', plaidData);
      return res.status(plaidResponse.status).json({ error: 'Plaid API error', details: plaidData });
    }

    // --- Store transactions in Firestore ---
    const transactions = (plaidData.transactions || []).map((t: any) => ({
      transaction_id: t.transaction_id,
      account_id: t.account_id,
      name: t.name,
      merchant_name: t.merchant_name || null,
      amount: t.amount,
      date: t.date,
      category: t.category || [],
      pending: t.pending,
      payment_channel: t.payment_channel,
      iso_currency_code: t.iso_currency_code || 'USD',
    }));

    const accounts = (plaidData.accounts || []).map((a: any) => ({
      account_id: a.account_id,
      name: a.name,
      official_name: a.official_name,
      type: a.type,
      subtype: a.subtype,
      balances: {
        available: a.balances?.available,
        current: a.balances?.current,
        limit: a.balances?.limit,
        iso_currency_code: a.balances?.iso_currency_code || 'USD',
      },
    }));

    await db.collection('plaid_transactions').doc(uid).set({
      transactions,
      accounts,
      total_transactions: plaidData.total_transactions || transactions.length,
      last_fetched: new Date().toISOString(),
    });

    console.log(`Fetched ${transactions.length} transactions for user ${uid}`);

    return res.status(200).json({
      transactions,
      accounts,
      total_transactions: plaidData.total_transactions || transactions.length,
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
}
