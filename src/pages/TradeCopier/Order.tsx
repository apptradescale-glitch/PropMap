
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/FAuth';

// Import logos (same as AutoSync)
import TLGO from '@/assets/images/tradovatecpu.png';
import TL from '@/assets/images/tradovate.png';
import NONmatchLogo from '@/assets/images/NONEmatch.png';
import ApexTraderFundingLogo from '@/assets/images/apextraderfunding.png';
import MyFundedFuturesLogo from '@/assets/images/myfundedfutures.png';
import TakeProfitTraderLogo from '@/assets/images/takeprofittrader.png';
import TradeifyLogo from '@/assets/images/tradeify.png';
import AlphaFuturesLogo from '@/assets/images/alphafutures.png';
import TopOneFuturesLogo from '@/assets/images/toponefutures.png';
import FundingTicksLogo from '@/assets/images/fundingticks.png';
import FundedNextFuturesLogo from '@/assets/images/fundednextfutures.png';
import AquaFuturesLogo from '@/assets/images/aquafutures.png';
import Unknown from '@/assets/images/unknown.png';
import TopstepLogo from '@/assets/images/topstep.png';
import LucidLogo from '@/assets/images/lucid.png';

const FIRM_LOGOS: Record<string, any> = {
  "Apex Trader Funding": ApexTraderFundingLogo,
  "MyFundedFutures": MyFundedFuturesLogo,
  "Take Profit Trader": TakeProfitTraderLogo,
  "Tradeify": TradeifyLogo,
  "Alpha Futures": AlphaFuturesLogo,
  "Top One Futures": TopOneFuturesLogo,
  "Funding Ticks": FundingTicksLogo,
  "Funded Next Futures": FundedNextFuturesLogo,
  "Aqua Futures": AquaFuturesLogo,
  "Topstep": TopstepLogo,
  "Lucid": LucidLogo,
  "Other": Unknown,
};

function getFirmLogo(firm: string) {
  return FIRM_LOGOS[firm] || TL;
}

interface Position {
  symbol: string;
  qty: number;
  side: 'Long' | 'Short';
  avgPrice: number;
  unrealizedPnL: number;
}

interface AccountPositions {
  accountId: string;
  accountName: string;
  positions: Position[];
  status: 'idle' | 'scanning' | 'success' | 'error' | 'no-positions';
  error?: string;
}

// Cache to avoid repeated API calls
const contractCache = new Map<number, string>();

const getContractSymbol = async (contractId: number, userId: string, accountId: string, token: string) => {
  try {
    const response = await fetch('/api/tradovatecopy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'getContract',
        userId,
        accountId,
        contractId
      })
    });
    
    if (response.ok) {
      const contractData = await response.json();
      return contractData.name || `Contract_${contractId}`;
    }
  } catch (error) {

  }
  return `Contract_${contractId}`;
};

const getCachedContractSymbol = async (contractId: number, userId: string, accountId: string, token: string) => {
  if (contractCache.has(contractId)) {
    return contractCache.get(contractId);
  }
  
  const symbol = await getContractSymbol(contractId, userId, accountId, token);
  contractCache.set(contractId, symbol);
  return symbol;
};

const toRoman = (num: number): string => {
  const romanMap: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"],
    [1, "I"]
  ];
  let result = "";
  for (const [value, numeral] of romanMap) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
};

