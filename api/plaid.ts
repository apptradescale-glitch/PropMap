// Mock Plaid API endpoints
// In a real application, these would connect to actual Plaid API

export default async function handler(req: any, res: any) {
  const { method } = req;

  if (method === 'POST') {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    
    if (pathname === '/api/plaid/create-link-token') {
      // Mock create link token endpoint
      const mockLinkToken = 'link-sandbox-' + Math.random().toString(36).substr(2, 9);
      
      return res.status(200).json({
        link_token: mockLinkToken,
        expiration: '2024-01-01T00:00:00Z',
        request_id: 'mock-request-id'
      });
    }
    
    if (pathname === '/api/plaid/exchange-public-token') {
      // Mock exchange public token endpoint
      const { public_token, institution, accounts } = req.body;
      
      // In a real app, you would:
      // 1. Exchange the public_token for an access_token using Plaid API
      // 2. Store the access_token securely
      // 3. Fetch initial transactions
      
      console.log('Mock: Received public token exchange', {
        public_token,
        institution,
        accounts
      });
      
      return res.status(200).json({
        success: true,
        access_token: 'access-sandbox-' + Math.random().toString(36).substr(2, 9),
        item_id: 'item-sandbox-' + Math.random().toString(36).substr(2, 9)
      });
    }
  }
  
  return res.status(404).json({ error: 'Endpoint not found' });
}
