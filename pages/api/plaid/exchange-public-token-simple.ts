import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { public_token, institution, accounts } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: 'Public token is required' });
    }

    // Mock successful exchange
    // In production, you would exchange with real Plaid API
    const mockItemId = 'item-sandbox-' + Math.random().toString(36).substr(2, 9);
    
    console.log('Mock bank connection:', {
      public_token,
      institution,
      accounts,
      item_id: mockItemId,
    });

    res.status(200).json({
      success: true,
      item_id: mockItemId,
      institution: institution || { name: 'Test Bank' },
      accounts: accounts || [],
    });
  } catch (error: any) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ 
      error: 'Failed to exchange public token',
      details: error.message 
    });
  }
}
