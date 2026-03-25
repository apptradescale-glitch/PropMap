// This file is deprecated. Use api/plaid/create-link-token.ts and api/plaid/exchange-public-token.ts instead.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(404).json({ error: 'Use /api/plaid/create-link-token or /api/plaid/exchange-public-token' });
}
