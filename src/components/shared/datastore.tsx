import { create } from 'zustand'
import { auth } from '@/config/firebase'

let tradesLoadInFlight: Promise<void> | null = null;
let lastTradesLoadedAt = 0;
let lastTradesLoadedForUid: string | null = null;

export interface Trade {
  id: string
  userId: string
  symbol: string
  pnl: number
  account: string
  date: string
  screenshot: string | null
  description?: string 
  strategy?: string
  session?: string
  setupChecklist?: { text: string; checked: boolean }[]
  notes?: { headline: string; points: string[] }[]
  assetCategory?: string
  screenshot2?: string | null
  screenshotHeadline?: string
  screenshot2Headline?: string
  screenshot2Description?: string
  rating?: number
  // Allow extra fields for flexibility
  [key: string]: any
}

interface Finance {
  id: string
  userId: string
  type: string // allow any type for PropT compatibility
  firm?: string
  description?: string
  amount?: number
  date: string
  // Allow extra fields for PropT
  [key: string]: any
}

interface FilterCriteria {
  symbol: string;
  account: string;
}

interface FinanceStore {
  finances: Finance[]
  addFinance: (finance: Omit<Finance, 'id' | 'date' | 'userId'>) => Promise<void>
  removeFinance: (id: string) => Promise<void>
  updateFinance: (updated: Finance) => void
  getTotalEarnings: () => number
  getTotalExpenses: () => number
  getNetIncome: () => number
  getFinancesByType: (type: string) => Finance[]
}

interface TradeStore {
  trades: Trade[]
    setTrades: (newTrades: Trade[] | ((prevTrades: Trade[]) => Trade[])) => void
  addTrade: (trade: Omit<Trade, 'id' | 'userId'>) => Promise<void>
  addTrades: (trades: Omit<Trade, 'userId'>[]) => Promise<void>;
  removeTrade: (id: string) => Promise<void>
  getTotalPnL: () => number
  getRecentTrades: () => Trade[]
  getDatePnL: (date: string) => number
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<void>
  filterCriteria: FilterCriteria
  setFilterCriteria: (criteria: FilterCriteria) => void
  clearFilters: () => void
  getFilteredTrades: () => Trade[]
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  trades: [],
  filterCriteria: {
    symbol: "",
    account: ""
  },

    setTrades: (newTrades) => set(state => ({
    ...state,
    trades: typeof newTrades === 'function' ? newTrades(state.trades) : newTrades
  })),


  setFilterCriteria: (criteria) => {
    set({ filterCriteria: criteria });
   
  },

  clearFilters: () => {
    set({
      filterCriteria: {
        symbol: "",
        account: ""
      }
    });
   
  },

  addTrade: async (trade) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No authenticated user');

    // Create optimistic trade object
    const optimisticTrade = {
      ...trade,
      id: crypto.randomUUID(),
      userId: currentUser.uid
    };

    // Optimistically update Zustand store immediately
    set(state => ({
      trades: [...state.trades, optimisticTrade]
    }));

