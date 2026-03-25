import { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const configuration = new Configuration({
      clientId: process.env.PLAID_CLIENT_ID!,
      secret: process.env.PLAID_SECRET!,
      env: PlaidEnvironments.sandbox,
    });

    const plaidClient = new PlaidApi(configuration);

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: 'user_' + Math.random().toString(36).substr(2, 9),
      },
      client_name: 'PropMap',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/plaid/webhook` : undefined,
    });

    res.status(200).json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
      request_id: response.data.request_id,
    });
  } catch (error: any) {
    console.error('Error creating link token:', error);
    res.status(500).json({ 
      error: 'Failed to create link token',
      details: error.response?.data || error.message 
    });
  }
}
