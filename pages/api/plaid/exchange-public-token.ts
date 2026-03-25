import { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { public_token, institution, accounts } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: 'Public token is required' });
    }

    const configuration = new Configuration({
      clientId: process.env.PLAID_CLIENT_ID!,
      secret: process.env.PLAID_SECRET!,
      env: PlaidEnvironments.sandbox,
    });

    const plaidClient = new PlaidApi(configuration);

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    let institutionData = null;
    if (institution?.institution_id) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institution.institution_id,
          country_codes: [CountryCode.Us],
        });
        institutionData = institutionResponse.data.institution;
      } catch (err) {
        console.log('Could not fetch institution details:', err);
      }
    }

    // Store the access token securely (in production, use a database)
    // For now, we'll just return success
    console.log('Bank connected successfully:', {
      itemId,
      institution: institutionData?.name || 'Unknown',
      accounts_count: accounts?.length || 0,
    });

    res.status(200).json({
      success: true,
      item_id: itemId,
      institution: institutionData,
      accounts: accounts,
    });
  } catch (error: any) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ 
      error: 'Failed to exchange public token',
      details: error.response?.data || error.message 
    });
  }
}