    try {
      // Now call the API in the background
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/firestore-add-trade', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.uid, trade: optimisticTrade }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to save trade');
      // Optionally: replace the optimistic trade with the saved one if Firestore adds fields
    } catch (error) {
    
      // Optionally: remove the optimistic trade or reload trades from Firestore
    }
  },

  removeTrade: async (id) => {
    // Optimistically update UI first
    set(state => ({
      trades: state.trades.filter(t => t.id !== id)
    }));

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No authenticated user');

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/firestore-remove-trade', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.uid, id }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to remove trade');
      // Optionally: reload trades from Firestore if you want to ensure consistency
    } catch (error) {
    
      // Optionally: reload trades from Firestore to revert UI if error
    }
  },

  addTrades: async (trades: Omit<Trade, 'userId'>[]) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No authenticated user');
    const userId = currentUser.uid;

    // Optimistically update Zustand store (with de-dupe to avoid temporary double-renders)
    set(state => {
      const existingIds = new Set(state.trades.map(t => String(t.id)));
      const existingTopstepKeys = new Set(
        state.trades
          .filter(t => (t as any)?.provider === 'TopstepX' || (t as any)?.platform === 'TopstepX')
          .map(t => {
            const topstepXTradeId = (t as any)?.topstepXTradeId;
            const creationTimestamp = (t as any)?.creationTimestamp;
            return topstepXTradeId && creationTimestamp ? `${topstepXTradeId}::${creationTimestamp}` : '';
          })
          .filter(Boolean)
      );

      const incoming: Trade[] = [];
      for (const trade of trades) {
        const id = (trade as any)?.id != null ? String((trade as any).id) : '';
        if (id && existingIds.has(id)) continue;

        const isTopstep = (trade as any)?.provider === 'TopstepX' || (trade as any)?.platform === 'TopstepX';
        const topstepXTradeId = (trade as any)?.topstepXTradeId;
        const creationTimestamp = (trade as any)?.creationTimestamp;
        if (isTopstep && topstepXTradeId && creationTimestamp) {
          const key = `${topstepXTradeId}::${creationTimestamp}`;
          if (existingTopstepKeys.has(key)) continue;
          existingTopstepKeys.add(key);
        }

        if (id) existingIds.add(id);
        incoming.push({ ...(trade as any), userId });
      }

      return { trades: [...state.trades, ...incoming] };
    });

    // Optionally, send to Firestore in bulk (or one by one)
    const token = await currentUser.getIdToken();
    for (const trade of trades) {
      await fetch('/api/firestore-add-trade', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, trade: { ...trade, userId } }),
      });
    }
  },

  getFilteredTrades: () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
    
      return [];
    }

    const { trades, filterCriteria } = get();
    const userTrades = trades.filter(trade => trade.userId === currentUser.uid);
  

    const hasActiveFilters = Object.values(filterCriteria).some(value => value !== "");
    if (!hasActiveFilters) {
     
      return userTrades;
    }

    const filtered = userTrades.filter(trade => {
      const matchesSymbol = !filterCriteria.symbol || 
        trade.symbol.toLowerCase().includes(filterCriteria.symbol.toLowerCase());
      const matchesAccount = !filterCriteria.account || 
        trade.account.toLowerCase().includes(filterCriteria.account.toLowerCase());
      return matchesSymbol && matchesAccount;
    });
  
    return filtered;
  },

  getTotalPnL: () => {
    const filteredTrades = get().getFilteredTrades()
    const total = filteredTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0)
   
    return total;
  },

  getRecentTrades: () => {
    const filteredTrades = get().getFilteredTrades()
    const recent = [...filteredTrades]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
   
    return recent;
  },

  getDatePnL: (date) => {
    const filteredTrades = get().getFilteredTrades()
    const datePnL = filteredTrades
      .filter(trade => trade.date === date)
      .reduce((sum, trade) => sum + Number(trade.pnl), 0)
   
    return datePnL;
  },

  updateTrade: async (id, updates) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No authenticated user');

    // Optimistically update UI
    set(state => ({
      trades: state.trades.map(t =>
        t.id === id ? { ...t, ...updates } : t
      )
    }));

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/firestore-update-trade', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.uid, id, updates }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update trade');
      // Optionally: reload trades from Firestore for consistency
    } catch (error) {
     
      // Optionally: revert optimistic update or reload trades
    }
  }
}))

