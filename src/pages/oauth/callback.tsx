import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/FAuth';
import { matchFillsToPositions } from '@/pages/AutoSync/overview/view/Tradecalc';
import logoImage from '@/assets/images/lg34.png';
import { useTradeStore } from '@/components/shared/datastore'; // <-- import your trade store

export default function OAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Your Account is being connected to Tradescale');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const storedState = localStorage.getItem('tradovate_oauth_state');
    const redirect = localStorage.getItem('tradovate_redirect') || 'autosync';

    if (!code) {
      // Nothing to exchange; send the user back to the app.
      setLoading(false);
      if (redirect === 'tradecopier') {
        navigate('/dashboard/tradecopier');
      } else {
        navigate('/dashboard/AutoSync');
      }
      return;
    }

    // Wait briefly for Firebase Auth to hydrate the user after redirect.
    if (!currentUser?.uid) {
      setStatusText('Finishing sign-in...');
      const t = window.setTimeout(() => {
        setLoading(false);
        navigate('/auth/signin');
      }, 8000);
      return () => window.clearTimeout(t);
    }

    // Clear stored state after use (best-effort; server enforces single-use).
    localStorage.removeItem('tradovate_oauth_state');
    localStorage.removeItem('tradovate_redirect');

    (async () => {
      const token = await currentUser.getIdToken();
      fetch('/api/tradovate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'oauth/exchange', code, state: returnedState || storedState, userId: currentUser.uid }),
      })
        .then(res => res.json())
        .then(async data => {
          if (data?.success) {
              // ✅ FIX: Don't pass accountId on first connect
              // This lets the endpoint return ALL accounts with their fills
              // The regular path will now use fill.accountId to separate them correctly
              const accRes = await fetch('/api/tradovate', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'account', userId: currentUser.uid }),
              });
              const accData = await accRes.json();

              let allClosedPositions: any[] = [];

              if (accData.accounts && accData.accounts.length > 0) {
                for (const account of accData.accounts) {
                  await fetch('/api/firestore-add-finance', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      userId: currentUser.uid,
                      finance: {
                        id: account.id,
                        name: account.name,
                        balance: account.balance,
                        type: "Account",
                        platform: "Tradovate",
                      },
                    }),
                  });

                  if (Array.isArray(account.fills)) {
                    for (const fill of account.fills) {
                      await fetch('/api/firestore-add-tradovate-fills', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          userId: currentUser.uid,
                          fill: {
                            id: String(fill.id),
                            accountId: account.id,
                            contractId: fill.contractId,
                            contractSymbol: fill.contract?.symbol ||
                              fill.contract?.underlyingSymbol ||
                              fill.contract?.productSymbol ||
                              fill.contract?.displayName ||
                              null,
                            action: fill.action,
                            qty: fill.qty,
                            price: fill.price,
                            timestamp: fill.timestamp,
                            platform: "Tradovate",
                            contract: fill.contract,
                          },
                        }),
                      });
                    }

                    // Calculate closed positions
                    const closedPositions = matchFillsToPositions(account.fills, true);

                    // 1. Instant UI update for trades
                    allClosedPositions = [...allClosedPositions, ...closedPositions];

                    // Save closed positions to Firestore
                    for (const pos of closedPositions) {
                      await fetch('/api/firestore-add-trade', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          userId: currentUser.uid,
                          trade: {
                            symbol: pos.symbol,
                            accountId: account.id,
                            account: account.name,
                            qty: pos.qty,
                            entryPrice: pos.entryPrice,
                            exitPrice: pos.exitPrice,
                            entryTime: pos.entryTime,
                            exitTime: pos.exitTime,
                            date: pos.exitTime ? pos.exitTime.split('T')[0] : null,
                            pnl: pos.pnl,
                            platform: "Tradovate",
                          },
                        }),
                      });
                    }
                  }
                }
              }

              // 1. Instant UI update for trades (all accounts)
              useTradeStore.getState().setTrades(allClosedPositions);

              setLoading(false);

              // 3. Optionally, background refresh after 1.2s
              setTimeout(async () => {
                const refreshToken = await currentUser.getIdToken();
                const res = await fetch(`/api/firestore-get-trades?userId=${currentUser.uid}&limit=100`, {
                  headers: {
                    'Authorization': `Bearer ${refreshToken}`
                  }
                });
                const data = await res.json();
                useTradeStore.getState().setTrades(data.trades || []);
              }, 1200);

              if (redirect === 'tradecopier') {
                navigate('/dashboard/tradecopier');
              } else {
                navigate('/dashboard/AutoSync');
              }
          } else {
            setLoading(false);
            if (redirect === 'tradecopier') {
              navigate('/dashboard/tradecopier');
            } else {
              navigate('/dashboard/AutoSync');
            }
          }
        })
        .catch(() => {
          setLoading(false);
          if (redirect === 'tradecopier') {
            navigate('/dashboard/tradecopier');
          } else {
            navigate('/dashboard/AutoSync');
          }
        });
    })();
  }, [location.search, currentUser, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-background text-foreground">
        <img src={logoImage} alt="Loading..." className="h-20 w-auto" />
        <span className="mt-6 text-lg font-medium text-muted-foreground">
          {statusText}
        </span>
      </div>
    );
  }

  return null;
}