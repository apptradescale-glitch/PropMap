'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTradeStore } from '@/components/shared/datastore';
import { useAuth } from '@/context/FAuth';

export function BarGraph() {
  const { currentUser } = useAuth();
  const trades = useTradeStore(state => state.trades);
  const filterCriteria = useTradeStore(state => state.filterCriteria);

  // --- Myfxbook Integration ---
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

  // Merge manual and Myfxbook trades, then filter
  const chartData = React.useMemo(() => {
    if (!currentUser) return [{ date: '', pnl: 0 }];

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

    const baseData = [{ date: '', pnl: 0 }];
    if (!filteredTrades.length) {
      return baseData;
    }

    // Group trades by date and sum PnL
    const groupedTrades = filteredTrades.reduce((acc, trade) => {
      const date = trade.date;
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += Number(trade.pnl);
      return acc;
    }, {} as Record<string, number>);

    // Convert to chart data format and ensure sorted dates with cumulative values
    let cumulativeSum = 0;
    const sortedData = Object.entries(groupedTrades)
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
      .map(([date, pnl]) => {
        cumulativeSum += Number(pnl);
        return {
          date,
          pnl: Number(cumulativeSum.toFixed(2))
        };
      });

    return [...baseData, ...sortedData];
  }, [trades, myfxbookTrades, filterCriteria, currentUser]);

  return (
    <Card className="col-span-4">
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <div className="flex flex-col gap-1">
          <CardTitle>P&L</CardTitle>
          <CardDescription>
            Trading Performance
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="h-[392px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 10,
              bottom: 10
            }}
          >
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94bba3" stopOpacity={0.3}/>
                <stop offset="40%" stopColor="#94bba3" stopOpacity={0.2}/>
                <stop offset="100%" stopColor="#94bba3" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3"
              vertical={true}
              stroke="#6b7280"
              opacity={0.4}
            />
            <XAxis
              dataKey="date"
              tickLine={true}
              axisLine={true}
              tickMargin={8}
              minTickGap={32}
              tick={{ fontSize: 12, fill: 'white' }}
              tickFormatter={(value) => {
                if (!value) return '';
                // value is "YYYY-MM-DD"
                const [yyyy, mm, dd] = value.split('-');
                return `${mm}/${dd}`;
              }}
            />
            <YAxis
              tickLine={true}
              axisLine={true}
              tick={{ fontSize: 12, fill: 'white' }}
              tickFormatter={(value) => {
                const formattedNumber = Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                return value < 0 ? `-$${formattedNumber}` : `$${formattedNumber}`;
              }}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="#94bba3"
              strokeWidth={2}
              fill="url(#colorGradient)"
              connectNulls={true}
              isAnimationActive={true}
              animationDuration={750}
            />
            <Tooltip
              cursor={{ stroke: '#94bba333' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const value = Number(payload[0].value);
                const formattedValue = Math.abs(value).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
                return (
                  <div className="rounded-lg bg-white/5 backdrop-blur-sm px-4 py-2 shadow-md">
                    <div className="text-sm text-stone-400">
                      {payload[0].payload.date
                        ? (() => {
                            const [yyyy, mm, dd] = payload[0].payload.date.split('-');
                            return `${mm}/${dd}/${yyyy}`;
                          })()
                        : 'Start'}
                    </div>
                    <div className={`text-lg font-semibold ${value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {value < 0 ? `-$${formattedValue}` : `$${formattedValue}`}
                    </div>
                  </div>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}