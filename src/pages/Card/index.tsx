'use client';

import React, { useEffect, useState, useMemo } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/FAuth';

import LG34Logo from '@/assets/images/lg34.png';
import TLGO from '@/assets/images/tradovate.png';
import TPTX from '@/assets/images/topstepX.jpg';
import VOLUMETRICA_LOGO from '@/assets/images/volumetrica.png';
import { useTradeStore } from '@/components/shared/datastore';

// Elixir Component
function Elixir() {
  return (
    <div className="w-[50px] h-[520px] rounded-full border border-white/30 backdrop-blur bg-white/5 overflow-hidden relative">
      <div
        className="absolute bottom-0 w-[120%] h-[100%] left-[-10%]
        bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-700
        shadow-[0_0_30px_#34ff9a]"
        style={{ animation: 'elixir 4s ease-in-out infinite' }}
      />
      <style jsx>{`
        @keyframes elixir {
          0%,100% {
            border-radius: 45% 55% 40% 60%;
            transform: translateY(0);
          }
          50% {
            border-radius: 55% 45% 60% 40%;
            transform: translateY(3px);
          }
        }
      `}</style>
    </div>
  );
}

// Firm logos
import ApexTraderFundingLogo from '@/assets/images/apextraderfunding.png';
import MyFundedFuturesLogo from '@/assets/images/myfundedfutures.png';
import TakeProfitTraderLogo from '@/assets/images/takeprofittrader.png';
import TradeifyLogo from '@/assets/images/tradeify.png';
import AlphaFuturesLogo from '@/assets/images/alphafutures.png';
import TopOneFuturesLogo from '@/assets/images/toponefutures.png';
import FundingTicksLogo from '@/assets/images/fundingticks.png';
import FundedNextFuturesLogo from '@/assets/images/fundednextfutures.png';
import AquaFuturesLogo from '@/assets/images/aquafutures.png';
import TopstepLogo from '@/assets/images/topstep.png';
import LucidLogo from '@/assets/images/lucid.png';
import UnknownLogo from '@/assets/images/unknown.png';

// Firm → logo map
const FIRM_LOGOS: Record<string, any> = {
  Other: UnknownLogo,
  'Apex Trader Funding': ApexTraderFundingLogo,
  MyFundedFutures: MyFundedFuturesLogo,
  'Take Profit Trader': TakeProfitTraderLogo,
  Tradeify: TradeifyLogo,
  'Alpha Futures': AlphaFuturesLogo,
  'Top One Futures': TopOneFuturesLogo,
  'Funding Ticks': FundingTicksLogo,
  'Funded Next Futures': FundedNextFuturesLogo,
  'Aqua Futures': AquaFuturesLogo,
  Topstep: TopstepLogo,
  Lucid: LucidLogo,
};

export default function BacktestPage() {
  const { currentUser } = useAuth();
  const [todayPnL, setTodayPnL] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      if (!currentUser) {
        setAccounts([]);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(
          `/api/firestore-get-finances?userId=${currentUser.uid}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await res.json();
        const accountsOnly = (data.finances || []).filter(
          (f: any) => f.platform
        );
        setAccounts(accountsOnly);
      } catch (error) {
        setAccounts([]);
      }
    }

    fetchAccounts();
  }, [currentUser]);

  // Fetch Tradovate realizedPnL directly from Tradovate API on page load
  useEffect(() => {
    if (!currentUser?.uid || accounts.length === 0) return;
    const tradovateAccounts = accounts.filter(acc => (acc.platform || 'Tradovate') === 'Tradovate');
    if (tradovateAccounts.length === 0) return;

    let cancelled = false;

    (async () => {
      const token = await currentUser.getIdToken();
      const updates: Record<string, { realizedPnL: number; balance?: number }> = {};

      await Promise.allSettled(tradovateAccounts.map(async (acc: any) => {
        try {
          const res = await fetch('/api/tradovate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'account', userId: currentUser.uid, accountId: acc.id }),
          });
          if (!res.ok) return;
          const data = await res.json();
          const accountData = data?.accounts?.[0] || {};
          const realizedPnL = Number(
            accountData?.realizedPnL ?? accountData?.cashBalances?.[0]?.realizedPnL ?? 0
          ) || 0;
          const balanceCandidate =
            accountData?.balance ?? accountData?.totalCashValue ?? accountData?.cashBalance ??
            accountData?.cashBalances?.[0]?.totalCashValue ?? accountData?.cashBalances?.[0]?.cashBalance;
          const balance = balanceCandidate != null ? (Number(balanceCandidate) || undefined) : undefined;
          updates[acc.id] = { realizedPnL, ...(balance !== undefined ? { balance } : {}) };
        } catch {}
      }));

      if (cancelled || Object.keys(updates).length === 0) return;

      setAccounts(prev => prev.map(acc => {
        const upd = updates[acc.id];
        if (!upd) return acc;
        return { ...acc, realizedPnL: upd.realizedPnL, ...(upd.balance !== undefined ? { balance: upd.balance } : {}) };
      }));
    })();

    return () => { cancelled = true; };
    // Only run once when accounts are first loaded (not on every accounts change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, accounts.length > 0]);

  // Compute daily P&L from trades for TopstepX & Volumetrica accounts (same approach as Trade Copier)
  const trades = useTradeStore((s: any) => s.trades);
  const tradeDailyPnLByFirm = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayYmd = `${yyyy}-${mm}-${dd}`;

    // Build a map of accountId -> firm for TopstepX & Volumetrica accounts
    const accountFirmMap = new Map<string, string>();
    accounts.forEach((acc: any) => {
      if (acc.platform === 'Volumetrica' || acc.platform === 'TopstepX') {
        accountFirmMap.set(String(acc.id), acc.firm || 'Other');
      }
    });

    const firmPnL = new Map<string, number>();
    for (const trade of trades || []) {
      if (!trade) continue;
      const platform = trade.platform ?? trade.Platform;
      if (platform !== 'Volumetrica' && platform !== 'TopstepX') continue;

      const accountId = String(trade.accountId ?? trade.accountID ?? '');
      if (!accountId) continue;

      const date = trade.date ?? (typeof trade.exitTime === 'string' ? trade.exitTime.split('T')[0] : undefined);
      if (date !== todayYmd) continue;

      const pnlRaw = trade.pnl;
      const pnl = typeof pnlRaw === 'number' ? pnlRaw : Number(pnlRaw);
      if (!Number.isFinite(pnl)) continue;

      const firm = accountFirmMap.get(accountId) || 'Other';
      firmPnL.set(firm, (firmPnL.get(firm) || 0) + pnl);
    }
    return firmPnL;
  }, [trades, accounts]);

  // Totals (include Volumetrica trade-based P&L)
  useEffect(() => {
    // Non-Volumetrica: use realizedPnL from Firestore
    const nonTradePnL = accounts
      .filter(acc => acc.platform !== 'Volumetrica' && acc.platform !== 'TopstepX')
      .reduce((sum, acc) => sum + Number(acc.realizedPnL || 0), 0);

    // TopstepX & Volumetrica: sum from trade-based daily P&L map
    let tradePnL = 0;
    tradeDailyPnLByFirm.forEach((val) => { tradePnL += val; });

    const balance = accounts.reduce(
      (sum, acc) => sum + Number(acc.balance || 0),
      0
    );

    setTodayPnL(nonTradePnL + tradePnL);
    setTotalBalance(balance);
  }, [accounts, tradeDailyPnLByFirm]);

  // Group by firm
  const groupedByFirm = useMemo(() => {
    const groups: Record<string, any[]> = {};
    accounts.forEach((acc) => {
      const firm = acc.firm || 'Other';
      if (!groups[firm]) groups[firm] = [];
      groups[firm].push(acc);
    });
    return groups;
  }, [accounts]);

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(absValue);

    return value < 0 ? `-${formatted}` : formatted;
  };

  const getPlatformLogo = (platform: string) => {
    if (platform === 'Tradovate') return TLGO;
    if (platform === 'TopstepX') return TPTX;
    if (platform === 'Volumetrica') return VOLUMETRICA_LOGO;
    return null;
  };

  const getFirmLogo = (firm: string) => {
    return FIRM_LOGOS[firm] || UnknownLogo;
  };

  // Format current date in EST like "29th January 2026"
  const formatCurrentDate = () => {
    const estDate = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    );

    const day = estDate.getDate();
    const month = estDate.toLocaleString('en-US', { month: 'long' });
    const year = estDate.getFullYear();

    const getOrdinal = (n: number) => {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    return `${day}${getOrdinal(day)} ${month} ${year}`;
  };

  return (
    <PageContainer>
      <div className="relative pt-12 md:pt-40 flex justify-center">

        <Card className="w-[900px] border-white/20 bg-transparent relative z-10">
          {/* Left Border Accent */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-60 -ml-2">
            <div className="w-full h-full rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_15px_#34ff9a]"></div>
          </div>

          {/* Right Border Accent */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-60 -mr-2">
            <div className="w-full h-full rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_15px_#34ff9a]"></div>
          </div>

          <CardContent className="p-6 space-y-10">

            {/* Header with Logo on left, P&L Card centered */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <img src={LG34Logo} alt="P&L Card" className="w-12 h-8" />
                  <span className="text-xl font-bold text-white">Tradescale</span>
                </div>
                <h1 className="text-xl font-bold text-white absolute left-1/2 -translate-x-1/2">P&L Card</h1>
              </div>
              <span className="text-sm text-neutral-400">
                {formatCurrentDate()}
              </span>
            </div>

            {/* Totals */}
            <div className="flex justify-center gap-12">
              <div className="text-center border border-white/20 rounded-lg px-6 py-3">
                <p className="text-xs text-neutral-400 mb-1">Total Balance</p>
                <p className="text-lg font-bold text-white">
                  {formatCurrency(totalBalance)}
                </p>
              </div>

              <div className="text-center border border-white/20 rounded-lg px-6 py-3">
                <p className="text-xs text-neutral-400 mb-1">Connected Accounts</p>
                <p className="text-lg font-bold text-white">{accounts.length}</p>
              </div>
            </div>

            {/* Today P&L */}
            <div className="flex flex-col items-center py-8">
              <p className="text-sm text-neutral-400 mb-3">
                Today&apos;s Grouped P&L
              </p>
              {/* Card-styled P&L Box */}
              <div
                className={`relative px-0 py-6 rounded-lg border w-full max-w-md
                  ${todayPnL > 0
                    ? 'border-emerald-500/15 shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(16,185,129,0.3)]'
                    : todayPnL < 0
                    ? 'border-red-500/15 shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(239,68,68,0.3)]'
                    : 'border-slate-500/15 shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(148,163,184,0.3)]'
                  } bg-card/50 hover:shadow-md transition-all duration-300`}
              >
                <div className="text-center">
                  <p
                    className={`text-5xl font-extrabold ${
                      todayPnL > 0
                        ? 'text-emerald-500'
                        : todayPnL < 0
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {formatCurrency(todayPnL)}
                  </p>
                </div>
              </div>
            </div>

            {/* Accounts */}
            <div>
              <h2 className="text-sm font-semibold text-white mb-4 text-center">Accounts</h2>

              <div className="grid grid-cols-4 text-xs text-neutral-400 mb-2 px-3">
                <span>Firm</span>
                <span>Platform</span>
                <span className="text-center">Daily P&L</span>
                <span className="text-right">Accounts</span>
              </div>

              <div className="space-y-3">
                {Object.entries(groupedByFirm).map(([firm, firmAccounts]) => {
                  const platform = firmAccounts[0]?.platform;
                  // TopstepX & Volumetrica: use trade-based daily P&L; others: use realizedPnL from Firestore
                  const firmPnL = (platform === 'Volumetrica' || platform === 'TopstepX')
                    ? (tradeDailyPnLByFirm.get(firm) || 0)
                    : firmAccounts.reduce(
                        (sum, acc) => sum + Number(acc.realizedPnL || 0),
                        0
                      );

                  return (
                    <Card key={firm} className="border-white/20 bg-transparent">
                      <CardContent className="p-3">
                        <div className="grid grid-cols-4 items-center">

                          {/* Firm */}
                          <div className="flex items-center gap-2">
                            <div className="inline-flex rounded border border-white/20 leading-none">
                              <img
                                src={getFirmLogo(firm)}
                                alt={firm}
                                className="h-5 w-auto block"
                              />
                            </div>
                            <span className="text-sm text-white">{firm}</span>
                          </div>

                          {/* Platform */}
                          <div className="flex items-center gap-1.5">
                            {getPlatformLogo(platform) && (
                              <img
                                src={getPlatformLogo(platform)}
                                alt={platform}
                                className="w-5 h-5 object-contain"
                              />
                            )}
                            <span className="text-sm text-white">{platform}</span>
                          </div>

                          {/* P&L */}
                          <div className="text-center">
                            <div
                              className={`relative p-3 rounded-lg border inline-block min-w-[120px]
                                ${firmPnL > 0
                                  ? 'border-emerald-500/15 shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(16,185,129,0.3)]'
                                  : firmPnL < 0
                                  ? 'border-red-500/15 shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(239,68,68,0.3)]'
                                  : 'border-slate-500/15 shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(148,163,184,0.3)]'
                                } bg-card/50`}
                            >
                              <p
                                className={`text-sm font-bold ${
                                  firmPnL > 0
                                    ? 'text-emerald-500'
                                    : firmPnL < 0
                                    ? 'text-red-500'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {formatCurrency(firmPnL)}
                              </p>
                            </div>
                          </div>

                          {/* Accounts */}
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#94bba3]">
                              {firmAccounts.length}
                            </p>
                            <p className="text-xs text-neutral-400">
                              {firmAccounts.length === 1 ? 'Account' : 'Accounts'}
                            </p>
                          </div>

                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

          </CardContent>
        </Card>

      </div>
    </PageContainer>
  );
}