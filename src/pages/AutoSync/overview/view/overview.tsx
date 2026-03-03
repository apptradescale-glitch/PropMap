import React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/FAuth';
import { useTheme } from '@/providers/theme-provider';
import PageHead from '@/components/shared/page-head';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, User, DollarSign, Shield, RefreshCcw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConnectFuturesPopup } from './connectFutures';
import NONmatchLogo from '@/assets/images/NONEmatch.png';
import TLGO from '@/assets/images/tradovate.png';
import TPTX from '@/assets/images/topstepX.jpg';
import TPTXLight from '@/assets/images/topstepXlight.png';
import VOLUMETRICA_LOGO from '@/assets/images/volumetrica.png';
import { loadTradesFromFirestore, useTradeStore } from '@/components/shared/datastore';
import LG34 from '@/assets/images/lg34.png'; // Make sure the path is correct
import TVFull from '@/assets/images/tradovatefull.png'; // Make sure the path is correct

// Firm logo imports (firmname.png for each except Personal Live Account)
import ApexTraderFundingLogo from '@/assets/images/apextraderfunding.png';
import MyFundedFuturesLogo from '@/assets/images/myfundedfutures.png';
import ritterLogo from '@/assets/images/ritter.png';
import TakeProfitTraderLogo from '@/assets/images/takeprofittrader.png';
import TradeifyLogo from '@/assets/images/tradeify.png';
import AlphaFuturesLogo from '@/assets/images/alphafutures.png';
import TopOneFuturesLogo from '@/assets/images/toponefutures.png';
import FundingTicksLogo from '@/assets/images/fundingticks.png';
import FundedNextFuturesLogo from '@/assets/images/fundednextfutures.png';
import AquaFuturesLogo from '@/assets/images/aquafutures.png';
import TradeDayLogo from '@/assets/images/tradeday.png';
import TheTradingPitFuturesLogo from '@/assets/images/thetradingpitfutures.png';
import TopstepLogo from '@/assets/images/topstep.png';
import LucidLogo from '@/assets/images/lucid.png';
import Unknown from '@/assets/images/unknown.png';


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Listbox } from '@headlessui/react';



const FIRM_OPTIONS = [
  "Apex Trader Funding",
  "MyFundedFutures",
  "Take Profit Trader",
  "Tradeify",
  "Alpha Futures",
  "Top One Futures",
  "Funding Ticks",
  "Funded Next Futures",
  "Aqua Futures",
  "Topstep",
  "Lucid",
   "Other",
];

// Map firm names to logos or Lucide User icon for Personal Live Account
const FIRM_LOGOS: Record<string, any> = {
  "Other": Unknown,
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

};

export default function OverViewPage() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();

  const [showFuturesPopup, setShowFuturesPopup] = useState(false);
  const [showTradovateAccountDialog, setShowTradovateAccountDialog] = useState(false);
  // All Tradovate accounts needing type/firm
  const [pendingTradovateAccounts, setPendingTradovateAccounts] = useState<any[]>([]);
  // Per-account selection state
  const [tradovateSelections, setTradovateSelections] = useState<Record<string, { type: string; firm: string }>>({});
  // Select all state
  const [selectAllType, setSelectAllType] = useState<string>("");
  const [selectAllFirm, setSelectAllFirm] = useState<string>("");
  
  // TopstepX account configuration
  const [showTopstepXAccountDialog, setShowTopstepXAccountDialog] = useState(false);
  const [pendingTopstepXAccounts, setPendingTopstepXAccounts] = useState<any[]>([]);
  const [topstepXSelections, setTopstepXSelections] = useState<Record<string, { type: string; firm: string }>>({});
  const [selectAllTopstepXType, setSelectAllTopstepXType] = useState<string>("");
  const [selectAllTopstepXFirm, setSelectAllTopstepXFirm] = useState<string>("");
  const [savingTopstepXType, setSavingTopstepXType] = useState(false);

  // Volumetrica account configuration
  const [showVolumetricaAccountDialog, setShowVolumetricaAccountDialog] = useState(false);
  const [pendingVolumetricaAccounts, setPendingVolumetricaAccounts] = useState<any[]>([]);
  const [volumetricaSelections, setVolumetricaSelections] = useState<Record<string, { type: string; firm: string }>>({});
  const [selectAllVolumetricaType, setSelectAllVolumetricaType] = useState<string>("");
  const [selectAllVolumetricaFirm, setSelectAllVolumetricaFirm] = useState<string>("");
  const [savingVolumetricaType, setSavingVolumetricaType] = useState(false);
  const [firestoreFinances, setFirestoreFinances] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [savingTradovateType, setSavingTradovateType] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [deletedAccountName, setDeletedAccountName] = useState("");
const [deleteDialogStep, setDeleteDialogStep] = useState<"disconnecting" | "success">("disconnecting");
const [showInvalidTokenDialog, setShowInvalidTokenDialog] = useState(false);
const [invalidTokenAccounts, setInvalidTokenAccounts] = useState<any[]>([]);