// Orders logic component for TradeCopier, controlled by copierRunning prop from overview page
export default function Orders({ 
  copierRunning,
  onPositionsUpdate
}: { 
  copierRunning: boolean;
  onPositionsUpdate?: (positions: Map<string, AccountPositions>) => void;
}) {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountPositions, setAccountPositions] = useState<Map<string, AccountPositions>>(new Map());
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());

  // Load accounts from Firestore
  useEffect(() => {
    async function loadAccounts() {
      if (currentUser?.uid) {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        // Only include Tradovate platform accounts
        const tradovateAccounts = (data.finances || []).filter((acc: any) => acc.platform === 'Tradovate');
        setAccounts(tradovateAccounts);
        // Initialize account positions map
        const positions = new Map();
        tradovateAccounts.forEach((acc: any) => {
          positions.set(acc.id.toString(), {
            accountId: acc.id.toString(),
            accountName: acc.name,
            positions: [],
            status: 'idle'
          });
        });
        setAccountPositions(positions);
      }
    }
    loadAccounts();
  }, [currentUser?.uid]);


  // Notify parent of position updates
  useEffect(() => {
    if (onPositionsUpdate) {
      onPositionsUpdate(accountPositions);
    }
  }, [accountPositions, onPositionsUpdate]);

  // Start/stop WebSockets based on copierRunning
  useEffect(() => {
    if (copierRunning) {
      // Start WebSocket for each account
      accounts.forEach((account) => {
        if (!wsRefs.current.has(account.id.toString())) {
          scanAccountPositions(account);
        }
      });
    } else {
      // Stop/cleanup all WebSockets
      wsRefs.current.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      });
      wsRefs.current.clear();
      // Optionally reset positions
      setAccountPositions(prev => {
        const newMap = new Map(prev);
        accounts.forEach(acc => {
          const existing = newMap.get(acc.id.toString());
          if (existing) {
            newMap.set(acc.id.toString(), {
              ...existing,
              status: 'idle',
              positions: [],
              error: undefined
            });
          }
        });
        return newMap;
      });
    }
  }, [copierRunning, accounts]);

  const scanAccountPositions = async (account: any) => {
    return new Promise<void>(async (resolve) => {
      try {
        // Get websocket token for this account (narrow exception; required by Tradovate websocket auth)
        const authToken = await currentUser.getIdToken();
        const tokenRes = await fetch('/api/tradovate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            action: 'getWebsocketToken',
            userId: currentUser?.uid,
            accountId: account.id,
          }),
        });

        if (!tokenRes.ok) {
          throw new Error('Failed to get websocket token');
        }

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
          throw new Error('No websocket token received');
        }

        // Create WebSocket connection for this account (same as Trade Copier)
        const ws = new WebSocket('wss://demo.tradovateapi.com/v1/websocket');
        wsRefs.current.set(account.id.toString(), ws);
        
        let positions: Position[] = [];
        let wsTimeout: NodeJS.Timeout;
        let syncRequestSent = false;

        ws.onopen = () => {
         
        };

        ws.onmessage = async (event) => {
          const message = event.data;
          
          if (message === 'o') {
            // Send authorization (same as Trade Copier)
           
            ws.send(`authorize\n1\n\n${tokenData.access_token}`);
            return;
          }

          if (message === 'h') {
            // Heartbeat response (same as Trade Copier)
            ws.send('[]');
            return;
          }

          if (typeof message === 'string' && message.startsWith('a[')) {
            try {
              const payloads = JSON.parse(message.slice(1));
              
              for (const payload of payloads) {
                // Authorization success (same as Trade Copier)
                if ((payload.s === 200 || payload.status === 200) && payload.i === 1 && !syncRequestSent) {
                
                  
                  // Request position list directly (simpler than position/deps)
                  ws.send(`position/list\n2\n\n${JSON.stringify({ accountId: account.id })}`);
                  
                  syncRequestSent = true;
                  
                  // Set timeout to close connection after 10 seconds
                  wsTimeout = setTimeout(() => {
                   
                    
                    // Update state with final results
                    setAccountPositions(prev => {
                      const newMap = new Map(prev);
                      const existing = newMap.get(account.id.toString());
                      if (existing) {
                        newMap.set(account.id.toString(), {
                          ...existing,
                          status: positions.length > 0 ? 'success' : 'no-positions',
                          positions: positions
                        });
                      }
                      return newMap;
                    });
                    
                    ws.close();
                  }, 10000);
                  continue;
                }
                

                // Position list response (one-time snapshot)
                if (payload.s === 200 && payload.i === 2) {
           
                  let positionData = Array.isArray(payload.d) ? payload.d : [];
                  // Filter positions to only those matching the current account
                  positionData = positionData.filter((pos: any) => String(pos.accountId) === String(account.id));
                  // Log each position object for clarity
                  positionData.forEach((pos: any, idx: number) => {
                 
                  });

                  if (positionData.length === 0) {
                    positions = [];
                  } else {
                    // Process positions
                    for (const pos of positionData) {
                      if (pos.netPos && pos.netPos !== 0) {
                        try {
                          const symbol = await getCachedContractSymbol(pos.contractId, currentUser?.uid || '', account.id.toString(), authToken);
                          const processedPosition = {
                            symbol: symbol,
                            qty: Math.abs(pos.netPos),
                            side: pos.netPos > 0 ? 'Long' : 'Short',
                            avgPrice: pos.netPrice || 0,
                            unrealizedPnL: 0,
                            // Include all raw fields from pos
                            ...pos
                          };
                          positions.push(processedPosition);
                          // Log all data about the position
                        
                        } catch (error) {
                        
                        }
                      }
                    }
                  }

                  // Update state with final results
                  setAccountPositions(prev => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(account.id.toString());
                    if (existing) {
                      newMap.set(account.id.toString(), {
                        ...existing,
                        status: positions.length > 0 ? 'success' : 'no-positions',
                        positions: positions
                      });
                    }
                    return newMap;
                  });

                  // Close connection immediately after getting data
                  clearTimeout(wsTimeout);
                  ws.close();
                  resolve();
                  return;
                }

                // Error response
                if (payload.s >= 400) {
                  throw new Error(`API Error: ${payload.s} - ${payload.d || 'Unknown error'}`);
                }
              }
            } catch (err) {
           
              ws.close();
            }
          }
        };

        ws.onclose = () => {
        
          wsRefs.current.delete(account.id.toString());
          clearTimeout(wsTimeout);
          resolve();
        };

        ws.onerror = (error) => {
       
          clearTimeout(wsTimeout);
          ws.close();
        };

      } catch (error) {
     
        throw error;
      }
    });
  };

  // Cleanup WebSocket connections on unmount
  useEffect(() => {
    return () => {
      wsRefs.current.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      });
      wsRefs.current.clear();
    };
  }, []);

  // No UI, just logic
  return null;
}