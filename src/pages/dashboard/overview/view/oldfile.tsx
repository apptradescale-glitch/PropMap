import { TradingCalendar } from '../trading-calendar';
import { BarGraph } from '../bar-graph';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { PieGraph } from '../pie-graph';
import PageContainer from '@/components/layout/page-container';
import { RecentSales } from '../recent-sales';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownRight, Calendar, PieChart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTradeStore, useFinanceStore, loadTradesFromFirestore, loadFinancesFromFirestore } from '@/components/shared/datastore';
import { useAuth } from '@/context/FAuth';
import PageHead from '@/components/shared/page-head';

export interface Finance {
  id: string;
  type: 'earning' | 'expense';
  firm?: string;
  description?: string;
  amount: number;
  date: string;
  userId: string;
}

export default function OverViewPage() {
  const { currentUser } = useAuth();
  const [broker, setBroker] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [totalPnL, setTotalPnL] = useState(0);

  const trades = useTradeStore(state => state.trades);
  const finances = useFinanceStore(state => state.finances);

  // --- Myfxbook Integration ---
  const [myfxbookTrades, setMyfxbookTrades] = useState<any[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);

  // Fetch Myfxbook connected accounts
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const token = await currentUser.getIdToken();
      fetch(`/api/myfxbook?userId=${currentUser.uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setConnectedAccounts(data.accounts || []));
    })();
  }, [currentUser]);

  // Fetch Myfxbook trades for each account
  useEffect(() => {
    if (!currentUser || !connectedAccounts.length) return;
    const fetchAll = async () => {
      let allTrades: any[] = [];
      for (const acc of connectedAccounts) {
        if (!acc.accountId) continue;
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/myfxbook?userId=${currentUser.uid}&trades=1&accountId=${acc.accountId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data.history)) {
          allTrades = allTrades.concat(
            data.history.map((trade: any, idx: number) => ({
              id: `myfxbook-${acc.accountId}-${idx}-${trade.closeTime}`,
              userId: currentUser.uid,
              date: trade.closeTime
                ? (() => {
                    const [mm, dd, yyyy] = trade.closeTime.split(' ')[0].split('/');
                    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                  })()
                : '',
              symbol: trade.symbol,
              account: acc.name,
              pnl: trade.profit,
              source: 'myfxbook'
            }))
          );
        }
      }
      setMyfxbookTrades(allTrades);
    };
    fetchAll();
  }, [currentUser, connectedAccounts]);
  // --- End Myfxbook Integration ---

  // --- FIRESTORE FUNCTIONS ---
  async function addFinanceToFirestore(userId: string, finance: Omit<Finance, 'id' | 'date'> & { date: string }) {
    const id = crypto.randomUUID();
    const financeWithId: Finance = { ...finance, id, userId };
    const token = await currentUser!.getIdToken();
    const response = await fetch('/api/firestore-add-finance', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId, finance: financeWithId }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to add finance');
    return result.finance;
  }
  // --------------------------

  useEffect(() => {
    if (currentUser) {
      loadTradesFromFirestore({ force: true });
      currentUser.getIdToken().then(token => {
        loadFinancesFromFirestore(currentUser.uid, token);
      });
    }
  }, [currentUser]);

  // --- Calculate totalPnL from both manual and Myfxbook trades ---
  useEffect(() => {
    if (!currentUser) {
      setTotalPnL(0);
      return;
    }
    // Manual trades (add source for clarity)
    const manualTrades = trades
      .filter(trade => trade.userId === currentUser.uid)
      .map(trade => ({ ...trade, source: 'manual' }));
    // Merge both sources
    const allTrades = [...manualTrades, ...myfxbookTrades];
    const total = allTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
    setTotalPnL(total);
  }, [trades, myfxbookTrades, currentUser]);
  // --------------------------------------------------------------

  // FIX: Always store date as YYYY-MM-DD string, never as ISO string!
  const handlePayoutSubmit = () => {
    if (!currentUser || !broker || !payoutAmount) return;

    const optimisticFinance = {
      id: crypto.randomUUID(),
      type: 'earning',
      firm: broker,
      amount: Number(payoutAmount),
      userId: currentUser.uid,
      date: payoutDate, // <-- store as plain string!
    };

    useFinanceStore.setState(state => ({
      finances: [...state.finances, optimisticFinance]
    }));
    setBroker("");
    setPayoutAmount("");
    setPayoutDate(() => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });

    addFinanceToFirestore(currentUser.uid, optimisticFinance)
      .then(() => {})
      .catch(() => {});
  };

  const handleExpenseSubmit = () => {
    if (!currentUser || !expenseDesc || !expenseAmount) return;

    const amount = Number(expenseAmount);
    const negativeAmount = amount > 0 ? -amount : amount;

    const optimisticFinance = {
      id: crypto.randomUUID(),
      type: 'expense',
      description: expenseDesc,
      amount: negativeAmount,
      userId: currentUser.uid,
      date: expenseDate, // <-- store as plain string!
    };

    useFinanceStore.setState(state => ({
      finances: [...state.finances, optimisticFinance]
    }));
    setExpenseDesc("");
    setExpenseAmount("");
    setExpenseDate(() => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });

    addFinanceToFirestore(currentUser.uid, optimisticFinance)
      .then(() => {})
      .catch(() => {});
  };

  const getTotalEarnings = () => {
    return finances
      .filter(f => f.userId === currentUser?.uid && f.type === 'earning')
      .reduce((sum, f) => sum + f.amount, 0);
  };

  const getTotalExpenses = () => {
    return finances
      .filter(f => f.userId === currentUser?.uid && f.type === 'expense')
      .reduce((sum, f) => sum + f.amount, 0);
  };

  const totalRevenue = getTotalEarnings() + getTotalExpenses();

  const formatCurrency = (value: number) => {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absValue);
    return isNegative ? `-${formatted}` : formatted;
  };

  // Calendar icon click logic for payout and expense date
  const handleCalendarClick = (inputId: string) => {
    const input = document.getElementById(inputId);
    if (input) {
      // @ts-ignore
      input.showPicker && input.showPicker();
    }
  };

  return (
    <PageContainer scrollable>
        <PageHead title="Tradescale" />
      <div className="space-y-2 pb-8">
        <div className="flex items-center justify-between -mt-5 pb-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Dashboard
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="h-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
              <CardTitle className="text-sm font-medium">
                Trading Profits
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent className="pt-3 pb-1">
              <div>
                <div className={`text-2xl font-bold ${
                totalPnL >= 0 ? 'text-white' : 'text-white'
              }`}>
                {formatCurrency(totalPnL)}
              </div>
              <p className="text-xs text-muted-foreground mt-0">
                Generated Gross Profit
              </p>
              </div>
            </CardContent>
          </Card>
          <Card className="h-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
              <div className="text-sm font-medium">Avg. Win</div>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4 pb-0">
              {(() => {
                if (!currentUser) return <p className="text-xs text-muted-foreground"></p>;
                const manualTrades = trades.filter(t => t.userId === currentUser.uid);
                const allTrades = [...manualTrades, ...myfxbookTrades];
                const winningTrades = allTrades.filter(trade => trade.pnl > 0);
                const losingTrades = allTrades.filter(trade => trade.pnl < 0);
                const totalWins = winningTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
                const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0));
                const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
                const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
                
                // Calculate proportional width based on max value
                const maxValue = Math.max(avgWin, avgLoss);
                const winWidth = maxValue > 0 ? (avgWin / maxValue) * 100 : 0;

                return (
                  <div>
                    <div className="flex items-center mb-2">
                      <span className="text-xs font-semibold text-emerald-500">
                        ${avgWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-background">
                      <div 
                        className="h-full transition-all duration-500 border border-emerald-800"
                        style={{
                          width: `${winWidth}%`,
                          boxShadow: '0 0 12px 2px #10b981, 0 0 24px 4px #10b98155'
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          <Card className="h-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
              <div className="text-sm font-medium">Avg. Loss</div>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4 pb-0">
              {(() => {
                if (!currentUser) return <p className="text-xs text-muted-foreground"></p>;
                const manualTrades = trades.filter(t => t.userId === currentUser.uid);
                const allTrades = [...manualTrades, ...myfxbookTrades];
                const winningTrades = allTrades.filter(trade => trade.pnl > 0);
                const losingTrades = allTrades.filter(trade => trade.pnl < 0);
                const totalWins = winningTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
                const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0));
                const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
                const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
                
                // Calculate proportional width based on max value
                const maxValue = Math.max(avgWin, avgLoss);
                const lossWidth = maxValue > 0 ? (avgLoss / maxValue) * 100 : 0;

                return (
                  <div>
                    <div className="flex items-center mb-2">
                      <span className="text-xs font-semibold text-red-500">
                        ${avgLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 bg-background">
                      <div 
                        className="h-full transition-all duration-500 border border-red-800"
                        style={{
                          width: `${lossWidth}%`,
                          boxShadow: '0 0 12px 2px #dc2626, 0 0 24px 4px #dc262655'
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          <Card className="h-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
              <div className="text-sm font-medium">Win Rate</div>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 pb-1">
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <div className="text-2xl font-bold">
                    {(() => {
                      if (!currentUser) return '—';
                      const manualTrades = trades.filter(t => t.userId === currentUser.uid);
                      const allTrades = [...manualTrades, ...myfxbookTrades];
                      const nonZeroTrades = allTrades.filter(trade => trade.pnl !== 0);
                      const winningTrades = allTrades.filter(trade => trade.pnl > 0);
                      const winRate = nonZeroTrades.length > 0 
                        ? (winningTrades.length / nonZeroTrades.length) * 100 
                        : 0;
                      return winRate.toFixed(2) + '%';
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Trade Win %
                  </p>
                </div>
                <div className="w-20 h-20">
                  {(() => {
                    if (!currentUser) return null;
                    const manualTrades = trades.filter(t => t.userId === currentUser.uid);
                    const allTrades = [...manualTrades, ...myfxbookTrades];
                    const nonZeroTrades = allTrades.filter(trade => trade.pnl !== 0);
                    const winningTrades = allTrades.filter(trade => trade.pnl > 0);
                    const winRate = nonZeroTrades.length > 0 
                      ? (winningTrades.length / nonZeroTrades.length) * 100 
                      : 0;
                    
                    // Calculate the stroke-dashoffset for the semicircle
                    const circumference = Math.PI * 50; // half circle circumference
                    const winOffset = circumference - (winRate / 100) * circumference;
                    const lossLength = ((100 - winRate) / 100) * circumference;
                    
                    return (
                      <svg viewBox="0 0 120 60" className="w-full h-full">
                        {/* Red background (losing percentage) */}
                        <path
                          d="M 0 60 A 50 50 0 0 1 100 60"
                          fill="none"
                          stroke="#c42c2c"
                          strokeWidth="6"
                          opacity="0.5"
                        />
                        {/* Green progress (winning percentage) */}
                        <path
                          d="M 0 60 A 50 50 0 0 1 100 60"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="6"
                          strokeLinecap="round"
                          className="transition-all duration-500"
                          strokeDasharray={circumference}
                          strokeDashoffset={winOffset}
                          style={{
                            filter: 'drop-shadow(0 0 12px 2px #10b981) drop-shadow(0 0 24px 4px rgba(16, 185, 129, 0.3))'
                          }}
                        />
                      </svg>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="h-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4">
              <div className="text-sm font-medium">Avg. Risk/Reward</div>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 pb-1">
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <div className="text-2xl font-bold">
                    {(() => {
                      if (!currentUser) return '—';
                      const manualTrades = trades.filter(t => t.userId === currentUser.uid);
                      const allTrades = [...manualTrades, ...myfxbookTrades];
                      const winningTrades = allTrades.filter(trade => trade.pnl > 0);
                      const losingTrades = allTrades.filter(trade => trade.pnl < 0);
                      const totalWins = winningTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
                      const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0));
                      const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
                      const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
                      const riskRewardRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—';
                      return riskRewardRatio;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0">
                    Win/Loss Ratio
                  </p>
                </div>
                <div className="w-12 h-12 mt-5">
                  {(() => {
                    if (!currentUser) return null;
                    const manualTrades = trades.filter(t => t.userId === currentUser.uid);
                    const allTrades = [...manualTrades, ...myfxbookTrades];
                    const winningTrades = allTrades.filter(trade => trade.pnl > 0);
                    const losingTrades = allTrades.filter(trade => trade.pnl < 0);
                    const totalWins = winningTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
                    const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0));
                    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
                    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
                    const rrValue = avgLoss > 0 ? avgWin / avgLoss : 0;
                    
                    // Calculate fill percentage: max at RR 3 (100%), scales proportionally
                    // RR 0.5 = 25%, RR 1 = 50%, RR 2 = 75%, RR 3+ = 100%
                    const maxRR = 3;
                    const fillPercentage = Math.min((rrValue / maxRR) * 100, 100);
                    
                    // Full circle circumference
                    const circumference = Math.PI * 2 * 50; // 2π * radius
                    const filledLength = (fillPercentage / 100) * circumference;
                    const unfilledOffset = circumference - filledLength;
                    
                    return (
                      <svg viewBox="0 0 120 120" className="w-full h-full">
                        {/* Gray background circle */}
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke="#4b5563"
                          strokeWidth="6"
                          opacity="0.4"
                        />
                        {/* Green filled circle */}
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="6"
                          strokeLinecap="round"
                          className="transition-all duration-500"
                          strokeDasharray={circumference}
                          strokeDashoffset={unfilledOffset}
                          style={{
                            filter: 'drop-shadow(0 0 8px 1px #10b981) drop-shadow(0 0 16px 2px #10b981) drop-shadow(0 0 24px 3px rgba(16, 185, 129, 0.6)) drop-shadow(0 0 32px 4px rgba(16, 185, 129, 0.4))',
                            transformOrigin: '60px 60px',
                            transform: 'rotate(-90deg)'
                          }}
                        />
                      </svg>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="col-span-3">
             <TradingCalendar />
          </div>
          <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Trades</CardTitle>
                <CardDescription>
                  Trade Execution List
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
                  >
                    View All & Delete Entries
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#94bba3]/20 scrollbar-track-transparent hover:scrollbar-thumb-[#94bba3]/30">
                  <DialogHeader>
                    <DialogTitle>All Trades</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <RecentSales showAll={true} enableEdit={true} />
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <RecentSales />
            </CardContent>
          </Card>
          <div className="col-span-3">
            <BarGraph />
          </div>
          <div className="col-span-2">
            <PieGraph />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}