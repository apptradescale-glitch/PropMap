import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Landmark, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/FAuth';
import { auth } from '@/config/firebase';

// Plaid imports - Official CDN approach
declare global {
  interface Window {
    Plaid: any;
  }
}

// Load Plaid Link script
const loadPlaidScript = () => {
  return new Promise((resolve, reject) => {
    if (window.Plaid) {
      resolve(window.Plaid);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = () => resolve(window.Plaid);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};


export default function BankConnectionPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [connectedInstitution, setConnectedInstitution] = useState<string | null>(null);
  const [transactionCount, setTransactionCount] = useState<number>(0);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#0a0a0a';
    document.body.style.margin = '0';

    // Pre-load Plaid CDN script on mount
    loadPlaidScript().catch((err) =>
      console.warn('Plaid script pre-load failed, will retry later:', err)
    );

    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
    };
  }, []);

  // Generate link token from backend using real Plaid API
  const generateLinkToken = async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error('Backend error:', errData);
        throw new Error(errData.error || 'Failed to generate link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
      return data.link_token;
    } catch (err: any) {
      console.error('Error generating link token:', err);
      setError(err.message || 'Failed to initialize bank connection. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Build and open the Plaid Link handler for a given token
  const openPlaidLink = (token: string) => {
    if (!window.Plaid) {
      setError('Plaid script not loaded. Please refresh the page.');
      return;
    }

    const handler = window.Plaid.create({
      token,
      onSuccess: async (public_token: string, metadata: any) => {
        try {
          setIsLoading(true);
          setError(null);

          // Get Firebase auth token
          const firebaseUser = auth.currentUser;
          if (!firebaseUser) {
            throw new Error('You must be logged in to connect a bank account.');
          }
          const authToken = await firebaseUser.getIdToken();

          // 1. Exchange public token for access token & save to Firestore
          const exchangeRes = await fetch('/api/plaid/exchange-public-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              public_token,
              institution: metadata.institution,
              accounts: metadata.accounts,
            }),
          });

          if (!exchangeRes.ok) {
            const errData = await exchangeRes.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to save bank connection');
          }

          const exchangeData = await exchangeRes.json();
          console.log('Bank connected:', exchangeData);

          // 2. Fetch transactions from Plaid and save to Firestore
          const fetchRes = await fetch('/api/plaid/fetch-transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
          });

          if (fetchRes.ok) {
            const txData = await fetchRes.json();
            setTransactionCount(txData.total_transactions || 0);
            console.log(`Fetched ${txData.total_transactions} transactions`);
          } else {
            console.warn('Could not fetch transactions yet — they may take a moment to appear in sandbox.');
          }

          setConnectedInstitution(metadata.institution?.name || 'Your Bank');
          setSuccess(true);
        } catch (err: any) {
          console.error('Error during bank connection:', err);
          setError(err.message || 'Failed to complete bank connection. Please try again.');
        } finally {
          setIsLoading(false);
        }
      },
      onExit: (err: any) => {
        if (err) {
          console.error('Plaid Link exited with error:', err);
        }
      },
    });

    handler.open();
  };

  const handleConnectBank = async () => {
    setError(null);

    // 1. Make sure the Plaid CDN script is loaded
    try {
      await loadPlaidScript();
    } catch (err) {
      console.error('Failed to load Plaid script:', err);
      setError('Failed to load Plaid. Please refresh and try again.');
      return;
    }

    // 2. Get a fresh link token from our backend (which calls real Plaid API)
    const token = await generateLinkToken();
    if (!token) return; // error already set by generateLinkToken

    // 3. Open Plaid Link with the real token
    openPlaidLink(token);
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
                  {connectedInstitution ? `${connectedInstitution} Connected!` : 'Bank Account Connected!'}
                </h3>
                <p className="text-[#666] mb-2">
                  Your bank account has been securely linked to PropMap.
                </p>
                {transactionCount > 0 && (
                  <p className="text-[#888] text-sm mb-6">
                    {transactionCount} transactions imported successfully.
                  </p>
                )}
                {transactionCount === 0 && (
                  <p className="text-[#888] text-sm mb-6">
                    Transactions may take a moment to sync. Check back shortly.
                  </p>
                )}
                <Button
                  onClick={handleGoBack}
                  style={{
                    background: '#fff',
                    color: '#000',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: '5px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
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
