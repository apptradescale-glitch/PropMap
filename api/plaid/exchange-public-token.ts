import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
    const PLAID_SECRET = process.env.PLAID_SECRET;
    const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      console.error('Missing Plaid credentials in environment variables');
      return res.status(500).json({ error: 'Plaid credentials not configured' });
    }

    const { public_token, institution, accounts } = req.body || {};

    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    // Determine Plaid base URL based on environment
    const plaidBaseUrl =
      PLAID_ENV === 'production'
        ? 'https://production.plaid.com'
        : 'https://sandbox.plaid.com';

    // Call the real Plaid API to exchange the public token for an access token
    const plaidResponse = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token: public_token,
      }),
    });

    const plaidData = await plaidResponse.json();

    if (!plaidResponse.ok) {
      console.error('Plaid API error:', plaidData);
      return res.status(plaidResponse.status).json({
        error: 'Plaid API error',
        details: plaidData,
      });
    }

    console.log('Bank connected successfully:', {
      item_id: plaidData.item_id,
      institution: institution?.name || 'Unknown',
      accounts_count: accounts?.length || 0,
    });

    return res.status(200).json({
      access_token: plaidData.access_token,
      item_id: plaidData.item_id,
      request_id: plaidData.request_id,
    });
  } catch (error: any) {
    console.error('Error exchanging public token:', error);
    return res.status(500).json({
      error: 'Failed to exchange public token',
      details: error.message,
    });
  }
}
