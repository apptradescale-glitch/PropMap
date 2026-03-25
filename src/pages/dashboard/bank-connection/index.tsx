import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Landmark, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Plaid imports - Official React SDK
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';


export default function BankConnectionPage() {
  const navigate = useNavigate();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#0a0a0a';
    document.body.style.margin = '0';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
    };
  }, []);

  // Generate link token from backend (following official Plaid flow)
  const generateLinkToken = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the official endpoint structure
      const response = await fetch('/api/plaid/create-link-token-official', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_name: 'PropMap',
          products: ['auth', 'transactions'],
          country_codes: ['US'],
          language: 'en',
          user: {
            client_user_id: 'user_' + Math.random().toString(36).substr(2, 9),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Error generating link token:', err);
      setError('Failed to initialize bank connection. Please try again.');
      
      // For demo purposes, use a mock token
      setLinkToken('mock-link-token');
    } finally {
      setIsLoading(false);
    }
  };

  // Plaid Link configuration
  const config: PlaidLinkOptions = {
    token: linkToken || undefined,
    clientName: 'PropMap',
    env: 'sandbox', // Change to 'development' or 'production' for real use
    product: ['auth', 'transactions'],
    publicKey: process.env.NEXT_PUBLIC_PLAID_PUBLIC_KEY || 'your-plaid-public-key',
    onSuccess: async (public_token: string, metadata: any) => {
      try {
        // Send public token to backend to exchange for access token (following official Plaid flow)
        const response = await fetch('/api/plaid/exchange-public-token-official', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            public_token: public_token,
            institution: metadata.institution,
            accounts: metadata.accounts,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setSuccess(true);
          // Store connection info following official Plaid data structure
          localStorage.setItem('plaid_connection', JSON.stringify({
            institution: metadata.institution,
            accounts: metadata.accounts,
            access_token: data.access_token,
            item_id: data.item_id,
            connected_at: new Date().toISOString(),
          }));
          console.log('Bank connected successfully (official Plaid flow):', data);
        } else {
          throw new Error('Failed to save bank connection');
        }
      } catch (err) {
        console.error('Error saving bank connection:', err);
        setError('Failed to save bank connection. Please try again.');
      }
    },
    onExit: (err: any, metadata: any) => {
      if (err) {
        console.error('Plaid Link error:', err);
        setError('Bank connection was cancelled or failed. Please try again.');
      }
      setLinkToken(null);
    },
  };

  const { open, ready } = usePlaidLink(config);

  const handleConnectBank = () => {
    if (!linkToken) {
      generateLinkToken();
    } else if (ready) {
      open();
    }
  };

  const handleGoBack = () => {
    navigate('/dashboard/transactions');
  };

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Bank Connection" />
      
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={handleGoBack}
            className="text-[#666] hover:text-white hover:bg-[#1a1a1a]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Transactions
          </Button>
        </div>

        {/* Main Content */}
        <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Landmark className="h-12 w-12 text-[#333]" />
            </div>
            <CardTitle className="text-white text-xl mb-2">
              Connect Your Bank Account
            </CardTitle>
            <CardDescription className="text-[#666] max-w-md">
              Securely connect your bank account to automatically import transactions and get real-time financial updates
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Success State */}
            {success ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-white text-lg font-semibold mb-2">
                  Bank Account Connected!
                </h3>
                <p className="text-[#666] mb-6">
                  Your transactions will now be automatically imported and synced with your PropMap account.
                </p>
                <Button
                  onClick={handleGoBack}
                  className="bg-white hover:bg-gray-100 text-black"
                >
                  View Transactions
                </Button>
              </div>
            ) : (
              <>
                {/* Error State */}
                {error && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-500 text-sm">{error}</p>
                  </div>
                )}

                {/* Features */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium mb-3">What you'll get:</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#666] text-xs">✓</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Automatic Transaction Import</p>
                        <p className="text-[#666] text-xs">All your transactions synced automatically</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#666] text-xs">✓</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Real-time Updates</p>
                        <p className="text-[#666] text-xs">Get instant updates when new transactions occur</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#666] text-xs">✓</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Secure Connection</p>
                        <p className="text-[#666] text-xs">Bank-level security with Plaid encryption</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connect Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleConnectBank}
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-gray-100 text-black font-medium"
                    style={{
                      background: '#fff',
                      color: '#000',
                      fontSize: 13,
                      fontWeight: 500,
                      padding: '5px 14px',
                      borderRadius: 6,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                        Initializing...
                      </>
                    ) : (
                      <>
                        <Landmark className="w-4 h-4 mr-2" />
                        Connect Bank Account
                      </>
                    )}
                  </Button>
                </div>

                {/* Security Note */}
                <div className="text-center pt-4 border-t border-[#1a1a1a]">
                  <p className="text-[#666] text-xs">
                    Powered by Plaid • Your credentials are encrypted and secure
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