// Load trades from Firestore on startup or after login
export const loadTradesFromFirestore = async (options?: { force?: boolean; maxAgeMs?: number }) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
   
    return;
  }

  const force = options?.force === true;
  const maxAgeMs = typeof options?.maxAgeMs === 'number' ? options?.maxAgeMs : 60_000;
  const uid = currentUser.uid;

  if (!force && lastTradesLoadedForUid === uid) {
    const ageMs = Date.now() - lastTradesLoadedAt;
    const existing = useTradeStore.getState().trades;
    if (existing?.length && ageMs >= 0 && ageMs < maxAgeMs) {
      return;
    }
  }

  if (!force && tradesLoadInFlight && lastTradesLoadedForUid === uid) {
    await tradesLoadInFlight;
    return;
  }

  const run = (async () => {
  try {
    // Fetching trades from Firestore
    const token = await currentUser.getIdToken();
    const response = await fetch(`/api/firestore-get-trades?userId=${currentUser.uid}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
  

    // --- Normalize trades so all screenshot fields always exist ---
    const normalizedTrades = (result.trades || []).map(trade => ({
      ...trade,
      screenshot: trade.screenshot ?? "",
      screenshotHeadline: trade.screenshotHeadline ?? "",
      screenshot2: trade.screenshot2 ?? "",
      screenshot2Headline: trade.screenshot2Headline ?? "",
    }));

    // --- De-dupe known TopstepX duplicates (same upstream trade) ---
    // Only applies when we have strong identifiers; otherwise keep all rows.
    const seenTopstepKeys = new Set<string>();
    const dedupedTrades = normalizedTrades.filter((t: any) => {
      const isTopstep = t?.provider === 'TopstepX' || t?.platform === 'TopstepX';
      const topstepXTradeId = t?.topstepXTradeId;
      const creationTimestamp = t?.creationTimestamp;
      if (!isTopstep || !topstepXTradeId || !creationTimestamp) return true;
      const key = `${topstepXTradeId}::${creationTimestamp}`;
      if (seenTopstepKeys.has(key)) return false;
      seenTopstepKeys.add(key);
      return true;
    });

    useTradeStore.setState({ trades: dedupedTrades });
    lastTradesLoadedAt = Date.now();
    lastTradesLoadedForUid = uid;
  } catch (error) {
   
  }
  })();

  if (!force) {
    tradesLoadInFlight = run;
    lastTradesLoadedForUid = uid;
  }

  try {
    await run;
  } finally {
    if (tradesLoadInFlight === run) {
      tradesLoadInFlight = null;
    }
  }
}

export const loadAllTradesFromFirestore = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return;
  }

  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(`/api/firestore-get-trades?userId=${currentUser.uid}&all=1`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();

    const normalizedTrades = (result.trades || []).map((trade: any) => ({
      ...trade,
      screenshot: trade.screenshot ?? "",
      screenshotHeadline: trade.screenshotHeadline ?? "",
      screenshot2: trade.screenshot2 ?? "",
      screenshot2Headline: trade.screenshot2Headline ?? "",
    }));

    const seenTopstepKeys = new Set<string>();
    const dedupedTrades = normalizedTrades.filter((t: any) => {
      const isTopstep = t?.provider === 'TopstepX' || t?.platform === 'TopstepX';
      const topstepXTradeId = t?.topstepXTradeId;
      const creationTimestamp = t?.creationTimestamp;
      if (!isTopstep || !topstepXTradeId || !creationTimestamp) return true;
      const key = `${topstepXTradeId}::${creationTimestamp}`;
      if (seenTopstepKeys.has(key)) return false;
      seenTopstepKeys.add(key);
      return true;
    });

    useTradeStore.setState({ trades: dedupedTrades });
    lastTradesLoadedAt = Date.now();
    lastTradesLoadedForUid = currentUser.uid;
  } catch (error) {
  
  }
}

// --- FinanceStore using Firestore, not IndexedDB ---
export const useFinanceStore = create<FinanceStore>((set, get) => ({
  finances: [],
  addFinance: async (finance) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No authenticated user');

    const newFinance = {
      ...finance,
      id: crypto.randomUUID(),
      userId: currentUser.uid,
      date: new Date().toISOString().split('T')[0]
    }
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/firestore-add-finance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.uid, finance: newFinance }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to save finance');
      set(state => ({
        finances: [...state.finances, result.finance]
      }));
    } catch (error) {
    
    }
  },

  removeFinance: async (id) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No authenticated user');

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/firestore-remove-finance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.uid, id }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to remove finance');
      set(state => ({
        finances: state.finances.filter(f => f.id !== id)
      }));
    } catch (error) {
     
    }
  },

  updateFinance: (updated) => {
    set(state => ({
      finances: state.finances.map(f =>
        f.id === updated.id ? { ...f, ...updated } : f
      )
    }));
  },

  getTotalEarnings: () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return 0;

    const { finances } = get()
    return finances
      .filter(f => f.userId === currentUser.uid && f.type === 'earning')
      .reduce((sum, f) => sum + (f.amount || 0), 0)
  },

  getTotalExpenses: () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return 0;

    const { finances } = get()
    return finances
      .filter(f => f.userId === currentUser.uid && f.type === 'expense')
      .reduce((sum, f) => sum + (f.amount || 0), 0)
  },

  getNetIncome: () => {
    const { getTotalEarnings, getTotalExpenses } = get()
    return getTotalEarnings() - getTotalExpenses()
  },

  getFinancesByType: (type) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    const { finances } = get()
    return finances.filter(f => 
      f.userId === currentUser.uid && f.type === type
    )
  }
}))

// Load finances from Firestore on startup or after login
export const loadFinancesFromFirestore = async (userId: string, token?: string) => {
  try {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`/api/firestore-get-finances?userId=${userId}`, { headers });
    const result = await response.json();
    useFinanceStore.setState({ finances: result.finances || [] });
  
  } catch (error) {
   
  }
}