const resolveAccountDisplayName = (account: any) => {
  const rawAccountId = account?.accountId ?? account?.id ?? account?.accountNumber ?? account?.account;
  const accountIdStr = rawAccountId != null ? String(rawAccountId) : '';
  const fromPayload = String(account?.accountName ?? account?.name ?? account?.displayName ?? '').trim();
  if (fromPayload) return fromPayload;
  if (!accountIdStr) return 'Unknown Account';
  const fromFinances = firestoreFinances.find((f: any) => String(f.id) === accountIdStr);
  return String(fromFinances?.name ?? fromFinances?.accountName ?? fromFinances?.displayName ?? '').trim() || 'Unknown Account';
};

const resolveAccountFirm = (account: any) => {
  const rawAccountId = account?.accountId ?? account?.id ?? account?.accountNumber ?? account?.account;
  const accountIdStr = rawAccountId != null ? String(rawAccountId) : '';
  if (!accountIdStr) return '';
  const fromFinances = firestoreFinances.find((f: any) => String(f.id) === accountIdStr);
  return String(fromFinances?.firm ?? '').trim();
};

const resolveFirmLogoSrc = (account: any) => {
  const firm = resolveAccountFirm(account);
  if (!firm) return null;
  const logo = FIRM_LOGOS[firm];
  return typeof logo === 'string' ? logo : null;
};

const loadFinances = async () => {
  if (currentUser?.uid) {
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    // Filter to only show accounts (with platform field), exclude expenses/payouts
    const accountsOnly = (data.finances || []).filter((f: any) => f.platform);
    setFirestoreFinances(accountsOnly);
  }
};

useEffect(() => {

  // Load finances immediately
  loadFinances();

  // ✅ CHANGED: Auto-refresh every hour instead of 5 minutes
  const interval = setInterval(() => {
    loadFinances();
  
  }, 60 * 60 * 1000); // ✅ 1 hour instead of 5 minutes

  // Cleanup interval on unmount
  return () => clearInterval(interval);
}, [currentUser?.uid]);

// Refresh immediately when the header Sync button updates balances
useEffect(() => {
  const onBalancesSynced = () => {
    loadFinances();
  };
  window.addEventListener('balancesSynced', onBalancesSynced);
  return () => window.removeEventListener('balancesSynced', onBalancesSynced);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentUser?.uid]);

