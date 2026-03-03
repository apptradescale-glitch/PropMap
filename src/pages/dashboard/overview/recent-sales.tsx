import { Avatar } from '@/components/ui/avatar';
import { useTradeStore } from '@/components/shared/datastore';
import { useAuth } from '@/context/FAuth';
import * as React from 'react';
import { X } from 'lucide-react';

interface RecentSalesProps {
  showAll?: boolean;
  enableEdit?: boolean;
}

export function RecentSales({ showAll = false, enableEdit = false }: RecentSalesProps) {
  const { currentUser } = useAuth();
  const trades = useTradeStore(state => state.trades);
  const filterCriteria = useTradeStore(state => state.filterCriteria);
  const removeTrade = useTradeStore(state => state.removeTrade);
  const [selectedTradeId, setSelectedTradeId] = React.useState<string | null>(null);

  // Myfxbook trades state
  const [myfxbookTrades, setMyfxbookTrades] = React.useState<any[]>([]);
  const [connectedAccounts, setConnectedAccounts] = React.useState<any[]>([]);

  // Fetch connected accounts
  React.useEffect(() => {
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
  React.useEffect(() => {
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
                    // Convert MM/DD/YYYY to YYYY-MM-DD
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

  // Merge manual and Myfxbook trades, then filter, sort, and slice
  const displayTrades = React.useMemo(() => {
    if (!currentUser) return [];

    // Manual trades (add source for clarity)
    const manualTrades = trades
      .filter(trade => trade.userId === currentUser.uid)
      .map(trade => ({ ...trade, source: 'manual' }));

    // Merge both sources
    const allTrades = [...manualTrades, ...myfxbookTrades];

    // Apply filters
    const filteredTrades = allTrades.filter(trade => {
      const matchesSymbol = !filterCriteria.symbol ||
        trade.symbol?.toLowerCase().includes(filterCriteria.symbol.toLowerCase());
      const matchesAccount = !filterCriteria.account ||
        trade.account?.toLowerCase().includes(filterCriteria.account.toLowerCase());
      return matchesSymbol && matchesAccount;
    });

    // Sort and slice if needed
    const sortedTrades = [...filteredTrades]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return showAll ? sortedTrades : sortedTrades.slice(0, 4);
  }, [trades, myfxbookTrades, filterCriteria, showAll, currentUser]);

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

  // Format date string "YYYY-MM-DD" to "Mon DD, YYYY"
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [yyyy, mm, dd] = dateString.split('-');
    const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleRemoveTrade = async (tradeId: string) => {
    if (!currentUser) return;
    try {
      await removeTrade(tradeId);
      setSelectedTradeId(null);
    } catch (error) {
  
    }
  };

  return (
    <div className="space-y-8">
      {!currentUser ? (
        <div className="text-center text-muted-foreground">
          Please sign in to view your trades
        </div>
      ) : displayTrades.length === 0 ? (
        <div className="flex items-center">
          <Avatar
            style={{
              background: "transparent",
              border: "2px solid #94bba3",
              boxShadow: "0 0 8px 2px #94bba3",
              width: "18px",
              height: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
            }}
          />
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">Symbol</p>
            <p className="text-sm text-muted-foreground">Date | Account</p>
          </div>
          <div className="ml-auto font-medium">P&L</div>
        </div>
      ) : (
        displayTrades.map((trade) => (
          <div 
            key={trade.id}
            className="flex items-center relative p-2 rounded-md group transition-all duration-200"
          >
            <div
              className={`flex items-center w-full py-2 px-3 rounded-md
                ${enableEdit ? 'cursor-pointer hover:bg-white/5' : ''}
                ${selectedTradeId === trade.id ? 'border border-white/20 bg-white/5' : ''}`}
              onClick={() => enableEdit && setSelectedTradeId(trade.id)}
            >
              <Avatar
                style={{
                  background: "transparent",
                  border: "2px solid #94bba3",
                  boxShadow: "0 0 8px 2px #94bba3",
                  width: "19px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                }}
              />
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{trade.symbol}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(trade.date)} | {trade.account}
                </p>
              </div>
              <div className="ml-auto font-medium text-white">
                {formatCurrency(trade.pnl)}
              </div>
            </div>
            {enableEdit && trade.source === 'manual' && currentUser?.uid === trade.userId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTrade(trade.id);
                }}
                className="ml-4 opacity-0 group-hover:opacity-100 text-red-500 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}