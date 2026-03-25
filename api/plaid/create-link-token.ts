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

    // Determine Plaid base URL based on environment
    const plaidBaseUrl =
      PLAID_ENV === 'production'
        ? 'https://production.plaid.com'
        : 'https://sandbox.plaid.com';

    // Call the real Plaid API to create a link token
    const plaidResponse = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        client_name: 'PropMap',
        products: ['auth', 'transactions'],
        country_codes: ['US'],
        language: 'en',
        user: {
          client_user_id: 'user_' + Math.random().toString(36).substr(2, 9),
        },
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

    return res.status(200).json({
      link_token: plaidData.link_token,
      expiration: plaidData.expiration,
      request_id: plaidData.request_id,
    });
  } catch (error: any) {
    console.error('Error creating link token:', error);
    return res.status(500).json({
      error: 'Failed to create link token',
      details: error.message,
    });
  }
}