// ✅ NEW: Check for invalid tokens periodically
useEffect(() => {
  async function checkTokenHealth() {
    if (!currentUser?.uid) return;
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/tradovate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'checkTokenHealth',
          userId: currentUser.uid
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.needsReauth && data.expiredAccounts.length > 0) {
          setInvalidTokenAccounts(data.expiredAccounts);
          setShowInvalidTokenDialog(true);
        }
      }
    } catch (error) {
     
    }
  }

  // Check immediately and then every hour
  checkTokenHealth();
  const interval = setInterval(checkTokenHealth, 60 * 60 * 1000); // 1 hour

  return () => clearInterval(interval);
}, [currentUser?.uid]);

  useEffect(() => {
    if (!showTradovateAccountDialog && !savingTradovateType) {
      // Find all Tradovate accounts needing type/firm
      const pending = firestoreFinances.filter(
        acc => acc.platform === "Tradovate" && acc.type === "Account"
      );
      if (pending.length > 0) {
        setPendingTradovateAccounts(pending);
        // Initialize selection state for each account
        setTradovateSelections(
          Object.fromEntries(pending.map(acc => [acc.id, { type: "", firm: "" }]))
        );
        setSelectAllType("");
        setSelectAllFirm("");
        setShowTradovateAccountDialog(true);
      }
    }
  }, [firestoreFinances, showTradovateAccountDialog, savingTradovateType]);

  // TopstepX account configuration trigger
  useEffect(() => {
    if (!showTopstepXAccountDialog && !savingTopstepXType) {
      const pending = firestoreFinances.filter(
        acc => acc.platform === "TopstepX" && acc.type === "Account"
      );
      if (pending.length > 0) {
        setPendingTopstepXAccounts(pending);
        setTopstepXSelections(
          Object.fromEntries(pending.map(acc => [acc.id, { type: "", firm: "" }]))
        );
        setSelectAllTopstepXType("");
        setSelectAllTopstepXFirm("");
        setShowTopstepXAccountDialog(true);
      }
    }
  }, [firestoreFinances, showTopstepXAccountDialog, savingTopstepXType]);

  // Volumetrica account configuration trigger
  useEffect(() => {
    if (!showVolumetricaAccountDialog && !savingVolumetricaType) {
      const pending = firestoreFinances.filter(
        acc => acc.platform === "Volumetrica" && acc.type === "Account"
      );
      if (pending.length > 0) {
        setPendingVolumetricaAccounts(pending);
        setVolumetricaSelections(
          Object.fromEntries(pending.map(acc => [acc.id, { type: "", firm: "" }]))
        );
        setSelectAllVolumetricaType("");
        setSelectAllVolumetricaFirm("");
        setShowVolumetricaAccountDialog(true);
      }
    }
  }, [firestoreFinances, showVolumetricaAccountDialog, savingVolumetricaType]);

  const handleSaveTradovateAccountTypes = async () => {
    if (!pendingTradovateAccounts.length) return;
    // Only allow save if all have both fields
    const allFilled = pendingTradovateAccounts.every(acc => {
      const sel = tradovateSelections[acc.id];
      return sel && sel.type && sel.firm;
    });
    if (!allFilled) return;
    setSavingTradovateType(true);

    // Update local state instantly
    setFirestoreFinances(prev =>
      prev.map(acc => {
        const sel = tradovateSelections[acc.id];
        if (sel && pendingTradovateAccounts.find(a => a.id === acc.id)) {
          return {
            ...acc,
            type: sel.type,
            firm: sel.firm,
            platform: "Tradovate",
          };
        }
        return acc;
      })
    );

    setShowTradovateAccountDialog(false);

    // Save each account
    const token = await currentUser.getIdToken();
    await Promise.all(
      pendingTradovateAccounts.map(acc => {
        const sel = tradovateSelections[acc.id];
        return fetch('/api/firestore-add-finance', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: currentUser.uid,
            finance: {
              ...acc,
              type: sel.type,
              firm: sel.firm,
              platform: "Tradovate",
            },
          }),
        });
      })
    );

    setPendingTradovateAccounts([]);
    setTradovateSelections({});
    setSelectAllType("");
    setSelectAllFirm("");

    setTimeout(async () => {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      // Filter to only show accounts (with platform field), exclude expenses/payouts
      const accountsOnly = (data.finances || []).filter((f: any) => f.platform);
      setFirestoreFinances(accountsOnly);
      setSavingTradovateType(false);
    }, 1200);
  };

  const handleSaveVolumetricaAccountTypes = async () => {
    if (!currentUser?.uid) return;
    if (!pendingVolumetricaAccounts.length) return;
    const allFilled = pendingVolumetricaAccounts.every(acc => {
      const sel = volumetricaSelections[acc.id];
      return sel && sel.type && sel.firm;
    });
    if (!allFilled) return;
    setSavingVolumetricaType(true);

    // Update local state instantly
    setFirestoreFinances(prev =>
      prev.map(acc => {
        const sel = volumetricaSelections[acc.id];
        if (sel && pendingVolumetricaAccounts.find(a => a.id === acc.id)) {
          return {
            ...acc,
            type: sel.type,
            firm: sel.firm,
            platform: "Volumetrica",
          };
        }
        return acc;
      })
    );

    setShowVolumetricaAccountDialog(false);

    const tokenForSave = await currentUser.getIdToken();
    await Promise.all(
      pendingVolumetricaAccounts.map(acc => {
        const sel = volumetricaSelections[acc.id];
        return fetch('/api/firestore-add-finance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenForSave}`
          },
          body: JSON.stringify({
            userId: currentUser.uid,
            finance: {
              ...acc,
              type: sel.type,
              firm: sel.firm,
              platform: "Volumetrica",
            },
          }),
        });
      })
    );

    // Sync trade history for newly added Volumetrica accounts (like TopstepX does)
    const accountsToSync = [...pendingVolumetricaAccounts];

    setPendingVolumetricaAccounts([]);
    setVolumetricaSelections({});
    setSelectAllVolumetricaType("");
    setSelectAllVolumetricaFirm("");

    // Start backfill immediately
    const backfillToken = await currentUser.getIdToken();

    const mergeTradesById = (existing: any[], incoming: any[]) => {
      const existingIds = new Set(existing.map(t => String(t?.id ?? '')));
      const merged = [...existing];
      for (const t of incoming) {
        const id = String(t?.id ?? '');
        if (id && existingIds.has(id)) continue;
        if (id) existingIds.add(id);
        merged.push(t);
      }
      return merged;
    };

    for (const acc of accountsToSync) {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const tradesRes = await fetch('/api/volumetrica', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${backfillToken}`
          },
          body: JSON.stringify({
            action: 'fetchTrades',
            userId: currentUser.uid,
            accountId: acc.id,
            startDt: startDate.toISOString(),
            endDt: endDate.toISOString(),
          }),
        });

        if (!tradesRes.ok) {
          continue;
        }

        const tradesData = await tradesRes.json();

        if (Array.isArray(tradesData.trades) && tradesData.trades.length > 0) {
          useTradeStore.getState().setTrades((currentTrades: any[]) =>
            mergeTradesById(currentTrades, tradesData.trades)
          );
        }
      } catch (error) {
        // Skip failed accounts
      }
    }

    // Reconcile with Firestore once at the end
    await loadTradesFromFirestore();

    const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${backfillToken}`
      }
    });
    const data = await res.json();
    const accountsOnly = (data.finances || []).filter((f: any) => f.platform);
    setFirestoreFinances(accountsOnly);
    setSavingVolumetricaType(false);
  };

  const handleSaveTopstepXAccountTypes = async () => {
    if (!pendingTopstepXAccounts.length) return;
    const allFilled = pendingTopstepXAccounts.every(acc => {
      const sel = topstepXSelections[acc.id];
      return sel && sel.type && sel.firm;
    });
    if (!allFilled) return;
    setSavingTopstepXType(true);

    try {

    // Update local state instantly
    setFirestoreFinances(prev =>
      prev.map(acc => {
        const sel = topstepXSelections[acc.id];
        if (sel && pendingTopstepXAccounts.find(a => a.id === acc.id)) {
          return {
            ...acc,
            type: sel.type,
            firm: sel.firm,
            platform: "TopstepX",
          };
        }
        return acc;
      })
    );

    setShowTopstepXAccountDialog(false);

    // Save each account
    const tokenForSave = await currentUser.getIdToken();
    await Promise.all(
      pendingTopstepXAccounts.map(acc => {
        const sel = topstepXSelections[acc.id];
        return fetch('/api/firestore-add-finance', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenForSave}`
          },
          body: JSON.stringify({
            userId: currentUser.uid,
            finance: {
              ...acc,
              type: sel.type,
              firm: sel.firm,
              platform: "TopstepX",
            },
          }),
        });
      })
    );

    // Sync trade history for newly added TopstepX accounts
    const accountsToSync = [...pendingTopstepXAccounts];
    
    setPendingTopstepXAccounts([]);
    setTopstepXSelections({});
    setSelectAllTopstepXType("");
    setSelectAllTopstepXFirm("");

    // Start backfill immediately (no setTimeout). Update the store incrementally
    // as each account finishes so dashboard updates without refresh.
    const backfillToken = await currentUser.getIdToken();

    const mergeTradesById = (existing: any[], incoming: any[]) => {
      const existingIds = new Set(existing.map(t => String(t?.id ?? '')));
      const merged = [...existing];
      for (const t of incoming) {
        const id = String(t?.id ?? '');
        if (id && existingIds.has(id)) continue;
        if (id) existingIds.add(id);
        merged.push(t);
      }
      return merged;
    };

    // Sync trades for each newly added account
    for (const acc of accountsToSync) {
      try {
      

        // Calculate date range: last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const tradesRes = await fetch('/api/projectx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${backfillToken}`
          },
          body: JSON.stringify({
            action: 'fetchTrades',
            userId: currentUser.uid,
            accountId: acc.id,
            startTimestamp: startDate.toISOString(),
            endTimestamp: endDate.toISOString(),
            provider: 'TopstepX'
          }),
        });

        if (!tradesRes.ok) {
          const errorText = await tradesRes.text();
         
          continue;
        }

        const tradesData = await tradesRes.json();
    

        if (Array.isArray(tradesData.trades) && tradesData.trades.length > 0) {
          // Only update the UI store (server already saved to Firestore)
          useTradeStore.getState().setTrades((currentTrades: any[]) =>
            mergeTradesById(currentTrades, tradesData.trades)
          );
        }
      } catch (error) {
       
      }
    }

    // Reconcile with Firestore once at the end (ensures full consistency / de-dupe logic)
    await loadTradesFromFirestore();

    const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${backfillToken}`
      }
    });
    const data = await res.json();
    const accountsOnly = (data.finances || []).filter((f: any) => f.platform);
    setFirestoreFinances(accountsOnly);
    } catch (error) {
     
    } finally {
      setSavingTopstepXType(false);
    }
  };

const handleDeleteFinance = async (financeId: string, accountName: string) => {
  if (!currentUser?.uid || !financeId) return;

  // Get account platform before deleting
  const accountToDelete = firestoreFinances.find(f => String(f.id) === String(financeId));
  const platform = accountToDelete?.platform;

  // Show dialog
  setDeletedAccountName(accountName);
  setDeleteDialogStep("disconnecting");
  setShowDeleteDialog(true);
  setTimeout(() => setDeleteDialogStep("success"), 1500);

  // Update UI immediately
  setFirestoreFinances(prev => prev.filter(f => String(f.id) !== String(financeId)));
  useTradeStore.getState().setTrades(
    useTradeStore.getState().trades.filter(trade => 
      String(trade.accountId) !== String(financeId)
    )
  );

  // Remove from finances collection
  const token = await currentUser.getIdToken();
  await fetch('/api/firestore-remove-finance', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ userId: currentUser.uid, id: String(financeId) }),
  });

  // Remove from trades collection
  await fetch('/api/firestore-remove-trade', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ userId: currentUser.uid, accountId: financeId }),
  });

  // Remove token based on platform
  try {
    if (platform === 'TopstepX') {
      // Remove TopstepX token
      const tokenResponse = await fetch('/api/projectx', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'removeToken',
          userId: currentUser.uid,
          accountId: financeId,
          provider: 'TopstepX'
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
       
      } else {
        const result = await tokenResponse.json();
      
      }
    } else if (platform === 'Tradovate') {
      // Remove Tradovate token
      const tokenResponse = await fetch('/api/tradovate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'removeToken',
          userId: currentUser.uid,
          accountId: financeId
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
    
      } else {
        const result = await tokenResponse.json();
     
      }
    }
  } catch (error) {
   
  }
};

// ✅ NEW: Invalid token dialog acknowledge (no destructive actions)
const handleAcknowledgeInvalidTokenDialog = () => {
  setShowInvalidTokenDialog(false);
  setInvalidTokenAccounts([]);
};

  const accountsConnected = firestoreFinances.length;
  const portfolioValueEval = firestoreFinances
    .filter(acc => acc.type === 'Evaluation Account')
    .reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
  const portfolioValueFunded = firestoreFinances
    .filter(acc => acc.type === 'Funded Account')
    .reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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



  return (
    <PageContainer scrollable>
      <PageHead title="Tradescale" />
      <div className="pb-8">
        <div className="flex items-center justify-between -mt-5 pb-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Connect Accounts
          </h2>
        </div>
        {/* Top summary cards */}
        <div className="grid gap-4 grid-cols-4 mb-2.5">
  <Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
    <CardTitle className="text-sm font-medium">Evaluation Accounts Connected</CardTitle>
    <User className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold text-white">
      {
        firestoreFinances.filter(acc => acc.type === 'Evaluation Account').length
      }
    </div>
    <p className="text-xs text-muted-foreground">
      Number of Evaluation Accounts Connected
    </p>
  </CardContent>
</Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium">Portfolio Value Evaluation</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(portfolioValueEval)}
              </div>
              <p className="text-xs text-muted-foreground">
                All Evaluation Account Balances
              </p>
            </CardContent>
          </Card>
          <Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
    <CardTitle className="text-sm font-medium">Funded Accounts Connected</CardTitle>
    <User className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold text-white">
      {
        firestoreFinances.filter(acc => acc.type === 'Funded Account').length
      }
    </div>
    <p className="text-xs text-muted-foreground">
      Number of Funded Accounts Connected
    </p>
  </CardContent>
</Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium">Portfolio Value Funded</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(portfolioValueFunded)}
              </div>
              <p className="text-xs text-muted-foreground">
                All Funded Account Balances
              </p>
            </CardContent>
          </Card>
   
        </div>
        {/* Accounts Table */}
        <div className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium">Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-2">
                All connected trading accounts
              </div>
              <div className="flex gap-2 mb-6 mt-4">
           <Button
  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white"
  onClick={() => setShowFuturesPopup(true)}
>
  <Plus size={16} className="mr-1 relative" style={{ top: '0.5px' }} />
  Add Account
</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-white">
                  <thead>
                <tr className="border border-white/15 bg-transparent rounded-lg">
    <th className="px-2 py-2 font-medium text-left">POS</th> {/* NEW COLUMN */}
    <th className="px-2 py-2 font-medium text-left">Account</th>
    <th className="px-2 py-2 font-medium text-left">Balance</th>
    <th className="px-2 py-2 font-medium text-left">Type</th>
    <th className="px-2 py-2 font-medium text-left">Platform</th>
    <th className="px-2 py-2 font-medium text-left">Firm</th>
    <th className="px-2 py-2 font-medium text-left"></th>
  </tr>
                  </thead>
             <tbody>
  {firestoreFinances.length === 0 ? (
    <tr>
      <td colSpan={6} className="text-center py-4 text-white/60">
        
      </td>
    </tr>
  ) : (
firestoreFinances.map((acc, index) => (
  <tr key={acc.id} className="border-b border-white/10">
    <td className="px-2 py-2">{toRoman(index + 1)}</td> {/* NEW POS CELL */}
   <td className="px-2 py-2">
  <div className="border border-white/20 rounded px-2 py-1 inline-block">
    {acc.name}
  </div>
</td>
    <td className="px-2 py-2">{formatCurrency(Number(acc.balance) || 0)}</td>
    <td className="px-2 py-2">{acc.type}</td>

        {/* ✅ FIXED: Platform column */}
        <td className="px-2 py-2">
          <div className="flex items-center gap-1">
            <img
              src={
                acc.platform === "Tradovate" ? TLGO :
                acc.platform === "TopstepX" ? (theme === 'light' ? TPTXLight : TPTX) :
                acc.platform === "Volumetrica" ? VOLUMETRICA_LOGO :
                NONmatchLogo
              }
              alt="Account Logo"
              className={`${acc.platform === "Tradovate" ? "w-7 h-7" : acc.platform === "TopstepX" ? "w-17 h-7" : acc.platform === "Volumetrica" ? "w-17 h-7" : "w-9 h-9"} object-contain rounded ${acc.platform === "Tradovate" || acc.platform === "TopstepX" || acc.platform === "Volumetrica" ? "" : "border border-white/30"}`}
            />
            {acc.platform !== "TopstepX" && <span>{acc.platform}</span>}
          </div>
        </td>

        {/* ✅ FIXED: Firm column */}
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            {acc.firm && FIRM_LOGOS[acc.firm] && (
              typeof FIRM_LOGOS[acc.firm] === "string" ? (
                <img
                  src={FIRM_LOGOS[acc.firm]}
                  alt={acc.firm + " Logo"}
                  className="w-9 h-9 object-contain rounded border border-white/30"
                />
              ) : (
                (() => {
                  const Icon = FIRM_LOGOS[acc.firm];
                  return <Icon className="w-6 h-6 text-white border border-white/30 rounded" />;
                })()
              )
            )}
            <span>{acc.firm || "-"}</span>
          </div>
        </td>

        <td className="px-2 py-2">
   <button
  className="text-red-400 hover:text-red-600"
  onClick={() => handleDeleteFinance(acc.id, acc.name)}
  title="Delete Account"
>
  <X size={16} />
</button>
        </td>
      </tr>
    ))
  )}
</tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tradovate Account Type Dialog (multi-account, scrollable, select all) */}
        <Dialog open={showTradovateAccountDialog} onOpenChange={() => {}}>
          <DialogContent style={{ minWidth: 480, maxWidth: 600 }} className="no-x-close">

            <DialogHeader>
              <DialogTitle>
                <span className="text-lg">Set Tradovate Account Type & Firm</span>
              </DialogTitle>
            </DialogHeader>
            {pendingTradovateAccounts.length > 0 && (
              <div>
                {/* Select All Controls */}
                <div className="flex flex-row items-center gap-2 mb-4 border-b border-white/10 pb-2">
                  <span className="font-semibold text-white text-base mr-1 whitespace-nowrap">Select All:</span>
                  <Select value={selectAllType} onValueChange={val => {
                    setSelectAllType(val);
                    // Batch update all at once to avoid flicker
                    setTradovateSelections(prev => {
                      const updated = { ...prev };
                      for (const acc of pendingTradovateAccounts) {
                        updated[acc.id] = { ...updated[acc.id], type: val };
                      }
                      return updated;
                    });
                  }}>
                    <SelectTrigger className="min-w-[160px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                      <SelectValue placeholder="Type" className="text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-black">
                      <SelectItem value="Evaluation Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Evaluation Account</SelectItem>
                      <SelectItem value="Funded Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Funded Account</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectAllFirm} onValueChange={val => {
                    setSelectAllFirm(val);
                    // Batch update all at once to avoid flicker
                    setTradovateSelections(prev => {
                      const updated = { ...prev };
                      for (const acc of pendingTradovateAccounts) {
                        updated[acc.id] = { ...updated[acc.id], firm: val };
                      }
                      return updated;
                    });
                  }}>
                    <SelectTrigger className="min-w-[200px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                      <SelectValue placeholder="Firm" className="text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-black">
                      {FIRM_OPTIONS.map(firm => (
                        <SelectItem key={firm} value={firm} className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">{firm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Accounts List (scrollable if >5) */}
                <div style={{ maxHeight: 5 * 90 + 16, overflowY: pendingTradovateAccounts.length > 5 ? 'auto' : 'visible' }} className="space-y-4 mb-4 pr-1">
                  {pendingTradovateAccounts.map((acc, idx) => (
                    <div key={acc.id} className="flex items-center gap-4 p-3 border border-white/15 rounded bg-black/40">
                      <img src={TLGO} alt="Tradovate" className="w-12 h-12 object-contain rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-base truncate">{acc.name}</div>
                        <div className="text-sm text-white/80 truncate">Balance: ${Number(acc.balance).toLocaleString()}</div>
                        <div className="flex gap-2 mt-2">
                          <Select
                            value={tradovateSelections[acc.id]?.type || ""}
                            onValueChange={val => setTradovateSelections(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], type: val } }))}
                          >
                            <SelectTrigger className="min-w-[140px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                              <SelectValue placeholder="Type" className="text-white" />
                            </SelectTrigger>
                            <SelectContent className="bg-black">
                              <SelectItem value="Evaluation Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Evaluation Account</SelectItem>
                              <SelectItem value="Funded Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Funded Account</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={tradovateSelections[acc.id]?.firm || ""}
                            onValueChange={val => setTradovateSelections(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], firm: val } }))}
                          >
                            <SelectTrigger className="min-w-[140px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                              <SelectValue placeholder="Firm" className="text-white" />
                            </SelectTrigger>
                            <SelectContent className="bg-black">
                              {FIRM_OPTIONS.map(firm => (
                                <SelectItem key={firm} value={firm} className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">{firm}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center mt-2">
                  <Button
                    onClick={handleSaveTradovateAccountTypes}
                    disabled={pendingTradovateAccounts.some(acc => !tradovateSelections[acc.id]?.type || !tradovateSelections[acc.id]?.firm)}
                    className="h-9 px-6 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform text-base"
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Volumetrica Account Type Dialog */}
        <Dialog open={showVolumetricaAccountDialog} onOpenChange={() => {}}>
          <DialogContent style={{ minWidth: 480, maxWidth: 600 }} className="no-x-close">
            <DialogHeader>
              <DialogTitle>
                <span className="text-lg">Set Volumetrica Account Type & Firm</span>
              </DialogTitle>
            </DialogHeader>
            {pendingVolumetricaAccounts.length > 0 && (
              <div>
                <div className="flex flex-row items-center gap-2 mb-4 border-b border-white/10 pb-2">
                  <span className="font-semibold text-white text-base mr-1 whitespace-nowrap">Select All:</span>
                  <Select value={selectAllVolumetricaType} onValueChange={val => {
                    setSelectAllVolumetricaType(val);
                    setVolumetricaSelections(prev => {
                      const updated = { ...prev };
                      for (const acc of pendingVolumetricaAccounts) {
                        updated[acc.id] = { ...updated[acc.id], type: val };
                      }
                      return updated;
                    });
                  }}>
                    <SelectTrigger className="min-w-[160px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                      <SelectValue placeholder="Type" className="text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-black">
                      <SelectItem value="Evaluation Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Evaluation Account</SelectItem>
                      <SelectItem value="Funded Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Funded Account</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectAllVolumetricaFirm} onValueChange={val => {
                    setSelectAllVolumetricaFirm(val);
                    setVolumetricaSelections(prev => {
                      const updated = { ...prev };
                      for (const acc of pendingVolumetricaAccounts) {
                        updated[acc.id] = { ...updated[acc.id], firm: val };
                      }
                      return updated;
                    });
                  }}>
                    <SelectTrigger className="min-w-[200px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                      <SelectValue placeholder="Firm" className="text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-black">
                      {FIRM_OPTIONS.map(firm => (
                        <SelectItem key={firm} value={firm} className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">{firm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ maxHeight: 5 * 90 + 16, overflowY: pendingVolumetricaAccounts.length > 5 ? 'auto' : 'visible' }} className="space-y-4 mb-4 pr-1">
                  {pendingVolumetricaAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-4 p-3 border border-white/15 rounded bg-black/40">
                      <img src={Unknown} alt="Volumetrica" className="w-12 h-12 object-contain rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-base truncate">{acc.name}</div>
                        <div className="text-sm text-white/80 truncate">Balance: ${Number(acc.balance).toLocaleString()}</div>
                        <div className="flex gap-2 mt-2">
                          <Select
                            value={volumetricaSelections[acc.id]?.type || ""}
                            onValueChange={val => setVolumetricaSelections(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], type: val } }))}
                          >
                            <SelectTrigger className="min-w-[140px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                              <SelectValue placeholder="Type" className="text-white" />
                            </SelectTrigger>
                            <SelectContent className="bg-black">
                              <SelectItem value="Evaluation Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Evaluation Account</SelectItem>
                              <SelectItem value="Funded Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Funded Account</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={volumetricaSelections[acc.id]?.firm || ""}
                            onValueChange={val => setVolumetricaSelections(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], firm: val } }))}
                          >
                            <SelectTrigger className="min-w-[140px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                              <SelectValue placeholder="Firm" className="text-white" />
                            </SelectTrigger>
                            <SelectContent className="bg-black">
                              {FIRM_OPTIONS.map(firm => (
                                <SelectItem key={firm} value={firm} className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">{firm}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center mt-2">
                  <Button
                    onClick={handleSaveVolumetricaAccountTypes}
                    disabled={pendingVolumetricaAccounts.some(acc => !volumetricaSelections[acc.id]?.type || !volumetricaSelections[acc.id]?.firm)}
                    className="h-9 px-6 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform text-base"
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* TopstepX Account Type Dialog */}
        <Dialog open={showTopstepXAccountDialog} onOpenChange={() => {}}>
          <DialogContent style={{ minWidth: 480, maxWidth: 600 }} className="no-x-close">
            <DialogHeader>
              <DialogTitle>
                <span className="text-lg">Set TopstepX Account Type & Firm</span>
              </DialogTitle>
            </DialogHeader>
            {pendingTopstepXAccounts.length > 0 && (
              <div>
                {/* Select All Controls */}
                <div className="flex flex-row items-center gap-2 mb-4 border-b border-white/10 pb-2">
                  <span className="font-semibold text-white text-base mr-1 whitespace-nowrap">Select All:</span>
                  <Select value={selectAllTopstepXType} onValueChange={val => {
                    setSelectAllTopstepXType(val);
                    setTopstepXSelections(prev => {
                      const updated = { ...prev };
                      for (const acc of pendingTopstepXAccounts) {
                        updated[acc.id] = { ...updated[acc.id], type: val };
                      }
                      return updated;
                    });
                  }}>
                    <SelectTrigger className="min-w-[160px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                      <SelectValue placeholder="Type" className="text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-black">
                      <SelectItem value="Evaluation Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Evaluation Account</SelectItem>
                      <SelectItem value="Funded Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Funded Account</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectAllTopstepXFirm} onValueChange={val => {
                    setSelectAllTopstepXFirm(val);
                    setTopstepXSelections(prev => {
                      const updated = { ...prev };
                      for (const acc of pendingTopstepXAccounts) {
                        updated[acc.id] = { ...updated[acc.id], firm: val };
                      }
                      return updated;
                    });
                  }}>
                    <SelectTrigger className="min-w-[200px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                      <SelectValue placeholder="Firm" className="text-white" />
                    </SelectTrigger>
                    <SelectContent className="bg-black">
                      {FIRM_OPTIONS.map(firm => (
                        <SelectItem key={firm} value={firm} className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">{firm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Accounts List (scrollable if >5) */}
                <div style={{ maxHeight: 5 * 90 + 16, overflowY: pendingTopstepXAccounts.length > 5 ? 'auto' : 'visible' }} className="space-y-4 mb-4 pr-1">
                  {pendingTopstepXAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-4 p-3 border border-white/15 rounded bg-black/40">
                      <img src={LG34} alt="TopstepX" className="w-12 h-12 object-contain rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-base truncate">{acc.name}</div>
                        <div className="text-sm text-white/80 truncate">Balance: ${Number(acc.balance).toLocaleString()}</div>
                        <div className="flex gap-2 mt-2">
                          <Select
                            value={topstepXSelections[acc.id]?.type || ""}
                            onValueChange={val => setTopstepXSelections(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], type: val } }))}
                          >
                            <SelectTrigger className="min-w-[140px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                              <SelectValue placeholder="Type" className="text-white" />
                            </SelectTrigger>
                            <SelectContent className="bg-black">
                              <SelectItem value="Evaluation Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Evaluation Account</SelectItem>
                              <SelectItem value="Funded Account" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">Funded Account</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={topstepXSelections[acc.id]?.firm || ""}
                            onValueChange={val => setTopstepXSelections(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], firm: val } }))}
                          >
                            <SelectTrigger className="min-w-[140px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
                              <SelectValue placeholder="Firm" className="text-white" />
                            </SelectTrigger>
                            <SelectContent className="bg-black">
                              {FIRM_OPTIONS.map(firm => (
                                <SelectItem key={firm} value={firm} className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">{firm}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center mt-2">
                  <Button
                    onClick={handleSaveTopstepXAccountTypes}
                    disabled={pendingTopstepXAccounts.some(acc => !topstepXSelections[acc.id]?.type || !topstepXSelections[acc.id]?.firm)}
                    className="h-9 px-6 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform text-base"
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <DialogContent>
    <div className="flex flex-col items-center justify-center py-6">
      <img src={LG34} alt="Connection Removed" className="w-32 h-24 mb-4" />
      {deleteDialogStep === "disconnecting" ? (
        <>
          <div className="text-lg font-semibold text-center mb-2">
            Disconnecting Account:  <br /> <b>{deletedAccountName}</b>
          </div>
          <div className="text-sm text-muted-foreground text-center mb-4">
            Please wait while we disconnect your account.
          </div>
          <Button
            size="default"
            variant="outline"
            className="border-white/20 text-white mt-2 px-6 opacity-50 cursor-not-allowed"
            disabled
          >
            Continue
          </Button>
        </>
      ) : (
        <>
          <div className="text-lg font-semibold text-center mb-2">
            Connection removed successfully
          </div>
          <div className="text-sm text-muted-foreground text-center mb-4">
            {deletedAccountName && <>Account <b>{deletedAccountName}</b> has been disconnected.</>}
          </div>
   <Button
  onClick={() => setShowDeleteDialog(false)}
  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
>
  Continue
</Button>
        </>
      )}
    </div>
  </DialogContent>
</Dialog>

{/* ✅ NEW: Invalid Token Dialog */}
<Dialog
  open={showInvalidTokenDialog}
  onOpenChange={(open) => {
    setShowInvalidTokenDialog(open);
    if (!open) setInvalidTokenAccounts([]);
  }}
>
  <DialogContent>
    <div className="flex flex-col items-center justify-center py-6">
      <img src={LG34} alt="Account Access Expired" className="w-32 h-24 mb-4" />
      <div className="text-lg font-semibold text-center mb-2">
       Issue in automatic account re-authorization
      </div>
      <div className="text-sm text-muted-foreground text-center mb-4">
        One or more connected accounts need to be re-authorized:
      </div>
      
      <div className="space-y-2 mb-6 w-full">
        {invalidTokenAccounts.map((account, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-transparent border border-white/15 rounded">
            <div className="flex flex-col items-center justify-center gap-1">
              <img src={TLGO} alt="Tradovate" className="w-8 h-8 object-contain rounded" />
              {resolveFirmLogoSrc(account) && (
                <img
                  src={resolveFirmLogoSrc(account) as string}
                  alt="Firm"
                  className="w-8 h-8 object-contain rounded border border-white/30"
                />
              )}
            </div>
            <div>
              <div className="font-medium text-white">
                {resolveAccountDisplayName(account)}
              </div>
              <div className="text-xs text-muted-foreground">
                AccountID: {String(account?.accountId ?? account?.id ?? account?.accountNumber ?? account?.account ?? `#${index + 1}`)}
              </div>
              {account.lastError && (
                <div className="text-xs text-white mt-1">
                  Reason: {account.lastError}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-sm text-muted-foreground text-center mb-4">
        To reconnect, <b>"Remove with the X button"</b> the invalid Accounts and click <b>"Add Account"</b> and go through the Tradovate authorization process again.
      </div>
      
      <Button
        onClick={handleAcknowledgeInvalidTokenDialog}
        className="h-9 px-6 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
      >
        OK
      </Button>
    </div>
  </DialogContent>
</Dialog>

        <ConnectFuturesPopup open={showFuturesPopup} onOpenChange={setShowFuturesPopup} onAccountsConnected={loadFinances} />
      </div>
    </PageContainer>
  );
}