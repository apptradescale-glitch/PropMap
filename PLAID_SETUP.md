# Plaid Integration Setup

This guide will help you set up Plaid API integration for automatic bank account connection and transaction importing.

## 🚀 Quick Start

### 1. Get Plaid API Credentials

1. Go to [Plaid Dashboard](https://dashboard.plaid.com)
2. Sign up for a free account
3. Create a new application
4. Get your:
   - **Client ID** (from Dashboard > Team Settings)
   - **Secret** (from Dashboard > Team Settings)
   - **Public Key** (from Dashboard > Team Settings)

### 2. Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
# Copy the example file
cp .env.example .env.local
```

Add your Plaid credentials:

```env
# Plaid API Configuration
PLAID_CLIENT_ID=your_actual_client_id_here
PLAID_SECRET=your_actual_secret_here
PLAID_ENV=sandbox
```

### 3. Backend Setup (Required for Production)

The current implementation includes mock API endpoints. For production, you'll need to:

#### Option A: Node.js/Express Backend
```bash
npm install express cors dotenv plaid
```

Create `server.js`:
```javascript
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PlaidApi, PlaidEnvironments } = require('plaid');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const plaidClient = new PlaidApi({
  clientID: process.env.PLAID_CLIENT_ID,
  secret: process.env.PLAID_SECRET,
  env: PlaidEnvironments.sandbox,
});

// Create link token
app.post('/api/plaid/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'user123' },
      client_name: 'PropMap',
      products: ['auth', 'transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exchange public token
app.post('/api/plaid/exchange-public-token', async (req, res) => {
  try {
    const { public_token } = req.body;
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    
    const accessToken = response.data.access_token;
    
    // Store accessToken securely in your database
    // associated with the user
    
    res.json({ success: true, access_token: response.data.access_token });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Plaid API server running on port ${PORT}`);
});
```

#### Option B: Vercel Serverless Functions
Create `api/plaid/create-link-token.ts`:
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const plaidClient = new PlaidApi({
      clientID: process.env.PLAID_CLIENT_ID!,
      secret: process.env.PLAID_SECRET!,
      env: PlaidEnvironments.sandbox,
    });

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'user123' },
      client_name: 'PropMap',
      products: ['auth', 'transactions'],
      country_codes: ['US'],
      language: 'en',
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: error.message });
  }
}
```

### 4. Frontend Configuration

Update the Plaid configuration in `src/pages/dashboard/bank-connection/index.tsx`:

```typescript
const config: PlaidLinkOptions = {
  token: linkToken || undefined,
  clientName: 'PropMap',
  env: 'sandbox', // Change to 'development' or 'production'
  product: ['auth', 'transactions'],
  publicKey: process.env.NEXT_PUBLIC_PLAID_PUBLIC_KEY || 'your-public-key',
  // ... rest of config
};
```

Add to `.env.local`:
```env
NEXT_PUBLIC_PLAID_PUBLIC_KEY=your_public_key_here
```

### 5. Test the Integration

1. Start your development server
2. Navigate to `/dashboard/transactions`
3. Click "Connect Bank Account"
4. Click "Connect Bank Account" again
5. Use Plaid's sandbox credentials:
   - **User**: `user_good`
   - **Pass**: `pass_good`
6. Complete the flow
7. Verify success message appears

## 🔧 Development vs Production

### Development (Sandbox)
- Use test credentials provided by Plaid
- No real bank data
- Free to use

### Production
- Requires real Plaid API keys
- Connects to actual bank accounts
- Plaid charges per connected account

## 📝 Next Steps

1. **Transaction Sync**: Implement periodic transaction fetching
2. **Account Management**: Allow users to disconnect/reconnect banks
3. **Error Handling**: Add comprehensive error handling
4. **Security**: Implement proper token storage and encryption

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid public_key" error**
   - Ensure your public key is correct
   - Check environment variables are loaded

2. **"Link token expired" error**
   - Link tokens expire after 30 minutes
   - Generate a new token for each attempt

3. **CORS errors**
   - Ensure your backend allows requests from your frontend
   - Check API endpoint URLs

### Debug Mode

Enable debug logging in development:
```typescript
// In your Plaid config
const config: PlaidLinkOptions = {
  // ... other config
  onLoad: () => console.log('Plaid Link loaded'),
  onEvent: (eventName, metadata) => console.log('Plaid event:', eventName, metadata),
};
```

## 📚 Additional Resources

- [Plaid Documentation](https://plaid.com/docs/)
- [Plaid React Integration Guide](https://plaid.com/docs/link/react/)
- [Plaid API Reference](https://plaid.com/docs/api/)

## 🚨 Security Notes

- Never expose your Plaid `secret` in frontend code
- Store access tokens securely (encrypted at rest)
- Implement proper user authentication
- Use HTTPS in production
- Validate all webhooks from Plaid
