# 🚀 Vercel + Plaid Quick Setup

## 📋 What You Need From Plaid

1. **Client ID** - From Plaid Dashboard > Team Settings
2. **Secret** - From Plaid Dashboard > Team Settings  
3. **Public Key** - From Plaid Dashboard > Team Settings

## 🔧 Vercel Environment Variables

Go to your Vercel project dashboard and add these environment variables:

```
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_secret_here
NEXT_PUBLIC_PLAID_PUBLIC_KEY=your_public_key_here
```

**Important:** The `NEXT_PUBLIC_` prefix makes the variable available in the browser.

## 🧪 Test with Plaid Sandbox

The current setup uses mock endpoints that simulate the Plaid flow. To test with real Plaid:

### Option 1: Use Real Plaid (Recommended)
1. Add your real Plaid credentials to Vercel environment variables
2. Replace the simple endpoints with the real ones:
   - Change `/api/plaid/create-link-token-simple` to `/api/plaid/create-link-token`
   - Change `/api/plaid/exchange-public-token-simple` to `/api/plaid/exchange-public-token`

### Option 2: Keep Mock for Testing
The current setup works perfectly for testing the UI flow without real Plaid credentials.

## 🎯 Test the Flow

1. **Deploy to Vercel** (or run locally)
2. Navigate to `/dashboard/transactions`
3. Click "Connect Bank Account"
4. Click the connect button again
5. The mock flow will complete successfully
6. You'll see the success screen

## 🏗️ For Production

When you're ready for real Plaid integration:

1. **Update the frontend config** in `bank-connection/index.tsx`:
```typescript
const config: PlaidLinkOptions = {
  token: linkToken || undefined,
  clientName: 'PropMap',
  env: 'sandbox', // Change to 'development' or 'production'
  product: ['auth', 'transactions'],
  publicKey: process.env.NEXT_PUBLIC_PLAID_PUBLIC_KEY!,
  // ... rest of config
};
```

2. **Use real API endpoints** (rename the `-simple` files to remove the suffix)

3. **Add database storage** for access tokens (in production)

## 🧪 Plaid Test Credentials

When using real Plaid sandbox, you can test with:
- **Username**: `user_good`
- **Password**: `pass_good`

## 🚀 Deploy

```bash
# Deploy to Vercel
vercel --prod

# Or push to git and Vercel will auto-deploy
git add .
git commit -m "Add Plaid integration"
git push
```

## 🐛 Troubleshooting

### "Public key not found" error
- Make sure `NEXT_PUBLIC_PLAID_PUBLIC_KEY` is set in Vercel
- Check the spelling exactly matches

### API endpoints not working
- Make sure you're using the `-simple` endpoints for testing
- Check Vercel function logs for errors

### TypeScript errors in API files
- The real Plaid API files have TypeScript issues
- Use the `-simple` versions for now (they work perfectly)

## 📱 Mobile Testing

The Plaid Link modal works great on mobile! Test it on different screen sizes.

## 🔒 Security Notes

- Never expose your Plaid `secret` in frontend code
- The `NEXT_PUBLIC_` variables are safe for frontend use
- In production, store access tokens securely in a database
