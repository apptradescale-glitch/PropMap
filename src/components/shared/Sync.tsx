import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/FAuth';
import { useState, useEffect, useRef } from "react";
import { CircleOff, RefreshCcw } from "lucide-react";
import { matchFillsToPositions } from '@/pages/AutoSync/overview/view/Tradecalc';
import { useTradeStore, loadAllTradesFromFirestore, loadTradesFromFirestore } from '@/components/shared/datastore';

const accentColor = "#94bba3";

export function SyncAllTrades() {
  const { currentUser } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const refreshFinances = async () => {
    if (!currentUser?.uid) return;
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    setAccounts(data.finances || []);
  };

  useEffect(() => {
    refreshFinances();
    
    // Auto-sync once per day on first mount
    if (currentUser?.uid) {
      const today = new Date().toISOString().split("T")[0];
      const syncKey = `lastSync_${currentUser.uid}`;
      const lastSync = localStorage.getItem(syncKey);

      if (lastSync !== today) {
        // Only sync if not already synced today
        handleSyncAll({ loadAllTrades: false });
        localStorage.setItem(syncKey, today);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const activeConnections = accounts.length;
  const isButtonEnabled = !!currentUser && activeConnections > 0 && !syncing;

  // Sync all Tradovate accounts for the user
  const handleSyncAll = async (options?: { loadAllTrades?: boolean }) => {
    const loadAllTrades = options?.loadAllTrades === true;
  
    if (!isButtonEnabled && !syncing) { // Allow if already syncing to prevent double-check
    
      return;
    }
    
    if (!currentUser?.uid) {
     
      return;
    }
    
   
    setSyncing(true);

    try {
   
      
      // ✅ FIX: Get accounts from finances collection instead of tokens
      // The tradovateTokens collection now has a different structure with accountIds arrays
      const tradovateAccounts = accounts.filter(acc => acc.platform === 'Tradovate');
     

      for (const acc of tradovateAccounts) {
        try {
     
          
          const token = await currentUser.getIdToken();
          const tradovateRes = await fetch('/api/tradovate', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              action: 'account', 
              userId: currentUser.uid, 
              accountId: acc.id  // ✅ Use acc.id instead of acc.accountId
            }),
          });
          
  
          
          // Check if the response is successful
          if (!tradovateRes.ok) {
         
            const errorText = await tradovateRes.text();
         
            continue; // Skip this account and continue with the next one
          }
          
          const tradovateData = await tradovateRes.json();
   

          // Check if we actually got accounts data
          if (!Array.isArray(tradovateData.accounts)) {
        
            continue;
          }

      

          // Track new trades to update UI instantly
          const newTrades: any[] = [];

          for (const accData of tradovateData.accounts) {
          
            if (Array.isArray(accData.fills) && accData.fills.length > 0) {
       
         
          
              const positions = matchFillsToPositions(accData.fills, false, { firm: acc?.firm });
        
              
              for (const pos of positions) {
 
                
                const trade = {
                  symbol: pos.contract?.symbol || pos.symbol, // <-- MNQ, ES, etc.
                  contractName: pos.contract?.name,   
                  account: accData.name || accData.id,
                  pnl: pos.pnl,
                  platform: 'Tradovate',
                  accountId: accData.id,
                  qty: pos.qty,
                  entryPrice: pos.entryPrice,
                  exitPrice: pos.exitPrice,
                  entryTime: pos.entryTime,
                  exitTime: pos.exitTime,
                  date: pos.exitTime ? pos.exitTime.split('T')[0] : '',
                  screenshot: '',
                  screenshotHeadline: '',
                  screenshot2: '',
                  screenshot2Headline: ''
                };
                
       
                
                // Add to Firestore
                const token = await currentUser!.getIdToken();
                const res = await fetch('/api/firestore-add-trade', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    userId: currentUser.uid,
                    trade: trade,
                  }),
                });
                
             
                
                // If successful, collect for UI update
                if (res.ok) {
                  const result = await res.json();
                  if (result.id) {
                    newTrades.push({
                      ...trade,
                      id: result.id,
                      userId: currentUser.uid
                    });
                  }
                }
                
              
              }
            } else {
           
            }
          }
          
          // Update UI instantly with new trades
          if (newTrades.length > 0) {
            // Add new trades to existing trades in Zustand
            useTradeStore.getState().setTrades(currentTrades => {
              // Filter out potential duplicates
              const existingIds = new Set(newTrades.map(t => t.id));
              const filteredExisting = currentTrades.filter(t => !existingIds.has(t.id));
              return [...filteredExisting, ...newTrades];
            });
         
          }

        
          
        } catch (error) {
       
          continue; // Continue with next account
        }
      }

 
      
      const topstepXAccounts = accounts.filter(acc => acc.platform === 'TopstepX');
  

      for (const acc of topstepXAccounts) {
        try {
      
       
          // Fetch full history (bounded by provider-side limits, if any)
          const endDate = new Date();
          const startDate = new Date('2000-01-01T00:00:00.000Z');
          
          const token = await currentUser.getIdToken();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
        
          
          const tradesRes = await fetch('/api/projectx', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              action: 'fetchTrades',
              userId: currentUser.uid,
              accountId: acc.id,
              startTimestamp: startDate.toISOString(),
              endTimestamp: endDate.toISOString(),
              provider: 'TopstepX'
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
       
     
          
          if (!tradesRes.ok) {
            const errorText = await tradesRes.text();
       
          
            continue;
          }
          
          const tradesData = await tradesRes.json();
          
   
     
          
          // Update UI instantly with new trades if any were saved
          if (tradesData.trades && tradesData.trades.length > 0) {
          
            useTradeStore.getState().addTrades(tradesData.trades);
        
          } else {
          
          }
          
        
          
        } catch (error) {
        
          // Timeout or other error - skip this account and continue
          continue;
        }
      }

      const volumetricaAccounts = accounts.filter(acc => acc.platform === 'Volumetrica');

      for (const acc of volumetricaAccounts) {
        try {
          // Fetch last 30 days of trades
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);

          const token = await currentUser.getIdToken();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const tradesRes = await fetch('/api/volumetrica', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'fetchTrades',
              userId: currentUser.uid,
              accountId: acc.id,
              startDt: startDate.toISOString(),
              endDt: endDate.toISOString(),
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!tradesRes.ok) {
            const errText = await tradesRes.text().catch(() => '');
            console.error('[Sync] Volumetrica fetchTrades failed', { accountId: acc.id, status: tradesRes.status, error: errText.slice(0, 300) });
            continue;
          }

          const tradesData = await tradesRes.json().catch(() => null);
          console.info('[Sync] Volumetrica fetchTrades result', { accountId: acc.id, tradeCount: tradesData?.trades?.length ?? 0 });
          if (tradesData?.trades && Array.isArray(tradesData.trades) && tradesData.trades.length > 0) {
            useTradeStore.getState().addTrades(tradesData.trades);
          }
        } catch (error: any) {
          console.error('[Sync] Volumetrica sync error', { accountId: acc.id, error: error?.message });
          continue;
        }
      }

      // --- TopstepX balance refresh (Account/search -> finances updates) ---
      if (topstepXAccounts.length > 0) {
        try {
       
          const token = await currentUser.getIdToken();
          const balancesRes = await fetch('/api/projectx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'syncAccounts',
              provider: 'TopstepX',
              userId: currentUser.uid,
            })
          });

          if (!balancesRes.ok) {
            const errorText = await balancesRes.text();
          
          } else {
      
          }
        } catch (e) {
        
        }
      }

      // --- Volumetrica balance refresh (WSS account snapshot -> finances updates) ---
      if (volumetricaAccounts.length > 0) {
        try {
          const token = await currentUser.getIdToken();
          const balancesRes = await fetch('/api/volumetrica', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'syncAccounts',
              userId: currentUser.uid,
            })
          });

          if (!balancesRes.ok) {
            const errorText = await balancesRes.text().catch(() => '');
            console.error('[Sync] Volumetrica syncAccounts failed', { status: balancesRes.status, error: errorText.slice(0, 300) });
          } else {
            console.info('[Sync] Volumetrica balances refreshed');
          }
        } catch (e: any) {
          console.error('[Sync] Volumetrica balance refresh error', { error: e?.message });
        }
      }

      // Also load from Firestore to make sure everything is in sync
    
      if (loadAllTrades) {
        await loadAllTradesFromFirestore();
      } else {
        await loadTradesFromFirestore({ force: true });
      }
     

      // Refresh local finances snapshot so any balance UI updates immediately
      await refreshFinances();
      
      // Dispatch event to notify other components that balances have been synced
      window.dispatchEvent(new CustomEvent('balancesSynced'));
      
  
      
    } catch (err) {
    
    }
    
 
    setSyncing(false);
  
  };

  // ✅ NEW: Listen for automatic sync trigger after position closes
  useEffect(() => {
    const handleAutoSync = () => {
     
      if (isButtonEnabled) {
    
        handleSyncAll({ loadAllTrades: false });
      } else {
    
      }
    };


    // Listen for the custom event dispatched from overview.tsx
    window.addEventListener('triggerSyncAllTrades', handleAutoSync);
    
    return () => {
   
      window.removeEventListener('triggerSyncAllTrades', handleAutoSync);
    };
  }, [isButtonEnabled]); // Re-create listener when button state changes

  return (
    <div className="flex flex-col items-center gap-4 relative">
      <Button
        ref={buttonRef}
        onClick={() => handleSyncAll({ loadAllTrades: true })}
        disabled={!isButtonEnabled}
        className={
          isButtonEnabled
            ? "relative h-9 w-auto px-2 text-sm font-medium text-white bg-[#94bba3]/20 border border-white/15 hover:bg-[#94bba3]/20 transition-transform hover:scale-105 overflow-hidden group"
            : "h-9 w-auto px-2 text-sm font-medium text-white bg-transparent opacity-30 border border-white/20 cursor-not-allowed"
        }
      >
        {/* Icon + Text */}
        <span className="flex items-center gap-2">
          {isButtonEnabled ? (
            <RefreshCcw className="w-4 h-4" />
          ) : (
            <CircleOff className="w-4 h-4 text-white/70" />
          )}
          {syncing ? "Syncing..." : "Sync All"}
        </span>
      </Button>
    </div>
  );
}