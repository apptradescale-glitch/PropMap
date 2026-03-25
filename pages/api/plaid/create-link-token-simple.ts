import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, return a mock link token
    // In production, you would use the real Plaid API here
    const mockLinkToken = 'link-sandbox-' + Math.random().toString(36).substr(2, 9);
    
    res.status(200).json({
      link_token: mockLinkToken,
      expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      request_id: 'mock-request-' + Math.random().toString(36).substr(2, 9),
    });
  } catch (error: any) {
    console.error('Error creating link token:', error);
    res.status(500).json({ 
      error: 'Failed to create link token',
      details: error.message 
    });
  }
}
