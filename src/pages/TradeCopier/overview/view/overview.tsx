import React, { useState, useEffect, useRef, useMemo } from "react";
import * as signalR from '@microsoft/signalr';
import PageContainer from '@/components/layout/page-container';
import { useTheme } from '@/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import { Webhook } from 'lucide-react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Crown,
  DollarSign,
  Shield,
  User,
  Maximize,
  Link,
  LineChart,
  AlignHorizontalDistributeCenter,
  TrendingUp,
  BatteryPlus,
  Archive,
  Lock,
  Bot,
  Radio,
  Cpu,
  Search,
  Eye,
  LayoutGrid,
  List
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import PageHead from '@/components/shared/page-head';
import { useAuth } from '@/context/FAuth';
import AccountsCardList from './accounts';
import { useTradeStore, loadTradesFromFirestore } from '@/components/shared/datastore';
import { useMarketData } from '@/hooks/useMarketData';

// ✅ NEW: Import fee structure for commission calculations
const FUTURES_CONTRACT_FEES: Record<string, number> = {
  ES: 2.05, MES: 0.95, NQ: 1.55, MNQ: 0.52, YM: 1.80, MYM: 0.52,
  RTY: 2.05, M2K: 0.52, CL: 2.80, QM: 1.40, NG: 2.80, QG: 1.40,
  GC: 2.80, MGC: 1.30, SI: 2.80, SIL: 1.40, HG: 2.80, LE: 2.80,
  HE: 2.80, ZB: 1.80, ZN: 1.80, ZF: 1.80, ZT: 1.80, UB: 1.80,
  FDAX: 2.50, FDXM: 1.20, FESX: 1.20, FSTX: 1.20,
  "6E": 1.80, "6A": 1.80, "6B": 1.80, "6C": 1.80, "6J": 1.80, "6S": 1.80,
  ZC: 1.80, ZS: 1.80, ZW: 1.80, ZO: 1.80, ZR: 1.80, ZL: 1.80, ZM: 1.80,
  KC: 2.80, SB: 2.80, CT: 2.80, CC: 2.80, OJ: 2.80
};

const FUTURES_CONTRACT_MULTIPLIER: Record<string, number> = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5,
  RTY: 50, M2K: 5, CL: 1000, QM: 500, NG: 10000, QG: 2500,
  GC: 100, MGC: 10, SI: 5000, SIL: 1000, HG: 25000, LE: 400,
  HE: 400, ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000, UB: 1000,
  FDAX: 25, FDXM: 5, FESX: 10, FSTX: 10,
  "6E": 125000, "6A": 100000, "6B": 62500, "6C": 100000, "6J": 12500000, "6S": 125000,
  ZC: 50, ZS: 50, ZW: 50, ZO: 50, ZR: 20, ZL: 600, ZM: 100,
  KC: 37500, SB: 112000, CT: 50000, CC: 10, OJ: 15000
};

function logWithTime(...args: any[]) {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
}

function errorWithTime(...args: any[]) {
  console.error(`[${new Date().toLocaleTimeString()}]`, ...args);
}

async function readJsonOrText(res: Response): Promise<{
  isJson: boolean;
  data: any;
  text: string;
  contentType: string;
}> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  try {
    return { isJson: true, data: text ? JSON.parse(text) : undefined, text, contentType };
  } catch {
    return { isJson: false, data: undefined, text, contentType };
  }
}

function getBaseSymbol(symbol: string): string {
  if (!symbol) return '';
  symbol = symbol.toUpperCase();
  const bases = Object.keys(FUTURES_CONTRACT_MULTIPLIER).sort((a, b) => b.length - a.length);
  for (const base of bases) {
    if (symbol.includes(base)) return base;
  }
  return symbol;
}

// Helper to calculate real-time unrealized P&L for an account
function calculateAccountUnrealizedPnL(
  accountId: string | number,
  positions: Map<string, any>,
  getQuote: (symbol: string) => any,
  followerPositionsData?: Map<any, any>,
  leaderPositionData?: { symbol?: string; netPos?: number; avgEntryPrice?: number } | null
): number {
  let totalUPnL = 0;

  // Volumetrica leader: use leaderPositionData from WSS PositionInfo stream
  if (leaderPositionData && leaderPositionData.netPos && leaderPositionData.netPos !== 0 && leaderPositionData.avgEntryPrice) {
    const baseSymbol = getBaseSymbol(leaderPositionData.symbol || '');
    let quote = getQuote(`/${baseSymbol}`);
    if (!quote) quote = getQuote(baseSymbol);
    if (quote && quote.lastPrice) {
      const multiplier = FUTURES_CONTRACT_MULTIPLIER[baseSymbol] || 1;
      const qty = Math.abs(leaderPositionData.netPos);
      const isLong = leaderPositionData.netPos > 0;
      const priceDiff = isLong
        ? (quote.lastPrice - leaderPositionData.avgEntryPrice)
        : (leaderPositionData.avgEntryPrice - quote.lastPrice);
      return priceDiff * multiplier * qty;
    }
    return 0;
  }

  // Volumetrica follower: use followerPositionsData (Live Positions card) as the source of truth
  // When the card is removed (position closed), there's no entry → PnL = 0
  const fpd = followerPositionsData?.get(Number(accountId)) || followerPositionsData?.get(accountId);
  if (fpd && fpd.platform === 'Volumetrica' && fpd.netPos !== 0 && fpd.avgEntryPrice) {
    const baseSymbol = getBaseSymbol(fpd.symbol || '');
    let quote = getQuote(`/${baseSymbol}`);
    if (!quote) quote = getQuote(baseSymbol);
    if (quote && quote.lastPrice) {
      const multiplier = FUTURES_CONTRACT_MULTIPLIER[baseSymbol] || 1;
      const qty = Math.abs(fpd.netPos);
      const isLong = fpd.netPos > 0;
      const priceDiff = isLong
        ? (quote.lastPrice - fpd.avgEntryPrice)
        : (fpd.avgEntryPrice - quote.lastPrice);
      return priceDiff * multiplier * qty;
    }
    return 0;
  }

  // Tradovate / TopstepX: use apiPositions as before
  for (const [key, position] of positions.entries()) {
    // Convert both to numbers for comparison to handle string/number mismatch
    if (Number(position.accountId) === Number(accountId) && position.netPos !== 0) {
      const baseSymbol = getBaseSymbol(position.contractSymbol || '');
      
      // Try with "/" prefix first (market data format: /NQ, /ES, etc.)
      let quote = getQuote(`/${baseSymbol}`);
      
      // If not found, try without prefix
      if (!quote) {
        quote = getQuote(baseSymbol);
      }
      
      if (quote && quote.lastPrice && position.netPrice) {
        const multiplier = FUTURES_CONTRACT_MULTIPLIER[baseSymbol] || 1;
        const qty = Math.abs(position.netPos);
        const isLong = position.netPos > 0;
        
        // Calculate P&L: (current - entry) * multiplier * qty for long, opposite for short
        const priceDiff = isLong 
          ? (quote.lastPrice - position.netPrice)
          : (position.netPrice - quote.lastPrice);
        
        const positionPnL = priceDiff * multiplier * qty;
        totalUPnL += positionPnL;
      }
    }
  }

  return totalUPnL;
}



import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import NONmatchLogo from '@/assets/images/NONEmatch.png';
import LG34 from '@/assets/images/lg34.png'; // Make sure the path is correct
import TLGO from '@/assets/images/tradovate.png';
import TL from '@/assets/images/tradovate.png';
import TPTX from '@/assets/images/topstepX.jpg';
import TPTXLight from '@/assets/images/topstepXlight.png';
import VolumetricaLogo from '@/assets/images/volumetrica.png';
import LG34Logo from '@/assets/images/lg15.png';
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
import { app } from "@/config/firebase";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, deleteDoc, orderBy, limit } from "firebase/firestore";
const db = getFirestore(app);



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



const romanNumerals = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX",
  "XXXI", "XXXII", "XXXIII", "XXXIV", "XXXV", "XXXVI", "XXXVII", "XXXVIII", "XXXIX", "XL",
  "XLI", "XLII", "XLIII", "XLIV", "XLV", "XLVI", "XLVII", "XLVIII", "XLIX", "L"
];

  const getContractSymbol = async (contractId: number, userId: string, accountId: string) => {
  try {
    // ✅ LEADER contracts are always fetched from Tradovate (TopstepX leaders not supported yet)
    // This function is used for leader fills/positions, not followers
    const response = await fetch('/api/tradovatecopy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'getContract',
        userId,
        accountId,
        contractId
      })
    });
    
    if (response.ok) {
      const parsed = await readJsonOrText(response);
      if (!parsed.isJson) {
    
        return `Contract_${contractId}`;
      }
      return parsed.data?.name || `Contract_${contractId}`;
    }

    // Helpful diagnostics when the API route is missing and the SPA returns HTML
    const parsed = await readJsonOrText(response);
    if (!parsed.isJson) {
  
    }
  } catch (error) {
   
  }
  return `Contract_${contractId}`;
};

// Cache to avoid repeated API calls
const contractCache = new Map<number, string>();

// P&L Chart Component
function PnLChart({ trades }: { trades: any[] }) {
  const chartData = useMemo(() => {
    if (!trades.length) return [{ date: '', pnl: 0 }];

    const baseData = [{ date: '', pnl: 0 }];

    // Group trades by date and sum PnL
    const groupedTrades = trades.reduce((acc, trade) => {
      const date = trade.date || trade.createdAt?.split('T')[0] || '';
      if (!date) return acc;
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += Number(trade.pnl || 0);
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
  }, [trades]);

  return (
    <ResponsiveContainer width="100%" height={250}>
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
  );
}

// Win Rate Circle Component
const WinRateCircle = ({ winRate }: { winRate: number }) => {
  const safeWinRate = winRate || 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (safeWinRate / 100) * circumference;
  
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle - transparent */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="8"
          fill="transparent"
          strokeLinecap="round"
        />
        {/* Glow arc behind the main arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#94bba3"
          strokeWidth="14"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            opacity: 0.45,
            filter: 'blur(3px)'
          }}
        />
        {/* Main progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#94bba3"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-foreground">
          {(winRate || 0).toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

// Risk Reward Circle Component
const RRCircle = ({ riskReward }: { riskReward: number }) => {
  const safeRiskReward = riskReward || 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  // RR 0-1: 0-50%, RR 1-5: 50-100%
  let progressPercentage = 0;
  if (safeRiskReward <= 1) {
    progressPercentage = safeRiskReward * 50;
  } else if (safeRiskReward > 1) {
    progressPercentage = 50 + ((Math.min(safeRiskReward, 5) - 1) * 12.5);
  }
  // Cap at 100%
  progressPercentage = Math.min(progressPercentage, 100);
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;
  
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle - transparent */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="8"
          fill="transparent"
          strokeLinecap="round"
        />
        {/* Glow arc behind the main arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#94bba3"
          strokeWidth="14"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            opacity: 0.45,
            filter: 'blur(3px)'
          }}
        />
        {/* Main progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#94bba3"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-foreground">
          {(riskReward || 0).toFixed(1)}
        </span>
      </div>
    </div>
  );
};

// Win/Loss Bars Component (from pie-graph.tsx)
function WinLossBars({ avgWin, avgLoss }: { avgWin: number; avgLoss: number }) {
  const maxValue = Math.max(Math.abs(avgWin), Math.abs(avgLoss));
  const winWidth = maxValue ? ((avgWin || 0) / maxValue) * 100 : 0;
  const lossWidth = maxValue ? ((Math.abs(avgLoss) || 0) / maxValue) * 100 : 0;



  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center mb-1">
          <span className="text-xs font-semibold text-emerald-500">
            ${(avgWin || 0).toFixed(2)}
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
      <div>
        <div className="flex items-center mb-1">
          <span className="text-xs font-semibold text-red-500">
            ${(avgLoss || 0).toFixed(2)}
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
    </div>
  );
}

// Risk Reward Bar Component
const RiskRewardBar = ({ riskReward }: { riskReward: number }) => {
  // Convert risk:reward ratio to percentage
  // e.g., 2:1 = 66.7% green, 33.3% red
  const total = riskReward + 1;
  const greenPercentage = (riskReward / total) * 100;
  const redPercentage = (1 / total) * 100;
  
  return (
    <div className="w-full mx-auto">
      <div className="relative w-16 h-16 mx-auto mb-2">
        <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div 
              className="bg-green-500 transition-all duration-500 ease-in-out"
              style={{ width: `${greenPercentage}%` }}
            />
            <div 
              className="bg-red-500 transition-all duration-500 ease-in-out"
              style={{ width: `${redPercentage}%` }}
            />
          </div>
        </div>
        <div className="text-center mt-2">
          <span className="text-sm font-bold text-white">
            {riskReward >= 999 ? '∞' : `${riskReward.toFixed(1)}:1`}
          </span>
        </div>
      </div>
    </div>
  );
};

const getCachedContractSymbol = async (contractId: number, userId: string, accountId: string) => {
  if (contractCache.has(contractId)) {
    const cached = contractCache.get(contractId);
  
    return cached;
  }
  
 
  const symbol = await getContractSymbol(contractId, userId, accountId);

  contractCache.set(contractId, symbol);
  
  // ✅ REMOVED: No longer update positions from here (setPositions not in scope)
  // Positions will use the cached symbol on next render
  
  return symbol;
};

// ✅ NEW: Pre-warm contract symbol cache (called once when WebSocket syncs)
const preWarmSymbolCache = async (positions: any[] = [], orders: any[] = [], userId: string, accountId: string) => {
  const contractIds = new Set<number>();
  
  // Extract all unique contractIds from positions
  positions.forEach((pos: any) => {
    if (pos.contractId) contractIds.add(pos.contractId);
  });
  
  // Extract all unique contractIds from orders
  orders.forEach((order: any) => {
    if (order.contractId) contractIds.add(order.contractId);
  });
  
  if (contractIds.size === 0) {
    logWithTime('⏭️ No contracts to pre-warm in cache');
    return;
  }
  
  logWithTime(`🔥 Pre-warming symbol cache for ${contractIds.size} contracts:`, Array.from(contractIds));
  
  // Fetch all symbols in parallel (non-blocking background operation)
  const promises = Array.from(contractIds).map(contractId =>
    getCachedContractSymbol(contractId, userId, accountId)
      .catch(err => {
    
        return null;
      })
  );
  
  try {
    await Promise.all(promises);
    logWithTime('✅ Symbol cache pre-warming complete!', {
      contractsWarmed: contractIds.size,
      cacheSize: contractCache.size
    });
  } catch (error) {
    errorWithTime('Error pre-warming symbol cache:', error);
  }
};

// Concurrency-limited async mapper that returns Promise.allSettled-style results.
// Helps avoid long sequential follower loops without causing request storms.
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const safeConcurrency = Math.max(1, Math.floor(concurrency || 1));
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  const workerCount = Math.min(safeConcurrency, items.length || 0);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

function AccountsCardListSelect({
  onSelect,
  selectedId,
  excludeIds = [] as any[],
  popupType,
}: {
  onSelect: (acc: any) => void;
  selectedId?: any;
  excludeIds?: any[];
  popupType?: 'leader' | 'follower';
}) {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);



  

  

  useEffect(() => {
    async function fetchAccounts() {
      if (currentUser?.uid) {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const parsed = await readJsonOrText(res);
        if (!parsed.isJson) {
          throw new Error(`Non-JSON response from /api/firestore-get-finances (status ${res.status}) preview: ${parsed.text.slice(0, 120)}`);
        }
        const data: any = parsed.data;
        // Filter to only show accounts (with platform field), exclude expenses/payouts
        const accountsOnly = (data.finances || []).filter((f: any) => f.platform);
        setAccounts(accountsOnly);
      }
    }
    fetchAccounts();
  }, [currentUser?.uid]);

  // Filter out excluded accounts
  const filteredAccounts = accounts.filter((acc: any) => !excludeIds.includes(acc.id));

  return (
    <div className="grid gap-3">
      {filteredAccounts.map(acc => {
        const isTopstepX = acc.platform === "TopstepX";
        const isVolumetrica = acc.platform === 'Volumetrica';
        const shouldDisable = false;
        return (
          <Card
            key={acc.id}
            onClick={() => {
              if (!shouldDisable) onSelect(acc);
            }}
            className={`transition-all ${
              shouldDisable
                ? "opacity-50 cursor-not-allowed border border-white/10"
                : "cursor-pointer border border-white/15" + (selectedId === acc.id ? " shadow-[inset_0_0_16px_4px_rgba(255,255,255,0.5)]" : "")
            }`}
            tabIndex={shouldDisable ? -1 : 0}
            aria-disabled={shouldDisable}
            title={shouldDisable ? "This platform cannot be selected as leader." : undefined}
          >
            <CardHeader className="flex flex-row items-center gap-3 pb-0">
              {/* Use firm logo if available, else fallback */}
              {acc.firm && FIRM_LOGOS[acc.firm] ? (
                <img
                  src={FIRM_LOGOS[acc.firm]}
                  alt={acc.firm + " Logo"}
                  className="w-10 h-10 object-contain rounded border border-white/30"
                />
              ) : (
                <>
                  <img
                    src={acc.platform === "Tradovate" ? TLGO : acc.platform === "TopstepX" ? TPTX : acc.platform === "Volumetrica" ? VolumetricaLogo : NONmatchLogo}
                    alt="Account Logo"
                    className={`${acc.platform === "TopstepX" ? "w-17 h-7" : "w-8 h-8"} object-contain rounded ${acc.platform === "Tradovate" || acc.platform === "TopstepX" ? "" : "border border-white/30"}`}
                  />
                  {acc.platform === "Tradovate" && <span className="text-sm">Tradovate</span>}
                </>
              )}
              <CardTitle className="text-base font-semibold">{acc.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-white">
                Balance: <span className="font-bold">{`$${Math.round(Number(acc.balance)).toLocaleString()}`}</span>
              </div>
              {shouldDisable && (
                <div className="text-xs text-red-400 mt-2">This platform cannot be selected as leader.</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function OverViewPage() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const trades = useTradeStore(state => state.trades);
  const filterCriteria = useTradeStore(state => state.filterCriteria);  // Firestore tradecopier collection functions removed - legacy code

  type LeaderOrderSnapshot = {
    orderId: number;
    symbol: string;
    qty: number;
    price?: number;
    label: string;
    action?: 'Buy' | 'Sell';
    status?: string;
    timestamp?: string;
  };

  type FollowerOrderSnapshot = {
    followerOrderId?: number;
    leaderOrderId?: number;
    symbol: string;
    qty: number;
    price?: number;
    direction?: string;
    orderTypeLabel?: string;
    isPending?: boolean;
    timestamp?: string;
  };

  const topstepXDayRealizedPnLByAccountId = React.useMemo(() => {
    // Calculate today's realized P&L for TopstepX & Volumetrica accounts by summing trade.pnl for trades
    // whose trade.date matches today's local date (YYYY-MM-DD).
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayYmd = `${yyyy}-${mm}-${dd}`;

    const map = new Map<string, number>();
    for (const trade of trades || []) {
      if (!trade) continue;

      const platform = (trade as any).platform ?? (trade as any).Platform;
      if (platform !== 'TopstepX' && platform !== 'Volumetrica') continue;

      const accountId = (trade as any).accountId ?? (trade as any).accountID;
      if (accountId == null) continue;

      const date = (trade as any).date ?? (typeof (trade as any).exitTime === 'string' ? (trade as any).exitTime.split('T')[0] : undefined);
      if (date !== todayYmd) continue;

      const pnlRaw = (trade as any).pnl;
      const pnl = typeof pnlRaw === 'number' ? pnlRaw : Number(pnlRaw);
      if (!Number.isFinite(pnl)) continue;

      const key = String(accountId);
      map.set(key, (map.get(key) || 0) + pnl);
    }

    return map;
  }, [trades, new Date().toDateString()]);
  
  // ✅ Hook to get real-time market data for unrealized P&L calculations
  const { getQuote, quotes, connected } = useMarketData();





  const wsRef = useRef<WebSocket | null>(null); // Leader WebSocket

  // --- WebSocket diagnostics (helps triage abnormal closes like code 1006) ---
  const lastWsOpenAtRef = useRef<number | null>(null);
  const lastWsMessageAtRef = useRef<number | null>(null);
  const lastHeartbeatAtRef = useRef<number | null>(null);
  const lastOnlineAtRef = useRef<number | null>(null);
  const lastOfflineAtRef = useRef<number | null>(null);
  const orderIdToAccountId = useRef<Map<number, number>>(new Map());
  const orderIdToSession = useRef<Map<number, number>>(new Map()); // Track which session each order belongs to
  const currentSessionRef = useRef<number>(1); // Track current session immediately without state delays
  const savedClosedPositions = useRef<Set<string>>(new Set()); // Track closed positions to avoid reprocessing
  const orderDetailsMap = useRef<Map<number, any>>(new Map()); // Store complete order details including price from orderVersion events
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [fills, setFills] = useState<any[]>([]);
  const [latestLeaderFill, setLatestLeaderFill] = useState<{
    accountName?: string;
    balance?: number;
    symbol?: string;
    qty?: number;
    price?: number;
    direction?: string;
    timestamp?: string;
  } | null>(null);
  const [followerLatestOrders, setFollowerLatestOrders] = useState<Map<string, FollowerOrderSnapshot[]>>(new Map());

  const [latestLeaderOrder, setLatestLeaderOrder] = useState<{
    symbol: string,
    qty: number,
    price?: number,
    label: string, // e.g., "Buy Stop"
    action?: 'Buy' | 'Sell',
    status?: string,
    orderId?: number,
    timestamp?: string
  } | null>(null);

  // ✅ NEW: Store multiple pending orders instead of just the latest one
  const [latestLeaderOrders, setLatestLeaderOrders] = useState<LeaderOrderSnapshot[] | null>(null);

  // ✅ NEW: Track canceled orders to display in Copier Actions
  const [canceledLeaderOrder, setCanceledLeaderOrder] = useState<{
    label: string,
    timestamp: string
  } | null>(null);

  const [canceledOrderClearTimer, setCanceledOrderClearTimer] = useState<number | null>(null);

  const showCanceledLeaderOrder = (label: string) => {
    setCanceledLeaderOrder({
      label: label || 'Order',
      timestamp: new Date().toISOString()
    });

    if (canceledOrderClearTimer !== null) {
      clearTimeout(canceledOrderClearTimer);
    }

    const timer = window.setTimeout(() => {
      setCanceledLeaderOrder(null);
      setCanceledOrderClearTimer(null);
    }, 3000);
    setCanceledOrderClearTimer(timer);
  };

  const [accessToken, setAccessToken] = useState<string | null>(null);

  // ✅ TopstepX leader stream (SignalR) — only used when leaderAccount.platform === 'TopstepX'
  const topstepConnRef = useRef<signalR.HubConnection | null>(null);
  const [topstepLeaderStatus, setTopstepLeaderStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [topstepLeaderTokenStatus, setTopstepLeaderTokenStatus] = useState<'Not Active' | 'Valid' | 'Expired'>('Not Active');
  const [topstepLeaderLastError, setTopstepLeaderLastError] = useState<string | null>(null);

  // ✅ Volumetrica leader stream (Protobuf WSS) — only used when leaderAccount.platform === 'Volumetrica'
  const volumetricaWsRef = useRef<WebSocket | null>(null);
  const volumetricaWsClosedIntentionallyRef = useRef(false);
  const [volumetricaLeaderStatus, setVolumetricaLeaderStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [volumetricaLeaderLastError, setVolumetricaLeaderLastError] = useState<string | null>(null);

  // Popup state for Add Leader/Follower
  const [showAccountPopup, setShowAccountPopup] = useState(false);
  const [popupType, setPopupType] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  // ✅ NEW: Follower popup state
  const [showFollowerPopup, setShowFollowerPopup] = useState(false);
  const [selectedPositionFollowers, setSelectedPositionFollowers] = useState<any[]>([]);

  const [accounts, setAccounts] = useState<any[]>([]); // All accounts from finances
  const [leaderId, setLeaderId] = useState(null); // Persisted leader account ID
  const [followerIds, setFollowerIds] = useState<any[]>([]); // Persisted follower account IDs
  const [loading, setLoading] = useState(true);

  // ✅ Invalid token check
  const [showInvalidTokenDialog, setShowInvalidTokenDialog] = useState(false);
  const [invalidTokenAccounts, setInvalidTokenAccounts] = useState<any[]>([]);

  // Prevent overlapping refreshes (page load + start/stop can happen close together)
  const accountsRefreshInFlightRef = useRef(false);
  // Debounce: multiple leader fills in quick succession
  const accountsRefreshAfterLeaderFillTimerRef = useRef<number | null>(null);

  // ✅ Derived accounts (declare early: used by effects + dependency arrays)
  const leaderAccount = useMemo(() => accounts.find((acc: any) => acc.leader), [accounts]);
  const followers = useMemo(() => accounts.filter((acc: any) => acc.follower), [accounts]);
  const leaderPlatform = leaderAccount?.platform || 'Tradovate';
  const isLeaderTopstepX = leaderPlatform === 'TopstepX';
  const isLeaderVolumetrica = leaderPlatform === 'Volumetrica';

  // Keep an always-fresh followers list for async callbacks (WebSocket handlers can capture stale closures)
  const followersRef = useRef<any[]>([]);
  useEffect(() => {
    followersRef.current = followers;
  }, [followers]);

  // ✅ NEW: Follower position refresh helper (used when followers can change position without a new placeOrder)
  const followerPositionsRefreshTimerRef = useRef<number | null>(null);
  const followerPositionsRefreshInFlightRef = useRef(false);
  const followerPositionsRefreshQueuedReasonRef = useRef<string | null>(null);

  // ✅ Tradovate follower positions can lag after fills/orders.
  // We keep a small keyed timer registry so we can schedule a delayed re-fetch without spamming.
  const followerPositionRefetchTimersRef = useRef<Map<string, number>>(new Map());

  const scheduleFollowerPositionRefetch = (
    followerAccountId: number,
    followerName: string,
    delayMs: number,
    reason: string
  ) => {
    const key = `${followerAccountId}:${reason}:${delayMs}`;
    const existing = followerPositionRefetchTimersRef.current.get(key);
    if (existing != null) window.clearTimeout(existing);

    const timerId = window.setTimeout(() => {
      followerPositionRefetchTimersRef.current.delete(key);
      fetchFollowerPosition(followerAccountId).catch(err =>
        errorWithTime(
          `❌ Delayed follower position re-fetch failed (${followerName}) [${reason} +${delayMs}ms]:`,
          err
        )
      );
    }, delayMs);
    followerPositionRefetchTimersRef.current.set(key, timerId);
  };

  const refreshAllFollowerPositionsNow = async (reason: string) => {
    if (!currentUser?.uid) return;
    const currentFollowers = followersRef.current || [];
    if (!currentFollowers.length) return;
    if (followerPositionsRefreshInFlightRef.current) {
      followerPositionsRefreshQueuedReasonRef.current = reason;
      return;
    }

    followerPositionsRefreshInFlightRef.current = true;
    try {
      logWithTime(`🔄 Refreshing follower positions (${currentFollowers.length}) due to: ${reason}`);
      await Promise.allSettled(currentFollowers.map((f: any) => fetchFollowerPosition(f.id)));

      // ✅ Tradovate-only follow-up: positions endpoints can be eventually consistent right after leader events.
      // This helps Tradovate followers populate reliably without slowing down TopstepX.
      if (!reason.includes('tradovate_followup')) {
        const tradovateFollowers = currentFollowers.filter(
          (f: any) => (f.platform || 'Tradovate') !== 'TopstepX'
        );
        if (tradovateFollowers.length) {
          for (const f of tradovateFollowers) {
            scheduleFollowerPositionRefetch(
              Number(f.id),
              String(f.name || 'Follower'),
              1500,
              `${reason}_tradovate_followup`
            );
          }
        }
      }
    } finally {
      followerPositionsRefreshInFlightRef.current = false;
      const queuedReason = followerPositionsRefreshQueuedReasonRef.current;
      followerPositionsRefreshQueuedReasonRef.current = null;
      if (queuedReason) {
        // Coalesce bursty events into a single follow-up refresh.
        queueFollowerPositionsRefresh(queuedReason, 250);
      }
    }
  };

  const queueFollowerPositionsRefresh = (reason: string, delayMs = 250) => {
    if (!currentUser?.uid) return;
    const currentFollowers = followersRef.current || [];
    if (!currentFollowers.length) return;

    if (followerPositionsRefreshTimerRef.current != null) {
      window.clearTimeout(followerPositionsRefreshTimerRef.current);
    }

    followerPositionsRefreshTimerRef.current = window.setTimeout(() => {
      followerPositionsRefreshTimerRef.current = null;
      void refreshAllFollowerPositionsNow(reason);
    }, delayMs);
  };

  useEffect(() => {
    return () => {
      if (followerPositionsRefreshTimerRef.current != null) {
        window.clearTimeout(followerPositionsRefreshTimerRef.current);
        followerPositionsRefreshTimerRef.current = null;
      }

      // Clear any pending delayed follower position refetch timers.
      for (const t of followerPositionRefetchTimersRef.current.values()) {
        window.clearTimeout(t);
      }
      followerPositionRefetchTimersRef.current.clear();
    };
  }, []);

  const [isCopying, setIsCopying] = useState(false);
  const [isStarting, setIsStarting] = useState(false); // New loading state
  const [copierStatus, setCopierStatus] = useState("Off");
  const [tradovateUserId, setTradovateUserId] = useState<number | null>(null);
  const [activeFollowers, setActiveFollowers] = useState<Set<string>>(new Set());

  // Keep a live ref so WebSocket handlers / async copy flows don't use stale follower toggles.
  const activeFollowersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    activeFollowersRef.current = activeFollowers;
  }, [activeFollowers]);

  // Ratio system state
  const [followerRatios, setFollowerRatios] = useState<Map<string, number>>(new Map());
  // ✅ Keep a live ref so async copy functions use the LATEST ratios (not stale closures)
  const followerRatiosRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    followerRatiosRef.current = followerRatios;
  }, [followerRatios]);

  // ✅ Check for invalid tokens periodically
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

    checkTokenHealth();
    const interval = setInterval(checkTokenHealth, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser?.uid]);

  const [showRatioPopup, setShowRatioPopup] = useState(false);
  const [selectedFollowerForRatio, setSelectedFollowerForRatio] = useState<any>(null);
  const [tempRatio, setTempRatio] = useState(1);

  // ✅ REMOVED: Manual SL/TP temporarily disabled due to function issues
  // const [followerStopLoss, setFollowerStopLoss] = useState<Map<string, string>>(new Map());
  // const [followerTakeProfit, setFollowerTakeProfit] = useState<Map<string, string>>(new Map());

  // Add duplicate prevention for trade copying
  const [processedOrders, setProcessedOrders] = useState<Set<string>>(new Set());
  const processedOrdersRef = useRef<Set<string>>(new Set());
  const [dailyPnL, setDailyPnL] = useState(new Map()); // ✅ NEW: Track daily PnL for accounts
  
  // 🔍 DEBUG: Track last copy attempt to detect idle periods
  const lastCopyAttemptRef = useRef<number>(Date.now());
  
  // ✅ FIX: Track which pending orders we've already triggered copy for (prevents race condition duplicates)
  const pendingOrderCopyTriggeredRef = useRef<Set<number>>(new Set());

  // ✅ FAST PATH: In-memory tracking of which leader pending orders were copied (avoids Firestore latency)
  // Keyed by `${leaderAccountId}_${leaderOrderId}` and stores follower ids that received the pending order.
  const pendingOrderCopiedLocalRef = useRef<Map<string, Set<string>>>(new Map());
  const pendingOrderCopiedAnyLocalRef = useRef<Set<string>>(new Set());

  // ✅ FAST PATH: In-memory mapping from leader pending order -> follower order ids.
  // This avoids a Firestore read on cancel/modify for recently-copied orders.
  const pendingOrderMappingsLocalRef = useRef<
    Map<number, Array<{ followerId: number; followerOrderId: number; followerPlatform?: string | null }>>
  >(new Map());

  // Tradovate stop/limit orders can trigger a separate market child order with a different orderId.
  // Track which leader pending orders were copied (by contractId+side) so we can suppress copying
  // the subsequent fill as an additional market trade (prevents double execution on followers).
  const copiedPendingLeaderOrdersByContractSideRef = useRef<Map<string, Set<number>>>(new Map());

  const trackCopiedPendingLeaderOrder = (contractId: unknown, action: unknown, leaderOrderId: number) => {
    const c = contractId != null ? String(contractId) : '';
    const a = action != null ? String(action) : '';
    if (!c || !a) return;
    const key = `${c}_${a}`;
    const set = copiedPendingLeaderOrdersByContractSideRef.current.get(key);
    if (set) {
      set.add(leaderOrderId);
      return;
    }
    copiedPendingLeaderOrdersByContractSideRef.current.set(key, new Set([leaderOrderId]));
  };

  const untrackCopiedPendingLeaderOrder = (contractId: unknown, action: unknown, leaderOrderId: number) => {
    const c = contractId != null ? String(contractId) : '';
    const a = action != null ? String(action) : '';
    if (!c || !a) return;
    const key = `${c}_${a}`;
    const set = copiedPendingLeaderOrdersByContractSideRef.current.get(key);
    if (!set) return;
    set.delete(leaderOrderId);
    if (set.size === 0) copiedPendingLeaderOrdersByContractSideRef.current.delete(key);
  };

  const addPendingOrderMappingLocal = (
    leaderOrderId: number,
    followerId: number,
    followerOrderId: number,
    followerPlatform?: string | null,
    followerContractId?: number | null
  ) => {
    const list = pendingOrderMappingsLocalRef.current.get(leaderOrderId) ?? [];
    const exists = list.some(
      x => Number(x.followerId) === Number(followerId) && Number(x.followerOrderId) === Number(followerOrderId)
    );
    if (!exists) {
      pendingOrderMappingsLocalRef.current.set(leaderOrderId, [
        ...list,
        {
          followerId: Number(followerId),
          followerOrderId: Number(followerOrderId),
          followerPlatform: followerPlatform ?? null,
          followerContractId: followerContractId ?? null
        }
      ]);
    }
  };

  const clearPendingOrderMappingsLocal = (leaderOrderId: number) => {
    pendingOrderMappingsLocalRef.current.delete(leaderOrderId);
  };

  const getPendingLocalKey = (leaderAccountId: unknown, leaderOrderId: unknown): string => {
    return `${String(leaderAccountId)}_${String(leaderOrderId)}`;
  };

  const markPendingCopiedLocal = (leaderAccountId: unknown, leaderOrderId: unknown, followerId: unknown) => {
    const key = getPendingLocalKey(leaderAccountId, leaderOrderId);
    pendingOrderCopiedAnyLocalRef.current.add(key);
    const set = pendingOrderCopiedLocalRef.current.get(key) ?? new Set<string>();
    set.add(String(followerId));
    pendingOrderCopiedLocalRef.current.set(key, set);
  };

  const wasPendingCopiedLocal = (leaderAccountId: unknown, leaderOrderId: unknown, followerId: number) => {
    const key = getPendingLocalKey(leaderAccountId, leaderOrderId);
    if (followerId === -1) return pendingOrderCopiedAnyLocalRef.current.has(key);
    return pendingOrderCopiedLocalRef.current.get(key)?.has(String(followerId)) ?? false;
  };

  const clearPendingCopiedLocal = (leaderAccountId: unknown, leaderOrderId: unknown) => {
    const key = getPendingLocalKey(leaderAccountId, leaderOrderId);
    pendingOrderCopiedAnyLocalRef.current.delete(key);
    pendingOrderCopiedLocalRef.current.delete(key);
  };

  const addOrUpdateLeaderOrder = (patch: Partial<LeaderOrderSnapshot> & { orderId: number }) => {
    setLatestLeaderOrders(prev => {
      const safePrev = prev ?? [];
      const idx = safePrev.findIndex(o => o.orderId === patch.orderId);

      if (idx >= 0) {
        const updated = [...safePrev];
        const existing = updated[idx];
        const merged = { ...existing, ...patch } as LeaderOrderSnapshot;
        if (patch.symbol === '' || patch.symbol === undefined) merged.symbol = existing.symbol;
        if (patch.price === undefined) merged.price = existing.price;
        updated[idx] = merged;
        return updated;
      }

      const created: LeaderOrderSnapshot = {
        orderId: patch.orderId,
        symbol: (patch.symbol ?? '') as string,
        qty: (patch.qty ?? 0) as number,
        price: patch.price,
        label: (patch.label ?? '') as string,
        action: patch.action,
        status: patch.status,
        timestamp: patch.timestamp
      };
      // Keep the first/oldest pending order in the first row; append new ones below.
      return [...safePrev, created];
    });
  };

  const removeLeaderOrderById = (orderId: number, opts?: { showCancelToast?: boolean }) => {
    setLatestLeaderOrders(prev => {
      if (!prev || prev.length === 0) return prev;
      const removed = prev.find(o => o.orderId === orderId);
      const next = prev.filter(o => o.orderId !== orderId);
      if (opts?.showCancelToast && removed) {
        showCanceledLeaderOrder(removed.label || 'Order');
      }
      return next.length ? next : null;
    });
  };

  const upsertFollowerOrderSnapshot = (
    followerAccountId: number,
    patch: Partial<FollowerOrderSnapshot> & { symbol?: string; qty?: number },
    match: { followerOrderId?: number; leaderOrderId?: number } = {}
  ) => {
    setFollowerLatestOrders(prev => {
      const next = new Map(prev);
      const key = String(followerAccountId);
      const list = (next.get(key) ?? []).slice();

      const idx = list.findIndex(item => {
        if (match.followerOrderId != null && item.followerOrderId != null) return item.followerOrderId === match.followerOrderId;
        if (match.leaderOrderId != null && item.leaderOrderId != null) return item.leaderOrderId === match.leaderOrderId;
        return false;
      });

      if (idx >= 0) {
        const existing = list[idx];
        const merged = { ...existing, ...patch } as FollowerOrderSnapshot;

        // Guard against accidental blanking of required fields.
        if (patch.symbol === '') merged.symbol = existing.symbol;
        if (patch.symbol === undefined) merged.symbol = existing.symbol;
        if (patch.qty === undefined) merged.qty = existing.qty;
        if (patch.price === undefined) merged.price = existing.price;

        list[idx] = merged;
      } else {
        // Insert requires symbol/qty.
        if (patch.symbol == null || patch.qty == null) {
          errorWithTime('❌ Cannot insert follower snapshot without symbol/qty', {
            followerAccountId,
            match,
            patch
          });
          return prev;
        }
        // Keep the first/oldest pending order in the first row; append new ones below.
        list.push({
          followerOrderId: match.followerOrderId,
          leaderOrderId: match.leaderOrderId,
          symbol: patch.symbol,
          qty: patch.qty,
          price: patch.price,
          direction: patch.direction,
          orderTypeLabel: patch.orderTypeLabel,
          isPending: patch.isPending,
          timestamp: patch.timestamp
        });
      }

      next.set(key, list);
      return next;
    });
  };

  const removeFollowerOrderSnapshot = (
    followerAccountId: number,
    match: { followerOrderId?: number; leaderOrderId?: number }
  ) => {
    setFollowerLatestOrders(prev => {
      const key = String(followerAccountId);
      const list = prev.get(key);
      if (!list || list.length === 0) return prev;

      const nextList = list.filter(item => {
        if (match.followerOrderId != null && item.followerOrderId != null) return item.followerOrderId !== match.followerOrderId;
        if (match.leaderOrderId != null && item.leaderOrderId != null) return item.leaderOrderId !== match.leaderOrderId;
        return true;
      });

      const next = new Map(prev);
      if (nextList.length === 0) next.delete(key);
      else next.set(key, nextList);
      return next;
    });
  };

  // ✅ When a leader pending order fills, followers will often NOT emit an event into this UI.
  // Mark matching follower pending snapshots as resolved immediately (so Pending Orders tab stays accurate).
  const resolveFollowerPendingSnapshotsForLeaderOrder = (
    leaderOrderId: number,
    resolution: 'Filled' | 'Resolved' = 'Filled'
  ) => {
    if (!Number.isFinite(Number(leaderOrderId))) return;

    setFollowerLatestOrders(prev => {
      let didChange = false;
      const next = new Map(prev);
      const nowIso = new Date().toISOString();

      for (const [accountKey, list] of next.entries()) {
        if (!list || list.length === 0) continue;

        let touched = false;
        const updated = list.map(item => {
          if (!item || item.isPending !== true) return item;
          if (item.leaderOrderId == null) return item;
          if (Number(item.leaderOrderId) !== Number(leaderOrderId)) return item;

          touched = true;
          const baseLabel = String(item.orderTypeLabel || item.direction || 'Order');
          const alreadyResolved = /\((filled|resolved)\)/i.test(baseLabel);
          const resolvedLabel = alreadyResolved ? baseLabel : `${baseLabel} (${resolution})`;

          return {
            ...item,
            isPending: false,
            direction: resolvedLabel,
            timestamp: nowIso
          };
        });

        if (touched) {
          next.set(accountKey, updated);
          didChange = true;
        }
      }

      return didChange ? next : prev;
    });
  };

  // ✅ TopstepX leader: track pending order copy per SignalR order id
  const topstepPendingOrderCopyTriggeredRef = useRef<Set<string>>(new Set());
  const topstepOrderLastPriceRef = useRef<Map<number, number>>(new Map());

  // ✅ Volumetrica leader: track pending order copy per WSS order id
  const volPendingOrderCopyTriggeredRef = useRef<Set<number>>(new Set());
  const volOrderLastPriceRef = useRef<Map<number, number>>(new Map());
  // Track last known market price per symbol (from fills) for direction inference fallback
  const volLastMarketPriceRef = useRef<Map<string, number>>(new Map());
  // Cache resolved Tradovate contractId per Volumetrica feedSymbol (avoids repeated findContract calls)
  const volTradovateContractIdCache = useRef<Map<string, { id: number; name: string }>>(new Map());
  // Track last set leader position to avoid excessive re-renders from frequent PositionInfo messages
  const volLeaderPosRef = useRef<{ symbol: string; netPos: number; avgEntryPrice: number } | null>(null);

  // ✅ FIX: Track leader order metadata immediately (avoids relying on async React state)
  // Needed because Tradovate can emit `order` and `orderVersion` in separate WebSocket messages.
  const leaderOrderMetaRef = useRef<
    Map<
      number,
      {
        accountId: number;
        contractId?: number;
        action?: 'Buy' | 'Sell';
        ordStatus?: string;
      }
    >
  >(new Map());

  // ✅ Leader stop/limit labeling: Tradovate stop/limit triggers often create a *market* child order/fill.
  // We cache the last known pending label for a contract+side and also cache a short-lived "recently filled"
  // label so the subsequent market fill can be displayed as "Buy Stop (Filled)" rather than "Buy Market".
  const leaderPendingOrderLabelByContractSideRef = useRef<
    Map<string, { label: string; updatedAtMs: number; leaderOrderId: number }>
  >(new Map());
  const leaderRecentlyFilledPendingLabelByContractSideRef = useRef<
    Map<string, { label: string; filledAtMs: number; leaderOrderId: number }>
  >(new Map());
  
  // ✅ NEW: Flag to temporarily disable trade copying during flatten operations
  const [isFlatteningPositions, setIsFlatteningPositions] = useState(false);
  const isFlatteningRef = useRef(false);

  // ✅ NEW: Manual scan button state for Live Positions
  const [isScanningPositions, setIsScanningPositions] = useState(false);

  // Live Positions view mode: 'card' (default) or 'list'
  const [livePositionsView, setLivePositionsView] = useState<'card' | 'list'>('card');
  
  // ✅ Force re-render for real-time market data updates
  const [, forceUpdate] = useState({});
  
  // ✅ NEW: Leader order/position data from Tradovate API
  const [leaderPositionData, setLeaderPositionData] = useState<{
    symbol?: string;
    netPos?: number;
    avgEntryPrice?: number;
    unrealizedPnL?: number;
    realizedPnL?: number;
    orderStatus?: string; // 'Filled' or 'Working'
    orderType?: string; // 'Market', 'Limit', 'Stop', etc.
  } | null>(null);

  // ✅ NEW: Follower orders/positions data from Tradovate API
  const [followerPositionsData, _setFollowerPositionsData] = useState<Map<number, {
    accountId: number;
    accountName: string;
    platform?: string;
    symbol?: string;
    contractId?: number | string;
    netPos?: number;
    avgEntryPrice?: number;
    unrealizedPnL?: number;
    orderStatus?: string; // 'Filled' or 'Working'
    orderType?: string; // 'Market', 'Limit', 'Stop', etc.
  }>>(new Map());
  const followerPositionsDataRef = useRef(followerPositionsData);
  const setFollowerPositionsData = (updater: any) => {
    _setFollowerPositionsData((prev: any) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      followerPositionsDataRef.current = next;
      return next;
    });
  };

  // Manual close in-flight guard (per account)
  const [manualCloseInFlight, setManualCloseInFlight] = useState<Set<number>>(new Set());

  // ✅ Force re-render every second for real-time market data test card
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 1000000);
    return () => clearInterval(interval);
  }, []);

  // Diagnostics: capture browser/network state changes for later correlation with ws closes
  useEffect(() => {
    const getConn = () => {
      const conn = (navigator as any).connection;
      if (!conn) return undefined;
      return {
        effectiveType: conn.effectiveType,
        rtt: conn.rtt,
        downlink: conn.downlink,
        saveData: conn.saveData
      };
    };

    const onOnline = () => {
      lastOnlineAtRef.current = Date.now();
      logWithTime('🌐 Browser ONLINE event', {
        onLine: navigator.onLine,
        visibilityState: document.visibilityState,
        connection: getConn()
      });
    };

    const onOffline = () => {
      lastOfflineAtRef.current = Date.now();
      logWithTime('🌐 Browser OFFLINE event', {
        onLine: navigator.onLine,
        visibilityState: document.visibilityState,
        connection: getConn()
      });
    };

    const onVisibility = () => {
      logWithTime('🪟 Tab visibility changed', {
        visibilityState: document.visibilityState,
        onLine: navigator.onLine,
        connection: getConn()
      });
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);

    // Emit initial snapshot once
    logWithTime('🧭 Diagnostics snapshot', {
      onLine: navigator.onLine,
      visibilityState: document.visibilityState,
      connection: getConn()
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ✅ NEW: Track canceled orders and display them temporarily
  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (canceledOrderClearTimer !== null) {
        clearTimeout(canceledOrderClearTimer);
      }
    };
  }, [canceledOrderClearTimer]);



  // Update copier status based on all required conditions
  // Copier Status is 'On' only if Access Token is valid and WebSocket is connected
  useEffect(() => {
    const statusOn = isLeaderTopstepX
      ? topstepLeaderStatus === 'connected'
      : isLeaderVolumetrica
        ? volumetricaLeaderStatus === 'connected'
        : (!!accessToken && connectionStatus === 'connected');
    const previousStatus = copierStatus;
    setCopierStatus(statusOn ? "On" : "Off");

    // When copier turns ON, fetch current orders/positions for leader and all followers
    if (statusOn && previousStatus === "Off") {
      logWithTime('🚀 Copier turned ON - fetching current orders and positions');
      
      // Fetch leader orders if leader account exists (Tradovate leaders only)
      if (!isLeaderTopstepX && !isLeaderVolumetrica && leaderAccount && currentUser?.uid) {
        logWithTime('📊 Fetching leader orders for account:', leaderAccount.id);
        fetchLeaderPosition().catch(err =>
          errorWithTime('❌ Failed to fetch leader position:', err)
        );
      }

      // Authenticate and fetch orders for all follower accounts
      const followers = accounts.filter(acc => acc.id !== leaderAccount?.id);
      if (followers.length > 0 && currentUser?.uid) {
        logWithTime('📊 Authenticating and fetching follower orders for', followers.length, 'accounts');
        
        followers.forEach(async (follower) => {
          try {
            // ✅ Determine follower platform
            const followerPlatform = follower.platform || 'Tradovate';
            const isTopstepX = followerPlatform === 'TopstepX';
            
            // ✅ TopstepX: Token already exists in Firestore, skip authentication
            if (isTopstepX) {
              logWithTime(`✅ TopstepX follower ${follower.name} - using existing token from Firestore`);
              
              // Fetch positions directly
              fetchFollowerPosition(follower.id).catch(err =>
                errorWithTime(`❌ Failed to fetch position for TopstepX follower ${follower.name}:`, err)
              );
              return;
            }
            
            // ✅ Tradovate: do NOT fetch access tokens into the browser.
            // `fetchFollowerPosition` calls server-side endpoints that refresh/use tokens safely.
            logWithTime(`✅ Tradovate follower ${follower.name} ready, fetching orders...`);
            
            // Now fetch positions with fresh token
            fetchFollowerPosition(follower.id).catch(err =>
              errorWithTime(`❌ Failed to fetch position for follower ${follower.name}:`, err)
            );
          } catch (err) {
            errorWithTime(`❌ Error authenticating follower ${follower.name}:`, err);
          }
        });
      }
    }
  }, [accessToken, connectionStatus, topstepLeaderStatus, isLeaderTopstepX, volumetricaLeaderStatus, isLeaderVolumetrica]);

  // ✅ CLEANUP: Periodically clear old processed orders (every 10 minutes)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if (processedOrdersRef.current.size > 1000) { // Only cleanup if we have many orders
        logWithTime('🧹 Cleaning up old processed orders and session mappings to prevent memory buildup');
        processedOrdersRef.current.clear();
        setProcessedOrders(new Set());
        
        // ✅ Also clean up old order session mappings
        const sessionMapSize = orderIdToSession.current.size;
        const accountMapSize = orderIdToAccountId.current.size;
        if (sessionMapSize > 500 || accountMapSize > 500) {
          orderIdToSession.current.clear();
          orderIdToAccountId.current.clear();
          logWithTime('🧹 Cleared order tracking maps:', { 
            sessionMapSize, 
            accountMapSize 
          });
        }
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // ✅ NEW: Daily Reset of PnL at midnight (00:00) and market close (17:00 ET)
  useEffect(() => {
    const resetDailyPnL = async (reason: string) => {
      logWithTime(`🔄 Resetting daily PnL - ${reason}`);
      setDailyPnL(new Map());
      
      // ✅ Reset realizedPnL in Firestore for all accounts
      if (accounts && accounts.length > 0) {
        try {
          logWithTime('📝 Resetting realizedPnL in Firestore for all accounts');
          
          // Reset for all accounts (leader + followers)
          await Promise.all(accounts.map(acc =>
            setDoc(doc(db, "finances", String(acc.id)), { 
              realizedPnL: 0 
            }, { merge: true })
          ));
          
          logWithTime('✅ Daily PnL reset complete for all accounts:', {
            accountCount: accounts.length,
            reason: reason,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          errorWithTime('❌ Failed to reset realizedPnL in Firestore:', error);
        }
      }
    };

    const scheduleNextReset = () => {
      const now = new Date();
      
      // Convert current time to EST
      const nowEST = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const currentHourEST = nowEST.getHours();
      
      // Market close at 5 PM EST (17:00)
      const marketCloseEST = new Date(nowEST);
      marketCloseEST.setHours(17, 0, 0, 0);
      if (currentHourEST >= 17) {
        marketCloseEST.setDate(marketCloseEST.getDate() + 1);
      }
      
      // Midnight EST (00:00)
      const midnightEST = new Date(nowEST);
      midnightEST.setDate(midnightEST.getDate() + 1);
      midnightEST.setHours(0, 0, 0, 0);
      
      // Convert back to local time for setTimeout
      const timeUntilMarketClose = new Date(marketCloseEST.toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
      const timeUntilMidnight = new Date(midnightEST.toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
      
      let nextResetTime: number;
      let nextResetReason: string;
      
      if (timeUntilMarketClose < timeUntilMidnight && timeUntilMarketClose > 0) {
        nextResetTime = timeUntilMarketClose;
        nextResetReason = 'Market Close (17:00 EST)';
      } else {
        nextResetTime = timeUntilMidnight;
        nextResetReason = 'Midnight (00:00 EST)';
      }
      
      logWithTime(`⏰ Next P&L reset scheduled for ${nextResetReason} in ${Math.round(nextResetTime / 1000 / 60)} minutes`);
      
      return setTimeout(() => {
        resetDailyPnL(nextResetReason);
        // Schedule the next reset after this one completes
        scheduleNextReset();
      }, nextResetTime);
    };

    const resetTimeout = scheduleNextReset();

    return () => clearTimeout(resetTimeout);
  }, [accounts]);

  // Position tracking state - UPDATED for trade session system
  const [positions, _setPositions] = useState<Map<string, any>>(new Map());
  const positionsRef = useRef(positions);
  const setPositions = (updater: Map<string, any> | ((prev: Map<string, any>) => Map<string, any>)) => {
    _setPositions(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      positionsRef.current = next;
      return next;
    });
  };
  const [apiPositions, setApiPositions] = useState<Map<string, any>>(new Map()); // Positions from tradovatepos API
  const [tradeSessions, setTradeSessions] = useState<any[]>([]); // Array of trade sessions
  const [currentTradeSession, setCurrentTradeSession] = useState(1); // Current T-1, T-2, T-3, etc.
  const [viewingTradeSession, setViewingTradeSession] = useState(1); // Which session user is viewing
  
  // ✅ Initialize the ref with the current session value
  useEffect(() => {
    currentSessionRef.current = currentTradeSession;
  }, [currentTradeSession]);
  
  const [tradeStats, setTradeStats] = useState({
    totalTrades: 0,
    winningTrades: 0,
    totalProfit: 0,
    totalLoss: 0,
    winRate: 0,
    riskReward: 0
  });





  // Calculate dynamic values for summary cards
  const accountsConnected = (leaderAccount ? 1 : 0) + followers.length;
  
  // ✅ FIX: Only sum capital from accounts actually displayed in the table (leader + followers)
  const totalCapital = (() => {
    let sum = 0;
    // Add leader account balance if it exists
    if (leaderAccount && leaderAccount.balance) {
      sum += Number(leaderAccount.balance) || 0;
    }
    // Add follower account balances
    followers.forEach(follower => {
      if (follower.balance) {
        sum += Number(follower.balance) || 0;
      }
    });
    return sum;
  })();
  
  // Trading activity - renamed to hello, no longer used
  const totalTradingActivity = 0;

 const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatCapital = (value: number) => {
    if (value >= 1000) {
      return Math.round(value / 1000).toLocaleString();
    }
    return Math.round(value).toLocaleString();
  };
  const iconColor = "text-muted-foreground";

  // Trade stats update function - now uses manual trades from useTradeStore
  const updateTradeStats = () => {
    if (!currentUser || !trades.length) {
      setTradeStats({
        totalTrades: 0,
        winningTrades: 0,
        totalProfit: 0,
        totalLoss: 0,
        winRate: 0,
        riskReward: 0
      });
      return;
    }

    // Use manual trades from Trade Log Book, apply same filters as P&L chart
    const userTrades = trades.filter(trade => {
      if (trade.userId !== currentUser.uid) return false;
      const matchesSymbol = !filterCriteria.symbol || (trade.symbol?.toLowerCase().includes(filterCriteria.symbol.toLowerCase()));
      const matchesAccount = !filterCriteria.account || (trade.account?.toLowerCase().includes(filterCriteria.account.toLowerCase()));
      return matchesSymbol && matchesAccount;
    });

    // Filter out positions with zero PnL (break-even trades)
    const nonZeroPositions = userTrades.filter(position => position.pnl !== 0);
    const winningPositions = nonZeroPositions.filter(position => position.pnl > 0);
    const losingPositions = nonZeroPositions.filter(position => position.pnl < 0);

    // Win rate calculation: (winningPositions / nonZeroPositions) * 100
    const winRate = nonZeroPositions.length > 0 ? (winningPositions.length / nonZeroPositions.length) * 100 : 0;

    // Risk/Reward calculation: avgWin / avgLoss
    const totalWins = winningPositions.reduce((sum, position) => sum + Number(position.pnl), 0);
    const totalLosses = Math.abs(losingPositions.reduce((sum, position) => sum + Number(position.pnl), 0));
    
    const avgWin = winningPositions.length > 0 ? totalWins / winningPositions.length : 0;
    const avgLoss = losingPositions.length > 0 ? totalLosses / losingPositions.length : 0;
    
    const riskReward = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0;
    

    
    setTradeStats({
      totalTrades: nonZeroPositions.length,
      winningTrades: winningPositions.length,
      totalProfit: totalWins,
      totalLoss: totalLosses,
      winRate,
      riskReward
    });
  };

  // Update trade stats when manual trades change
  useEffect(() => {
    updateTradeStats();
  }, [trades, currentUser]);

  // Load trades from Firestore when component mounts
  useEffect(() => {
    if (currentUser) {
      loadTradesFromFirestore();
    }
  }, [currentUser]);





  // Dynamic account limits based on subscription
  const [userSubscription, setUserSubscription] = useState<{
    active: boolean;
    subscriptionType: string | null;
  }>({ active: false, subscriptionType: null });

  // Function to get max accounts based on subscription type
  const getMaxAccounts = (subscriptionType: string | null): number => {
    switch (subscriptionType) {
      case 'pro':
        return 70;
      case 'proplus':
        return 70;
      case 'basic':
        return 0;
      case null:
      case undefined:
      default:
        return 0;
    }
  };

  const maxAccounts = getMaxAccounts(userSubscription.subscriptionType);
  const totalAccounts = (leaderAccount ? 1 : 0) + followers.length;

function decodeJwtMeta(token?: string | null) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return { format: 'non-jwt' };
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
    const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
    const secondsToExpiry = exp != null ? exp - nowSec : undefined;
    return {
      exp,
      iat,
      secondsToExpiry,
      expired: secondsToExpiry != null ? secondsToExpiry <= 0 : undefined,
      expISO: exp != null ? new Date(exp * 1000).toISOString() : undefined,
      iatISO: iat != null ? new Date(iat * 1000).toISOString() : undefined
    };
  } catch {
    return { format: 'non-jwt' };
  }
}

function getClientEnvMeta() {
  const conn = (navigator as any).connection;
  return {
    onLine: navigator.onLine,
    visibilityState: document.visibilityState,
    connection: conn
      ? {
          effectiveType: conn.effectiveType,
          rtt: conn.rtt,
          downlink: conn.downlink,
          saveData: conn.saveData
        }
      : undefined
  };
}

function redactSensitive(input: any, maxDepth = 6): any {
  const seen = new WeakSet<object>();
  const keyIsSensitive = (key: string) =>
    /(access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|bearer|jwt|secret|password|api[_-]?key|token)/i.test(key);

  const looksLikeJwt = (value: unknown) => {
    if (typeof value !== 'string') return false;
    const parts = value.split('.');
    return parts.length === 3 && value.length > 40;
  };

  const walk = (value: any, depth: number): any => {
    if (value == null) return value;
    if (typeof value === 'string') {
      if (looksLikeJwt(value)) return '[REDACTED_JWT]';
      return value;
    }
    if (typeof value !== 'object') return value;
    if (depth <= 0) return '[REDACTED_DEPTH_LIMIT]';
    if (seen.has(value)) return '[REDACTED_CYCLE]';
    seen.add(value);

    if (Array.isArray(value)) return value.map((v) => walk(v, depth - 1));

    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (keyIsSensitive(k)) {
        out[k] = '[REDACTED]';
      } else if (typeof v === 'string' && looksLikeJwt(v)) {
        out[k] = '[REDACTED_JWT]';
      } else {
        out[k] = walk(v, depth - 1);
      }
    }
    return out;
  };

  return walk(input, maxDepth);
}

function redactSensitiveText(text?: string, maxLen = 500) {
  if (!text) return text;
  const sliced = text.slice(0, maxLen);
  return sliced
    .replace(/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, '$1[REDACTED]')
    .replace(/("(?:access_token|refresh_token|id_token|token)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"');
}

const makeDebugId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const getFreshFirebaseIdToken = async (purpose: string, forceRefresh = false) => {
  if (!currentUser) throw new Error('No currentUser');
  const token = await currentUser.getIdToken(forceRefresh);
  logWithTime('🔐 Firebase ID token obtained', {
    purpose,
    forceRefresh,
    jwt: decodeJwtMeta(token),
    env: getClientEnvMeta()
  });
  return token;
};

const postJsonWithFirebaseAuth = async <T,>(
  url: string,
  body: any,
  opts: { purpose: string; retryOn401?: boolean } = { purpose: url, retryOn401: true }
): Promise<{ ok: boolean; status: number; data?: T; text?: string; debugId: string }> => {
  const debugId = makeDebugId('api');
  const startedAt = Date.now();

  const doRequest = async (forceRefresh: boolean): Promise<{ res: Response; text: string; data: any }> => {
    const authToken = await getFreshFirebaseIdToken(`${opts.purpose} (debugId=${debugId})`, forceRefresh);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Debug-Id': debugId
      },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let data: any = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      // leave as text
    }

    logWithTime('📡 API response', {
      debugId,
      url,
      purpose: opts.purpose,
      status: res.status,
      ok: res.ok,
      elapsedMs: Date.now() - startedAt,
      bodySummary: {
        action: body?.action,
        accountId: body?.accountId,
        userId: body?.userId
      },
      response: typeof data === 'object' ? redactSensitive(data) : { raw: redactSensitiveText(text) },
      env: getClientEnvMeta()
    });

    return { res, text, data };
  };

  try {
    const first = await doRequest(false);
    if (first.res.ok) {
      return { ok: true, status: first.res.status, data: first.data as T, debugId };
    }
    if (first.res.status === 401 && opts.retryOn401 !== false) {
      logWithTime('🔁 API 401 - retrying once with forced Firebase token refresh', { debugId, url, purpose: opts.purpose });
      const second = await doRequest(true);
      if (second.res.ok) {
        return { ok: true, status: second.res.status, data: second.data as T, debugId };
      }
      return { ok: false, status: second.res.status, data: second.data as T, text: second.text, debugId };
    }
    return { ok: false, status: first.res.status, data: first.data as T, text: first.text, debugId };
  } catch (err) {
    errorWithTime('❌ API call failed (network/exception)', { debugId, url, purpose: opts.purpose, err, env: getClientEnvMeta() });
    return { ok: false, status: 0, text: String(err), debugId };
  }
};

// ✅ NEW: Flatten All Positions - Close all open positions and cancel all pending orders
const handleFlattenAllPositions = async () => {
  if (!currentUser?.uid) {
    errorWithTime('❌ Cannot flatten positions: No user authenticated');
    return;
  }

  // ✅ DISABLE trade copying during flatten to prevent copying flatten orders
  logWithTime('🔥 Starting Flatten All Positions operation...');
  logWithTime('⏸️ Temporarily disabling trade copying to prevent loop');
  setIsFlatteningPositions(true);
  isFlatteningRef.current = true;

  try {
    // Get all accounts (leader + followers)
    const allAccounts = [leaderAccount, ...followers].filter(Boolean);
    
    if (allAccounts.length === 0) {
      errorWithTime('❌ No accounts configured for flattening');
      return;
    }

    logWithTime(`🎯 Flattening positions for ${allAccounts.length} accounts...`, {
      accounts: allAccounts.map(acc => ({ id: acc.id, name: acc.name }))
    });

    let totalSuccess = 0;
    let totalFailed = 0;

    // ✅ PARALLEL EXECUTION: Flatten all accounts concurrently (up to 8 at a time)
    const flattenConcurrency = 8;
    await mapWithConcurrency(allAccounts, flattenConcurrency, async (account) => {
      try {
        // ✅ Determine platform for this account
        const platform = account.platform || 'Tradovate';
        const isTopstepX = platform === 'TopstepX';
        const isVolumetrica = platform === 'Volumetrica';
        const copyApiEndpoint = isTopstepX
          ? '/api/projectxcopy'
          : isVolumetrica
            ? '/api/volumetricacopy'
            : '/api/tradovatecopy';
        
        logWithTime(`🔄 Processing account: ${account.name} (${account.id}) on ${platform}`);
        
        // ✅ TopstepX: flatten is supported via /api/projectxcopy
        
        // Use the serverless API to flatten all positions for this account
        const token = await currentUser.getIdToken();
        const flattenResponse = await fetch(copyApiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'flattenAllPositions',
            userId: currentUser.uid,
            accountId: account.id.toString()
          })
        });

        if (flattenResponse.ok) {
          const parsed = await readJsonOrText(flattenResponse);
          if (!parsed.isJson) {
            throw new Error(`flattenAllPositions returned non-JSON (status ${flattenResponse.status}) preview: ${parsed.text.slice(0, 200)}`);
          }
          const result: any = parsed.data;
          logWithTime(`✅ Completed flattening for account: ${account.name}`, {
            closedPositions: result.closeResult?.closedPositions?.length || 0,
            canceledOrders: result.cancelResult?.canceledOrders?.length || 0,
            failedPositions: result.closeResult?.failedClosures?.length || 0,
            failedOrders: result.cancelResult?.failedCancellations?.length || 0
          });
          
          totalSuccess += (result.closeResult?.closedPositions?.length || 0);
          totalFailed += (result.closeResult?.failedClosures?.length || 0);
        } else {
          const errorText = await flattenResponse.text();
          errorWithTime(`❌ Failed to flatten account ${account.name}:`, errorText);
          totalFailed++;
        }
        
      } catch (accountError) {
        errorWithTime(`❌ Failed to flatten account ${account.name}:`, accountError);
        totalFailed++;
        // Continue with other accounts even if one fails
      }
    })

    // Clear the local UI state after successful operations
    if (totalSuccess > 0) {
      // Only clear positions that should be closed
      setPositions(prev => {
        const newPositions = new Map(prev);
        // Mark all open positions as closed
        for (const [key, position] of newPositions.entries()) {
          if (position.status === 'open') {
            newPositions.set(key, { ...position, status: 'closed', pnl: position.unrealizedPnL || 0 });
          }
        }
        return newPositions;
      });
      
      logWithTime(`🎉 Flatten All Positions completed! Success: ${totalSuccess}, Failed: ${totalFailed}`);
    } else {
      logWithTime(`⚠️ Flatten operation completed with no successful closures. Failed: ${totalFailed}`);
    }
    
    // ✅ CLEAR: Remove everything from Live Positions card for ALL accounts
    setLeaderPositionData(null);
    setFollowerPositionsData(new Map());
    logWithTime('🧹 Cleared Live Positions card data');
    
    // ✅ SHOW: Display "Flattened & Cancelled" message for 5 seconds before clearing
    const flattenTime = new Date().toISOString();
    const flattenDisplayTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    
    // Set leader flatten message
    setLatestLeaderFill({
      symbol: 'ALL',
      qty: 0,
      price: 0,
      direction: 'Flattened & Cancelled',
      timestamp: flattenTime
    });
    
    // Set follower flatten messages
    const followerFlattenOrders = new Map<string, FollowerOrderSnapshot[]>();
    logWithTime(`📊 Setting flatten messages for ${followers.length} followers:`, followers.map(f => ({ id: f.id, name: f.name })));
    followers.forEach(follower => {
      followerFlattenOrders.set(String(follower.id), [
        {
          followerOrderId: undefined,
          leaderOrderId: undefined,
          symbol: 'ALL',
          qty: 0,
          price: 0,
          direction: 'Flattened & Cancelled',
          orderTypeLabel: 'Flattened & Cancelled',
          timestamp: flattenTime,
          isPending: false
        }
      ]);
    });
    setFollowerLatestOrders(followerFlattenOrders);
    logWithTime(`📊 Follower flatten orders Map size: ${followerFlattenOrders.size}`);
    
    logWithTime(`📊 Showing flatten message at ${flattenDisplayTime} for 0.2 seconds`);
    
    // ✅ CLEAR: After 0.2 seconds, remove everything from Copier Actions table
    setTimeout(() => {
      setLatestLeaderFill(null);
      setLatestLeaderOrders(null);
      setFollowerLatestOrders(new Map());
      logWithTime('🧹 Cleared Copier Actions table data after 0.2 seconds');
    }, 200);
    
  } catch (error) {
    errorWithTime('❌ Error during Flatten All Positions operation:', error);
    // ✅ CLEAR: Remove everything from Live Positions card on error too
    setLeaderPositionData(null);
    setFollowerPositionsData(new Map());
    logWithTime('🧹 Cleared Live Positions card data (error path)');
    
  } finally {
    // ✅ RE-ENABLE trade copying after a short delay to ensure all flatten fills are processed
    setTimeout(() => {
      logWithTime('▶️ Re-enabling trade copying after flatten operation');
      setIsFlatteningPositions(false);
      isFlatteningRef.current = false;
    }, 1000); // 1 second delay to ensure all flatten fills are processed
  }
};

// ✅ NEW: Calculate trading statistics (RR and Win Rate) from closed positions
const calculateTradingStats = (accountId: number) => {
  const accountPositions = Array.from(positions.values())
    .filter(pos => pos.accountId === accountId && pos.status === 'closed' && pos.pnl !== 0);
  
  if (accountPositions.length === 0) {
    return { avgRR: "—", winRate: "0%" };
  }
  
  const winningTrades = accountPositions.filter(pos => pos.pnl > 0);
  const losingTrades = accountPositions.filter(pos => pos.pnl < 0);
  
  const winRate = (winningTrades.length / accountPositions.length) * 100;
  
  if (winningTrades.length === 0 || losingTrades.length === 0) {
    return { 
      avgRR: losingTrades.length === 0 ? "∞" : "—", 
      winRate: `${winRate.toFixed(1)}%` 
    };
  }
  
  const avgWin = winningTrades.reduce((sum, pos) => sum + pos.pnl, 0) / winningTrades.length;
  const avgLoss = Math.abs(losingTrades.reduce((sum, pos) => sum + pos.pnl, 0) / losingTrades.length);
  
  const avgRR = (avgWin / avgLoss).toFixed(2);
  
  return { 
    avgRR: avgRR, 
    winRate: `${winRate.toFixed(1)}%` 
  };
};



// ✅ FIXED: Track each trade separately - never reuse closed positions
const updatePositions = async (fill: any) => {
  // Check if this is a position update (with real-time PnL) or a fill
  const isPositionUpdate = fill.type === 'position_update';
  
  const account = accounts.find((acc: any) => acc.id === fill.accountId);
  
  setPositions(prev => {
    const newPositions = new Map(prev);
    
    // ✅ FIXED: For position updates, find existing open position
    if (isPositionUpdate) {
      // ✅ FIX: Also check for CLOSED positions to handle delayed exit fills
      const existingPositions = Array.from(newPositions.entries()).filter(
        ([key, pos]) => 
          pos.accountId === fill.accountId && 
          (pos.contractSymbol === fill.contractSymbol || pos.contractId === fill.contractId)
      );
      
      // Prefer open positions, but accept closed ones if exit fill arrives late
      const existingOpenPositions = existingPositions.filter(([key, pos]) => pos.status === 'open');
      const positionsToCheck = existingOpenPositions.length > 0 ? existingOpenPositions : existingPositions;
      
      if (positionsToCheck.length > 0) {
        const [positionKey, existingPosition] = positionsToCheck[0];
        // Continue with existing logic for position update...
        
        logWithTime('💰 Updating existing open position with real-time PnL:', {
          symbol: existingPosition.contractSymbol,
          netPos: fill.netPos,
          unrealizedPnL: fill.unrealizedPnL,
          realizedPnL: fill.realizedPnL
        });
        
        // Update position data from WebSocket
        existingPosition.netPosition = fill.netPos || 0;
        existingPosition.unrealizedPnL = fill.unrealizedPnL || 0;
        existingPosition.realizedPnL = fill.realizedPnL || 0;
        
        // Handle position status based on net position
        if (existingPosition.netPosition === 0) {
          const wasOpen = existingPosition.status !== 'closed';
          existingPosition.status = 'closed';
          
          // Use calculated PnL from fills if available, otherwise use realized PnL
          if (existingPosition.fills && existingPosition.fills.length > 0 && existingPosition.totalBought > 0 && existingPosition.totalSold > 0) {
            // Keep the calculated PnL from fills
          } else {
            existingPosition.pnl = existingPosition.realizedPnL; // Fallback to WebSocket data
          }
          
          // Immediately update Trading Activity when position closes
          if (wasOpen) {
            logWithTime('📊 Position closed via WebSocket - updating Trading Activity');
            
            // ✅ MOVED: Save leader position AFTER processing followers (see below)
          }
          
          // Handle leader position closing
          const isLeaderAccount = leaderAccount && existingPosition.accountId === leaderAccount.id;
          if (isLeaderAccount && wasOpen) {
            logWithTime('👑 Leader position closed via WebSocket - closing follower positions');
            
            // ✅ CAPTURE: Get all active followers RIGHT NOW while we know they exist
            const activeFollowersAtClose = Array.from(positions.values())
              .filter(pos => 
                pos.accountId !== leaderAccount?.id && // Not the leader
                pos.contractSymbol === existingPosition.contractSymbol && // Same symbol
                pos.tradeSession === existingPosition.tradeSession // Same session
              )
              .map(followerPos => ({
                accountId: followerPos.accountId,
                accountName: followerPos.accountName,
                pnl: followerPos.pnl || 0,
                quantity: Math.abs(followerPos.netPosition) || Math.max(followerPos.totalBought || 0, followerPos.totalSold || 0),
                ratio: followerRatios.get(followerPos.accountId.toString()) || 1,
                status: followerPos.status
              }));
            
            // ✅ ATTACH: Add follower info directly to the leader position
            existingPosition.activeFollowers = activeFollowersAtClose;
            existingPosition.followerCount = activeFollowersAtClose.length;
            
            logWithTime('📊 Captured followers at close:', {
              symbol: existingPosition.contractSymbol,
              followerCount: activeFollowersAtClose.length,
              followers: activeFollowersAtClose.map((f: any) => f.accountName)
            });
            
            // Skipping Firestore save of closed positions (disabled)
            
            // ✅ REMOVED: Don't update dailyPnL here with placeholder 0
            // The fetchAndUpdateRealizedPnL() function will update it with the actual value from Tradovate
            
            // ✅ FIX: Close follower positions SYNCHRONOUSLY (no setTimeout) to prevent race conditions
            // where follower "Open" badge persists due to delayed state updates
            followers.forEach(follower => {
              const followerPositions = Array.from(newPositions.entries()).filter(([key, pos]) => 
                pos.accountId === follower.id && 
                pos.contractSymbol === existingPosition.contractSymbol &&
                pos.status === 'open'
              );
              
              // Close all follower positions for this symbol
              followerPositions.forEach(([followerKey, followerPos]: any) => {
                const followerRatio = followerRatios.get(follower.id.toString()) || 1;
                followerPos.status = 'closed';
                followerPos.netPosition = 0;
                followerPos.pnl = existingPosition.pnl * followerRatio;
                newPositions.set(followerKey, followerPos);
                
                // ❌ REMOVED: Don't fetch P&L here - follower position hasn't closed yet!
                // The P&L will be updated after the follower's close trade is successfully copied
              });
            });
          }
        } else {
          existingPosition.status = 'open';
          existingPosition.pnl = existingPosition.unrealizedPnL;
        }
        
        newPositions.set(positionKey, existingPosition);
        return newPositions;
      }
      
      // If no open position found for update, ignore this update
      return newPositions;
    }
    
    // ✅ FIXED: For fill events, create completely new position if no open position exists
    // First, check if there's an existing OPEN position for this symbol AND account
    const existingOpenPositions = Array.from(newPositions.entries()).filter(
      ([key, pos]) => 
        pos.accountId === fill.accountId && 
        (pos.contractSymbol === fill.contractSymbol || pos.contractId === fill.contractId) &&
        pos.status === 'open'
    );
    
    let positionKey: string;
    let existingPosition: any;
    
    if (existingOpenPositions.length > 0) {
      // Use existing open position - this ensures closing fills go to the same position
      [positionKey, existingPosition] = existingOpenPositions[0];
      logWithTime('📝 Adding fill to existing open position:', {
        symbol: fill.contractSymbol,
        action: fill.action,
        qty: fill.qty,
        existingNetPosition: existingPosition.netPosition
      });
    } else {
      // Only create new position if this is truly a fresh trade
      // Check if there are ANY open positions across ALL accounts for this session
      const allOpenPositions = Array.from(newPositions.values())
        .filter(pos => pos.status === 'open');

      // Always use fill.tradeSession if provided (for both leader and follower fills)
      // ✅ FIX: Use ref for immediate session value to avoid stale state
      let sessionToUse = fill.tradeSession || currentSessionRef.current;

      // ✅ FIX: Check for session advancement even when fill has tradeSession
      // We should advance if this fill is for a NEW trade and all positions in current session are closed
      const currentSessionPositions = Array.from(newPositions.values())
        .filter(pos => pos.tradeSession === currentSessionRef.current);
        
      const currentSessionOpenPositions = currentSessionPositions.filter(pos => pos.status === 'open');
      
      // Session advancement conditions:
      // 1. No open positions anywhere AND current session has closed trades
      // 2. OR if fill doesn't have tradeSession and we need to start fresh
      const shouldAdvanceSession = (
        allOpenPositions.length === 0 && 
        currentSessionPositions.length > 0 && 
        currentSessionOpenPositions.length === 0
      ) || (!fill.tradeSession && allOpenPositions.length === 0);

      if (shouldAdvanceSession) {
        sessionToUse = currentSessionRef.current + 1;

        logWithTime('🔄 Auto-advancing to next trade session for new position:', {
          previousSessionState: currentTradeSession,
          previousSessionRef: currentSessionRef.current,
          newSession: sessionToUse,
          reason: 'All positions closed in current session - starting fresh trade session',
          allOpenPositions: allOpenPositions.length,
          currentSessionTotal: currentSessionPositions.length,
          currentSessionOpen: currentSessionOpenPositions.length
        });

        // Update current session number
        setCurrentTradeSession(sessionToUse);
        setViewingTradeSession(sessionToUse);
        currentSessionRef.current = sessionToUse; // ✅ FIX: Update ref immediately for order tracking
      }

      // Always create NEW position for new trades
      const tradeTimestamp = Date.now();
      positionKey = `${fill.accountId}_${fill.contractSymbol || fill.contractId}_${tradeTimestamp}`;

      existingPosition = {
        accountId: fill.accountId,
        accountName: account?.name || 'Unknown',
        platform: account?.platform || 'Unknown',
        balance: account?.balance || 0,
        contractSymbol: fill.contractSymbol || `Contract_${fill.contractId}`,
        contractId: fill.contractId,
        totalBought: 0,
        totalSold: 0,
        netPosition: 0,
        netPos: 0, // For unrealized P&L calculation
        avgEntryPrice: 0,
        netPrice: 0, // For unrealized P&L calculation (same as avgEntryPrice)
        totalCost: 0,
        totalSoldCost: 0, // ✅ FIX: Add totalSoldCost for short positions
        status: 'open',
        pnl: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        fills: [],
        tradeSession: sessionToUse // Always use fill's session if present
      };
      
      // ✅ DEBUG: Log position creation with symbol details
      logWithTime('🆕 [Position Create] New position created:', {
        positionKey,
        contractSymbol: existingPosition.contractSymbol,
        contractId: existingPosition.contractId,
        fillContractSymbol: fill.contractSymbol,
        fillContractId: fill.contractId,
        action: fill.action,
        session: sessionToUse,
        accountId: fill.accountId
      });
      
      logWithTime('🆕 Creating new position for fresh trade:', {
        positionKey,
        symbol: fill.contractSymbol,
        action: fill.action,
        session: sessionToUse
      });
    }
    
    // Add this fill to the position
    const newFill = {
      ...fill,
      timestamp: new Date().toISOString()
    };
    existingPosition.fills.push(newFill);

    logWithTime('📈 Fill added to position:', {
      symbol: existingPosition.contractSymbol,
      totalFillsNow: existingPosition.fills.length,
      fillAction: fill.action,
      fillQty: fill.qty,
      positionKey: positionKey
    });

    // Update quantities based on fill action
    if (fill.action === 'Buy') {
      const newTotalBought = existingPosition.totalBought + fill.qty;
      const newTotalCost = existingPosition.totalCost + (fill.price * fill.qty);
      existingPosition.totalBought = newTotalBought;
      existingPosition.totalCost = newTotalCost;
      existingPosition.avgEntryPrice = newTotalBought > 0 ? newTotalCost / newTotalBought : 0;
      existingPosition.netPrice = existingPosition.avgEntryPrice; // Sync for unrealized P&L
    } else if (fill.action === 'Sell') {
      existingPosition.totalSold += fill.qty;
      
      // ✅ FIX: Calculate avgEntryPrice for short positions (Sell first)
      if (existingPosition.totalBought === 0) {
        // This is a short position (selling first)
        const totalSoldCost = (existingPosition.totalSoldCost || 0) + (fill.price * fill.qty);
        existingPosition.totalSoldCost = totalSoldCost;
        existingPosition.avgEntryPrice = existingPosition.totalSold > 0 ? totalSoldCost / existingPosition.totalSold : 0;
        existingPosition.netPrice = existingPosition.avgEntryPrice; // Sync for unrealized P&L
      }
    }

      // Calculate net position (positive = long, negative = short, zero = flat)
    existingPosition.netPosition = existingPosition.totalBought - existingPosition.totalSold;
    existingPosition.netPos = existingPosition.netPosition; // Sync for unrealized P&L

    // Determine status and calculate PnL
    if (existingPosition.netPosition === 0 && existingPosition.totalBought > 0 && existingPosition.totalSold > 0) {
      const wasOpen = existingPosition.status !== 'closed';
      existingPosition.status = 'closed';
      
      // ✅ UPDATED: Fetch actual realized PnL from Tradovate API instead of calculating locally
      // Note: We'll fetch this AFTER setPositions updates complete
      existingPosition.pnl = 0; // Placeholder - will be updated via async call below
      
      logWithTime('💰 Position closed - will fetch actual realizedPnL from Tradovate:', {
        accountId: existingPosition.accountId,
        symbol: existingPosition.contractSymbol
      });
      
      // ✅ Fetch actual PnL from API asynchronously
      fetchAndUpdateRealizedPnL(existingPosition.accountId, existingPosition);
      
      // Update Trading Activity when position closes
      if (wasOpen) {
        logWithTime('📊 Position closed via fill - updating Trading Activity');
        
        // ✅ MOVED: Save will happen after follower processing (see below)
      }
      
      // Handle leader position closing
      const isLeaderAccountCheck = leaderAccount && existingPosition.accountId === leaderAccount.id;
      if (isLeaderAccountCheck && wasOpen) {
        logWithTime('👑 Leader position closed - closing follower positions');
        
        // ✅ CAPTURE: Get all active followers RIGHT NOW while we know they exist
        const activeFollowersAtClose = Array.from(newPositions.values())
          .filter(pos => 
            pos.accountId !== leaderAccount?.id && // Not the leader
            pos.contractSymbol === existingPosition.contractSymbol && // Same symbol
            pos.tradeSession === existingPosition.tradeSession // Same session
          )
          .map(followerPos => ({
            accountId: followerPos.accountId,
            accountName: followerPos.accountName,
            pnl: followerPos.pnl || 0,
            quantity: Math.abs(followerPos.netPosition) || Math.max(followerPos.totalBought || 0, followerPos.totalSold || 0),
            ratio: followerRatios.get(followerPos.accountId.toString()) || 1,
            status: followerPos.status
          }));
        
        // ✅ ATTACH: Add follower info directly to the leader position
        existingPosition.activeFollowers = activeFollowersAtClose;
        existingPosition.followerCount = activeFollowersAtClose.length;
        
        logWithTime('📊 Captured followers at close (fill path):', {
          symbol: existingPosition.contractSymbol,
          followerCount: activeFollowersAtClose.length,
          followers: activeFollowersAtClose.map((f: any) => f.accountName)
        });
        
        // Skipping Firestore save of closed positions (disabled)
        
        // ✅ REMOVED: Don't update dailyPnL here with placeholder 0
        // The fetchAndUpdateRealizedPnL() function will update it with the actual value from Tradovate
        
        // ✅ Close all follower positions for this symbol (simplified - state updates handled separately)
        followers.forEach(follower => {
          const followerPositions = Array.from(newPositions.entries()).filter(([key, pos]) => 
            pos.accountId === follower.id && 
            pos.contractSymbol === existingPosition.contractSymbol &&
            pos.status === 'open'
          );
          
          followerPositions.forEach(([followerKey, followerPos]) => {
            const followerRatio = followerRatios.get(follower.id.toString()) || 1;
            followerPos.status = 'closed';
            followerPos.netPosition = 0;
            followerPos.pnl = existingPosition.pnl * followerRatio;
            newPositions.set(followerKey, followerPos);
            
            // ✅ UPDATE: Fetch and update follower's daily PnL from Tradovate
            fetchAndUpdateRealizedPnL(follower.id, followerPos);
          });
        });
      }
    } else {
      // Position is still open
      existingPosition.status = 'open';
      existingPosition.pnl = existingPosition.unrealizedPnL || 0; // Use unrealized PnL for open positions
    }
    newPositions.set(positionKey, existingPosition);
    return newPositions;
  });
  
  // Update trade statistics after position changes
  setTimeout(() => {
    updateTradeStats();
  }, 100);

  // Create trade session snapshots after position changes
  setTimeout(() => {
    setPositions(currentPositions => {
      // ✅ NEW: Trade Session System
      // When all positions in current session are closed, advance to next session
      const currentSessionPositions = Array.from(currentPositions.values())
        .filter(pos => pos.tradeSession === currentTradeSession);
      
      const hasOpenPositions = currentSessionPositions.some(pos => pos.status === 'open');
      const hasAnyPositions = currentSessionPositions.length > 0;
      
      // If current session has positions and all are closed, advance to next session
      if (hasAnyPositions && !hasOpenPositions) {
        const nextSession = currentTradeSession + 1;
        
        logWithTime('🔄 All positions closed in current session, advancing:', {
          currentSession: currentTradeSession,
          nextSession: nextSession,
          closedPositions: currentSessionPositions.length
        });
        
        // Create trade session snapshot
        setTradeSessions(prevSessions => {
          const newSessions = [...prevSessions];
          newSessions[currentTradeSession - 1] = {
            sessionNumber: currentTradeSession,
            positions: currentSessionPositions,
            status: 'closed',
            timestamp: new Date().toISOString()
          };
          
          // Skipping saveTradeSessions to Firestore (disabled)
          
          return newSessions;
        });
        
        // Advance to next empty session
        setCurrentTradeSession(nextSession);
        setViewingTradeSession(nextSession); // Auto-view the new empty session
        
        logWithTime(`✅ Advanced to trade session T-${nextSession}`);
        
        // ✅ NEW: Remove closed positions from main map after moving to history
        const updatedPositions = new Map(currentPositions);
        currentSessionPositions.forEach(closedPos => {
          const positionKey = Array.from(updatedPositions.entries())
            .find(([key, pos]) => pos === closedPos)?.[0];
          if (positionKey) {
            updatedPositions.delete(positionKey);
            logWithTime('🗑️ Removed closed position from main map:', {
              accountId: closedPos.accountId,
              symbol: closedPos.contractSymbol,
              session: closedPos.tradeSession
            });
          }
        });
        
        return updatedPositions;
      }
      
      return currentPositions;
    });
  }, 300);

  // ✅ REMOVED: Auto-save to prevent Firestore spam - only save closed positions now
};

// ✅ NEW: Fetch actual realized PnL from Tradovate API and update dailyPnL
const fetchAndUpdateRealizedPnL = async (accountId: number, closedPosition: any) => {
  try {
    const accountResult = await postJsonWithFirebaseAuth<any>(
      '/api/tradovate',
      {
        action: 'account',
        userId: currentUser?.uid,
        accountId: accountId
      },
      { purpose: `fetchAndUpdateRealizedPnL accountId=${accountId}` }
    );

    if (accountResult.ok) {
      const responseData: any = accountResult.data;
      const accountData = responseData?.accounts?.[0] ?? responseData;
      const cashBalance = accountData?.cashBalances?.[0];
      const actualRealizedPnL = cashBalance?.realizedPnL || 0;
      
      // Update the position with actual PnL (this is just for display)
      closedPosition.pnl = actualRealizedPnL;
      
      // ✅ FIX: Use Tradovate's realizedPnL directly (it's already the day's total)
      // Don't add to previous value - just set it
      setDailyPnL(prev => {
        const newMap = new Map(prev);
        newMap.set(accountId, actualRealizedPnL);
        newMap.set(accountId.toString(), actualRealizedPnL);
        logWithTime('💰 Updated dailyPnL from Tradovate cashBalance:', {
          accountId,
          realizedPnL: actualRealizedPnL
        });
        
        // ✅ SAVE: Persist realizedPnL to Firestore so it survives page refresh
        (async () => {
          try {
            await setDoc(doc(db, "finances", String(accountId)), {
              realizedPnL: actualRealizedPnL
            }, { merge: true });
            logWithTime('✅ Saved realizedPnL to Firestore:', { accountId, realizedPnL: actualRealizedPnL });
          } catch (error) {
            errorWithTime('❌ Error saving realizedPnL to Firestore:', error);
          }
        })();
        
        return newMap;
      });
    } else {
      errorWithTime('❌ Failed to fetch account data for PnL:', {
        accountId,
        status: accountResult.status,
        debugId: accountResult.debugId,
        response: accountResult.data
      });
    }
  } catch (error) {
    errorWithTime('❌ Error fetching account realizedPnL:', error);
  }
};

// ✅ FIRESTORE HELPERS: Persistent tracking for pending orders (survives reconnects)

const normalizeIdForFirestore = (value: unknown): { num?: number; str?: string } => {
  if (value === null || value === undefined) return {};
  const str = String(value);
  const n = Number(value);
  return {
    str,
    num: Number.isFinite(n) ? n : undefined
  };
};

// Save pending order copy to Firestore
const savePendingOrderCopy = async (
  leaderOrderId: number,
  followerId: number,
  followerOrderId: number,
  followerPlatform?: string,
  followerContractId?: number
) => {
  try {
    if (!currentUser?.uid || !leaderAccount) return;

    const leaderAccountIdStr = String(leaderAccount.id);

    const mappingRef = doc(
      db, 
      'users', 
      currentUser.uid, 
      'pendingOrderMappings', 
      `${leaderAccount.id}_${leaderOrderId}_${followerId}`
    );
    
    const docData: any = {
      leaderOrderId,
      leaderOrderIdStr: String(leaderOrderId),
      leaderAccountId: leaderAccount.id,
      leaderAccountIdStr,
      followerOrderId,
      followerId,
      followerPlatform: followerPlatform || null,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    if (followerContractId != null) docData.followerContractId = followerContractId;

    await setDoc(mappingRef, docData, { merge: true });

    // ✅ Cache locally for immediate cancel/modify lookups (no Firestore read needed).
    addPendingOrderMappingLocal(leaderOrderId, followerId, followerOrderId, followerPlatform || null, followerContractId);

    logWithTime(`✅ Saved pending order mapping to Firestore:`, {
      leaderOrderId,
      followerOrderId,
      followerId
    });
  } catch (error) {
    errorWithTime('❌ Error saving pending order mapping to Firestore:', error);
  }
};

// Check if this pending order was already copied to a follower
const checkOrderAlreadyCopied = async (leaderOrderId: number, followerId: number): Promise<boolean> => {
  try {
    if (!currentUser?.uid || !leaderAccount) return false;

    // ✅ FAST PATH: In-memory check first (no Firestore latency)
    if (wasPendingCopiedLocal(leaderAccount.id, leaderOrderId, followerId)) {
      return true;
    }

    const leaderAccountIdStr = String(leaderAccount.id);
    const norm = normalizeIdForFirestore(leaderOrderId);
    const leaderOrderIdNum = norm.num;
    const leaderOrderIdStr = norm.str;

    if (leaderOrderIdNum === undefined && !leaderOrderIdStr) {
      return false;
    }

    // If followerId is -1, check if ANY mapping exists for this order
    if (followerId === -1) {
      const colRef = collection(db, 'users', currentUser.uid, 'pendingOrderMappings');

      // Try numeric fields first (most common), then string fields (handles type mismatches)
      if (leaderOrderIdNum !== undefined) {
        const qNum = query(
          colRef,
          where('leaderOrderId', '==', leaderOrderIdNum),
          where('leaderAccountId', '==', leaderAccount.id)
        );
        const snapNum = await getDocs(qNum);
        if (snapNum.size > 0) {
          // cache locally for the rest of this session
          pendingOrderCopiedAnyLocalRef.current.add(getPendingLocalKey(leaderAccount.id, leaderOrderIdNum));
          return true;
        }
      }

      if (leaderOrderIdStr) {
        const qStr = query(
          colRef,
          where('leaderOrderIdStr', '==', leaderOrderIdStr),
          where('leaderAccountIdStr', '==', leaderAccountIdStr)
        );
        const snapStr = await getDocs(qStr);
        if (snapStr.size > 0) {
          pendingOrderCopiedAnyLocalRef.current.add(getPendingLocalKey(leaderAccount.id, leaderOrderIdStr));
          return true;
        }
      }

      return false;
    }

    // Otherwise check specific follower mapping
    // For specific follower, we can address the doc directly (doc id uses string interpolation)
    const resolvedLeaderOrderIdForDocId = leaderOrderIdStr ?? String(leaderOrderIdNum ?? leaderOrderId);
    const mappingRef = doc(
      db,
      'users',
      currentUser.uid,
      'pendingOrderMappings',
      `${leaderAccount.id}_${resolvedLeaderOrderIdForDocId}_${followerId}`
    );
    
    const mappingSnap = await getDoc(mappingRef);
    if (mappingSnap.exists()) {
      // Cache locally for the rest of this session
      markPendingCopiedLocal(leaderAccount.id, resolvedLeaderOrderIdForDocId, followerId);
      return true;
    }
    return false;
  } catch (error) {
    errorWithTime('❌ Error checking order mapping in Firestore:', error);
    return false;
  }
};

// Mark a pending order mapping as filled (when the fill is received)
const markOrderAsMatched = async (leaderOrderId: number) => {
  try {
    if (!currentUser?.uid || !leaderAccount) return;

    const leaderAccountIdStr = String(leaderAccount.id);
    const norm = normalizeIdForFirestore(leaderOrderId);
    const leaderOrderIdNum = norm.num;
    const leaderOrderIdStr = norm.str;

    if (leaderOrderIdNum === undefined && !leaderOrderIdStr) return;

    // Find all mappings for this leader order
    const colRef = collection(db, 'users', currentUser.uid, 'pendingOrderMappings');
    let querySnap: any = null;

    if (leaderOrderIdNum !== undefined) {
      const qNum = query(
        colRef,
        where('leaderOrderId', '==', leaderOrderIdNum),
        where('leaderAccountId', '==', leaderAccount.id)
      );
      querySnap = await getDocs(qNum);
    }

    if ((!querySnap || querySnap.docs.length === 0) && leaderOrderIdStr) {
      const qStr = query(
        colRef,
        where('leaderOrderIdStr', '==', leaderOrderIdStr),
        where('leaderAccountIdStr', '==', leaderAccountIdStr)
      );
      querySnap = await getDocs(qStr);
    }
    
    // Update all matched orders
    const updates = querySnap.docs.map((docSnap: any) => 
      setDoc(docSnap.ref, { status: 'matched', matchedAt: new Date().toISOString() }, { merge: true })
    );
    
    await Promise.all(updates);

    logWithTime(`✅ Marked pending order as matched in Firestore:`, {
      leaderOrderId: leaderOrderIdNum ?? leaderOrderIdStr,
      matchedMappings: querySnap.docs.length
    });
  } catch (error) {
    errorWithTime('❌ Error marking order as matched in Firestore:', error);
  }
};

// ✅ NEW: Delete pending order mapping when order is filled or cancelled
const deletePendingOrderMapping = async (leaderOrderId: number) => {
  try {
    if (!currentUser?.uid || !leaderAccount) return;

    const leaderAccountIdStr = String(leaderAccount.id);
    const norm = normalizeIdForFirestore(leaderOrderId);
    const leaderOrderIdNum = norm.num;
    const leaderOrderIdStr = norm.str;

    if (leaderOrderIdNum === undefined && !leaderOrderIdStr) return;

    // Find all mappings for this leader order
    const colRef = collection(db, 'users', currentUser.uid, 'pendingOrderMappings');

    let querySnap: any = null;
    if (leaderOrderIdNum !== undefined) {
      const qNum = query(
        colRef,
        where('leaderOrderId', '==', leaderOrderIdNum),
        where('leaderAccountId', '==', leaderAccount.id)
      );
      querySnap = await getDocs(qNum);
    }

    if ((!querySnap || querySnap.docs.length === 0) && leaderOrderIdStr) {
      const qStr = query(
        colRef,
        where('leaderOrderIdStr', '==', leaderOrderIdStr),
        where('leaderAccountIdStr', '==', leaderAccountIdStr)
      );
      querySnap = await getDocs(qStr);
    }
    
    if (querySnap.docs.length === 0) {
      logWithTime(`ℹ️ No pending order mappings found to delete for order ${leaderOrderIdNum ?? leaderOrderIdStr}`);
      return;
    }

    // Delete all mappings for this order
    const deletes = querySnap.docs.map((docSnap: any) => deleteDoc(docSnap.ref));
    
    await Promise.all(deletes);

    // IMPORTANT:
    // Do NOT clear the local "already-copied" cache here.
    // Tradovate often emits the order terminal status (Filled) before (or in the same tick as)
    // the corresponding fill event is processed. If we clear this cache now, the fill handler
    // can no longer detect that this was a copied pending order and will incorrectly place
    // an extra market order on followers (double execution).
    // We still delete Firestore mappings and local leader->follower orderId mappings.
    if (leaderOrderIdNum != null && Number.isFinite(Number(leaderOrderIdNum))) {
      clearPendingOrderMappingsLocal(Number(leaderOrderIdNum));
    }

    logWithTime(`🗑️ Deleted pending order mapping(s) from Firestore:`, {
      leaderOrderId: leaderOrderIdNum ?? leaderOrderIdStr,
      deletedMappings: querySnap.docs.length
    });
  } catch (error) {
    errorWithTime('❌ Error deleting order mapping in Firestore:', error);
  }
};

// ✅ NEW: Copy order modifications to followers
const copyModifyToFollowers = async (leaderOrderId: number, newPrice: number) => {
  if (!currentUser?.uid) {
    errorWithTime('❌ Cannot copy modify: No authenticated user');
    return;
  }

  const userId = currentUser.uid;

  logWithTime(`✏️ Copying order modification to followers:`, {
    leaderOrderId: leaderOrderId,
    newPrice: newPrice
  });

  try {
    // Get order details (including orderQty) from the map
    const orderDetails = orderDetailsMap.current.get(leaderOrderId);
    if (!orderDetails) {
      errorWithTime(`❌ Order details not found for leader order ${leaderOrderId}`, {
        hint: 'For TopstepX leaders, ensure order details are stored from GatewayUserOrder events (orderType/qty/price/stopPrice/timeInForce) before modify propagation.'
      });
      return;
    }

    // ✅ FAST PATH: Use local mapping cache first (no Firestore read).
    let mappings: Array<{ followerId: number; followerOrderId: number; followerPlatform?: string | null; followerContractId?: number | null }> =
      pendingOrderMappingsLocalRef.current.get(leaderOrderId) ?? [];

    if (!mappings.length) {
      // Fallback to Firestore only if we have no local mapping (e.g., page reload)
      const q = query(
        collection(db, `users/${userId}/pendingOrderMappings`),
        where('leaderOrderId', '==', leaderOrderId)
      );
      const querySnap = await getDocs(q);
      logWithTime(`🔍 Found ${querySnap.docs.length} follower orders to modify for leader order ${leaderOrderId}`);
      if (querySnap.docs.length === 0) return;
      mappings = querySnap.docs.map(d => {
        const data = d.data() as any;
        return {
          followerId: Number(data.followerId),
          followerOrderId: Number(data.followerOrderId),
          followerPlatform: (data.followerPlatform ?? null) as string | null,
          followerContractId: data.followerContractId != null ? Number(data.followerContractId) : null
        };
      });

      // Populate local cache for next time
      for (const m of mappings) {
        addPendingOrderMappingLocal(leaderOrderId, m.followerId, m.followerOrderId, m.followerPlatform ?? null, m.followerContractId ?? undefined);
      }
    } else {
      logWithTime(`⚡ Using local follower mappings for modify (count=${mappings.length})`, { leaderOrderId });
    }

    const followerModifyConcurrency = 8;
    await mapWithConcurrency(mappings, followerModifyConcurrency, async (mapping) => {
      const followerOrderId = Number((mapping as any).followerOrderId);
      const followerAccountId = Number((mapping as any).followerId);
      const mappingFollowerPlatform = (mapping as any).followerPlatform as string | null | undefined;
      const mappingFollowerContractId = (mapping as any).followerContractId as number | null | undefined;

      // ✅ Determine follower platform (do NOT guess Tradovate on lookup failure)
      const follower = followers.find(f => Number(f.id) === followerAccountId);
      const followerPlatform = (mappingFollowerPlatform || follower?.platform) as string | undefined;

      if (!followerPlatform) {
        errorWithTime('❌ Cannot modify follower order - unknown follower platform', {
          leaderOrderId,
          followerId,
          followerAccountId,
          followerOrderId,
          hint: 'This usually means follower ids are stored as strings in Firestore or the follower account is no longer in the local accounts list. Persisting followerPlatform in mappings should prevent this going forward.'
        });
        return false;
      }

      const isTopstepX = followerPlatform === 'TopstepX';
      const isVolumetrica = followerPlatform === 'Volumetrica';
      const copyApiEndpoint = isTopstepX
        ? '/api/projectxcopy'
        : isVolumetrica
          ? '/api/volumetricacopy'
          : '/api/tradovatecopy';

      // Apply follower ratio to orderQty (use ref for live updates)
      const followerRatio = followerRatiosRef.current.get(followerAccountId.toString()) || 1;
      const adjustedQty = Math.round(orderDetails.orderQty * followerRatio);

      // Build modify payload according to order type
      const modifyPayload: any = {
        orderQty: adjustedQty,
        orderType: orderDetails.orderType,
        timeInForce: orderDetails.timeInForce
      };
      // Volumetrica requires contractId and action for modify (action determines Quantity sign)
      if (isVolumetrica) {
        if (mappingFollowerContractId) modifyPayload.contractId = mappingFollowerContractId;
        // Get action (Buy/Sell) from leader order metadata
        const leaderMeta = leaderOrderMetaRef.current.get(leaderOrderId);
        if (leaderMeta?.action) modifyPayload.action = leaderMeta.action;
      }
      if (orderDetails.orderType === 'Limit') {
        modifyPayload.price = newPrice;
      } else if (orderDetails.orderType === 'Stop') {
        modifyPayload.stopPrice = newPrice;
      } else if (orderDetails.orderType === 'StopLimit') {
        // For StopLimit, treat newPrice as limit price if we only get one value; keep stopPrice from map if available
        modifyPayload.price = newPrice;
        if (orderDetails.stopPrice != null) modifyPayload.stopPrice = orderDetails.stopPrice;
      }

      logWithTime(`🔄 Modifying order on ${followerPlatform} follower ${followerAccountId} (qty=${adjustedQty}, ratio=${followerRatio})`);

      const modifyResult = await postJsonWithFirebaseAuth<any>(
        copyApiEndpoint,
        {
          action: 'modifyOrder',
          userId,
          accountId: followerAccountId,
          orderId: followerOrderId,
          modifyPayload
        },
        { purpose: `modifyOrder leaderOrderId=${leaderOrderId} followerId=${followerAccountId} followerOrderId=${followerOrderId}` }
      );

      if (modifyResult.ok) {
        logWithTime(`✅ Modified follower order ${followerOrderId} on account ${followerAccountId} to ${orderDetails.orderType === 'Stop' ? 'stopPrice' : 'price'} ${newPrice} (qty=${adjustedQty}, ratio=${followerRatio})`, { debugId: modifyResult.debugId });
        // 🔄 Update Orders card snapshot for this follower to reflect new pending price and correct qty
        upsertFollowerOrderSnapshot(
          followerAccountId,
          {
            qty: adjustedQty,
            price: newPrice,
            isPending: true,
            timestamp: new Date().toISOString()
          },
          { followerOrderId: Number(followerOrderId) }
        );
        return true;
      }

      errorWithTime(`❌ Failed to modify follower order ${followerOrderId}:`, {
        status: modifyResult.status,
        debugId: modifyResult.debugId,
        response: modifyResult.data
      });
      return false;
    });

  } catch (error) {
    errorWithTime('❌ Error copying modification to followers:', error);
  }
};

// ✅ NEW: Copy order cancellations to followers
const copyCancelToFollowers = async (leaderOrderId: number) => {
  if (!currentUser?.uid) {
    errorWithTime('❌ Cannot copy cancel: No authenticated user');
    return;
  }

  const userId = currentUser.uid;

  logWithTime(`🚫 Copying order cancellation to followers:`, {
    leaderOrderId: leaderOrderId
  });

  try {
    // ✅ FAST PATH: Use local mapping cache first (no Firestore read).
    let mappings: Array<{ followerId: number; followerOrderId: number; followerPlatform?: string | null }> =
      pendingOrderMappingsLocalRef.current.get(leaderOrderId) ?? [];

    if (!mappings.length) {
      // Fallback to Firestore only if we have no local mapping (e.g., page reload)
      const q = query(
        collection(db, `users/${userId}/pendingOrderMappings`),
        where('leaderOrderId', '==', leaderOrderId)
      );
      const querySnap = await getDocs(q);
      logWithTime(`🔍 Found ${querySnap.docs.length} follower orders to cancel for leader order ${leaderOrderId}`);
      if (querySnap.docs.length === 0) return;
      mappings = querySnap.docs.map(d => {
        const data = d.data() as any;
        return {
          followerId: Number(data.followerId),
          followerOrderId: Number(data.followerOrderId),
          followerPlatform: (data.followerPlatform ?? null) as string | null
        };
      });

      // Populate local cache for next time
      for (const m of mappings) {
        addPendingOrderMappingLocal(leaderOrderId, m.followerId, m.followerOrderId, m.followerPlatform ?? null);
      }
    } else {
      logWithTime(`⚡ Using local follower mappings for cancel (count=${mappings.length})`, { leaderOrderId });
    }

    const followerCancelConcurrency = 8;
    const cancelResults = await mapWithConcurrency(mappings, followerCancelConcurrency, async (mapping) => {
      const followerOrderId = Number((mapping as any).followerOrderId);
      const followerAccountId = Number((mapping as any).followerId);
      const mappingFollowerPlatform = (mapping as any).followerPlatform as string | null | undefined;

      // ✅ Determine follower platform (do NOT guess Tradovate on lookup failure)
      const follower = followers.find(f => Number(f.id) === followerAccountId);
      const followerPlatform = (mappingFollowerPlatform || follower?.platform) as string | undefined;

      if (!followerPlatform) {
        errorWithTime('❌ Cannot cancel follower order - unknown follower platform', {
          leaderOrderId,
          followerId,
          followerAccountId,
          followerOrderId,
          hint: 'Persisting followerPlatform in mappings should prevent this going forward.'
        });
        return false;
      }

      const isTopstepX = followerPlatform === 'TopstepX';
      const isVolumetrica = followerPlatform === 'Volumetrica';
      const copyApiEndpoint = isTopstepX
        ? '/api/projectxcopy'
        : isVolumetrica
          ? '/api/volumetricacopy'
          : '/api/tradovatecopy';

      logWithTime(`🚫 Canceling order on ${followerPlatform} follower ${followerAccountId}`);

      const cancelResult = await postJsonWithFirebaseAuth<any>(
        copyApiEndpoint,
        {
          action: 'cancelOrder',
          userId,
          accountId: followerAccountId,
          orderId: followerOrderId
        },
        { purpose: `cancelOrder leaderOrderId=${leaderOrderId} followerId=${followerAccountId} followerOrderId=${followerOrderId}` }
      );

      if (cancelResult.ok) {
        logWithTime(`✅ Canceled follower order ${followerOrderId} on account ${followerAccountId}`, { debugId: cancelResult.debugId });

        // 🗑️ Remove only the matching pending snapshot immediately (don't block UI on refetch)
        removeFollowerOrderSnapshot(followerAccountId, {
          followerOrderId: followerOrderId != null ? Number(followerOrderId) : undefined,
          leaderOrderId
        });

        // Optional: refresh in background (do not await)
        void fetchFollowerPosition(followerAccountId).catch(err =>
          errorWithTime(`Failed to fetch follower position after order cancellation:`, err)
        );

        return true;
      }

      errorWithTime(`❌ Failed to cancel follower order ${followerOrderId}:`, {
        status: cancelResult.status,
        debugId: cancelResult.debugId,
        response: cancelResult.data
      });
      return false;
    });

    const allCancelsOk = cancelResults.every(r => r.status === 'fulfilled' && r.value === true);

    if (allCancelsOk) {
      // Clear local mapping immediately; Firestore cleanup can run async.
      clearPendingOrderMappingsLocal(leaderOrderId);
      void deletePendingOrderMapping(leaderOrderId);
    } else {
      logWithTime('⚠️ Not deleting pending order mapping(s) - at least one follower cancel failed', {
        leaderOrderId
      });
    }

  } catch (error) {
    errorWithTime('❌ Error copying cancellation to followers:', error);
  }
};

// ✅ NEW: Copy pending orders to followers (with Firestore persistence)
const copyPendingOrderToFollowers = async (leaderOrder: any) => {
  logWithTime('🔍 copyPendingOrderToFollowers ENTERED with:', JSON.stringify(leaderOrder));
  if (!currentUser?.uid) {
    errorWithTime('❌ Cannot copy pending orders: No authenticated user');
    return;
  }

  const leaderOrderId: number = Number(leaderOrder?.orderId ?? leaderOrder?.id);
  if (!Number.isFinite(leaderOrderId)) {
    errorWithTime('❌ Cannot copy pending orders: invalid leaderOrder id', {
      leaderOrderIdRaw: leaderOrder?.orderId ?? leaderOrder?.id
    });
    return;
  }

  // ✅ Get complete order details including price from the stored map
  const orderDetails = orderDetailsMap.current.get(leaderOrderId);
  const price = orderDetails?.price || leaderOrder.price;
  const orderQty = orderDetails?.orderQty || leaderOrder.orderQty;

  logWithTime(`📋 Starting pending order copy - Order Details Map:`, {
    orderId: leaderOrderId,
    storedDetails: orderDetails,
    finalPrice: price,
    finalQty: orderQty,
    orderType: leaderOrder.orderType,
    contractId: leaderOrder.contractId,
    side: leaderOrder.action
  });

  // Filter followers to only include active ones
  const currentFollowers = followersRef.current || [];
  const currentActiveFollowers = activeFollowersRef.current || new Set<string>();
  logWithTime(`🔍 Checking active followers:`, {
    totalFollowers: currentFollowers.length,
    activeFollowersSet: Array.from(currentActiveFollowers),
    activeFollowersSize: currentActiveFollowers.size
  });

  const activeFollowerAccounts = currentFollowers.filter((follower: any) =>
    currentActiveFollowers.has(String(follower.id))
  );
  
  logWithTime(`🔍 Filtered active follower accounts:`, {
    count: activeFollowerAccounts.length,
    accounts: activeFollowerAccounts.map(f => ({ id: f.id, name: f.name }))
  });

  if (activeFollowerAccounts.length === 0) {
    logWithTime('⚠️ No active followers to copy pending order to - activeFollowers Set is empty or no matches');
    return;
  }

  // ✅ OPTIMIZATION: Get contract symbol ONCE before loop (not per follower)
  // Tradovate leader provides numeric contractId; TopstepX leader provides symbolId/contractId string.
  let contractSymbol: string | undefined =
    leaderOrder?.contractSymbol ??
    leaderOrder?.symbol ??
    leaderOrder?.symbolId;

  if (!contractSymbol) {
    try {
      contractSymbol = await getCachedContractSymbol(
        leaderOrder.contractId,
        currentUser?.uid || '',
        leaderOrder.accountId?.toString() || ''
      );
    } catch (error) {
      errorWithTime(`Failed to get contract symbol for contract ${leaderOrder.contractId}:`, error);
      return; // Cannot proceed without symbol
    }
  }

  const followerCopyConcurrency = 8;
  await mapWithConcurrency(activeFollowerAccounts, followerCopyConcurrency, async (follower) => {
    try {
      // ✅ FAST PATH: in-memory first, Firestore fallback inside checkOrderAlreadyCopied
      const alreadyCopied = await checkOrderAlreadyCopied(leaderOrderId, follower.id);
      
      if (alreadyCopied) {
        logWithTime(`🚫 DUPLICATE PENDING ORDER - Already copied to this follower:`, {
          orderId: leaderOrderId,
          follower: follower.name,
          followerId: follower.id
        });
        return; // Skip this follower
      }

      logWithTime(`🎯 Copying pending order to follower: ${follower.name} (Platform: ${follower.platform || 'Tradovate'})`);
      
      // ✅ CHECK: Determine platform and API endpoint
      const followerPlatform = follower.platform || 'Tradovate';
      const isTopstepX = followerPlatform === 'TopstepX';
      const isVolumetrica = followerPlatform === 'Volumetrica';
      const apiEndpoint = isTopstepX
        ? '/api/projectx'
        : isVolumetrica
          ? '/api/volumetrica'
          : '/api/tradovate';
      const copyApiEndpoint = isTopstepX
        ? '/api/projectxcopy'
        : isVolumetrica
          ? '/api/volumetricacopy'
          : '/api/tradovatecopy';
      
      // ✅ Do NOT fetch Tradovate access tokens into the browser.
      // `copyApiEndpoint` uses server-side tokens.

      // Get the follower's ratio (use ref for live updates)
      const followerRatio = followerRatiosRef.current.get(follower.id.toString()) || 1;
      const adjustedQty = Math.round(orderQty * followerRatio);

      // ✅ Tradovate followers require numeric contractId.
      // If leader is TopstepX, leaderOrder.contractId may be a string; resolve contractId by symbol.
      let resolvedTradovateContractId: number | undefined = undefined;
      let resolvedTradovateSymbol: string | undefined = undefined;
      let resolvedVolumetricaContractId: number | undefined = undefined;
      let resolvedVolumetricaSymbol: string | undefined = undefined;

      if (!isTopstepX && !isVolumetrica) {
        resolvedTradovateContractId = typeof leaderOrder.contractId === 'number' ? leaderOrder.contractId : undefined;
        logWithTime('🔍 Tradovate follower contract resolution:', { resolvedTradovateContractId, contractIdType: typeof leaderOrder.contractId, contractIdValue: leaderOrder.contractId, contractSymbol });

        // ✅ FAST PATH: check in-memory cache for previously resolved Tradovate contractId
        const cachedContract = contractSymbol ? volTradovateContractIdCache.current.get(contractSymbol) : undefined;
        if (!resolvedTradovateContractId && cachedContract) {
          resolvedTradovateContractId = cachedContract.id;
          resolvedTradovateSymbol = cachedContract.name;
          logWithTime(`⚡ Tradovate contract from cache: ${contractSymbol} → ${resolvedTradovateContractId}`);
        }

        if (!resolvedTradovateContractId) {
          try {
            const derivedFromTopstepContractId =
              typeof leaderOrder.contractId === 'string'
                ? topstepXContractRefToSymbol(leaderOrder.contractId)
                : undefined;
            const derivedTradovateName =
              typeof leaderOrder.contractId === 'string'
                ? topstepXContractRefToTradovateName(leaderOrder.contractId)
                : undefined;

            const rawSymbol = String(contractSymbol || '');
            const rootFromSymbolId = rawSymbol
              .split('.')
              .filter(Boolean)
              .slice(-1)[0] || rawSymbol;

            // Volumetrica feedSymbol normalization (e.g. '/MNQH26:XCME' → 'MNQH6', 'MNQH26')
            const volTradovateShort = volumetricaFeedSymbolToTradovateName(rawSymbol);
            const volTradovateFull = volumetricaFeedSymbolToTradovate(rawSymbol);

            const candidates = Array.from(
              new Set(
                [
                  volTradovateShort,   // e.g. 'MNQH6' (Tradovate short name)
                  volTradovateFull,    // e.g. 'MNQH26'
                  derivedTradovateName,
                  derivedFromTopstepContractId,
                  rootFromSymbolId,
                  rootFromSymbolId ? `/${rootFromSymbolId}` : undefined,
                ].filter(Boolean) as string[]
              )
            );

            let lastContractResult: any = null;
            for (const querySymbol of candidates) {
              const contractResult = await postJsonWithFirebaseAuth<any>(
                copyApiEndpoint,
                {
                  action: 'findContract',
                  userId: currentUser.uid,
                  accountId: follower.id,
                  symbol: querySymbol
                },
                { purpose: `pending order findContract (${follower.name}) symbol=${querySymbol}` }
              );
              lastContractResult = contractResult;

              if (contractResult.ok) {
                const contractData: any = contractResult.data;
                const cid = contractData?.id;
                if (typeof cid === 'number' && Number.isFinite(cid)) {
                  resolvedTradovateContractId = cid;
                  // IMPORTANT: use Tradovate contract name for payload/UI (TopstepX symbols like F.US.MNQ are not Tradovate names)
                  resolvedTradovateSymbol =
                    (typeof contractData?.name === 'string' && contractData.name) ? contractData.name : querySymbol;
                  logWithTime(`✅ Tradovate contract mapped: ${querySymbol} → ${resolvedTradovateContractId}`);
                  // Cache for future orders
                  if (contractSymbol) volTradovateContractIdCache.current.set(contractSymbol, { id: cid, name: resolvedTradovateSymbol });
                  break;
                }
              }
            }

            if (!resolvedTradovateContractId) {
              errorWithTime(`❌ Failed to map Tradovate contract for TopstepX symbol`, {
                follower: follower.name,
                followerId: follower.id,
                contractSymbol,
                topstepContractId: leaderOrder.contractId,
                tried: candidates,
                response: lastContractResult?.data ?? lastContractResult?.text
              });
              return;
            }
          } catch (error) {
            errorWithTime(`❌ Error mapping Tradovate contract for symbol ${contractSymbol}:`, error);
            return;
          }
        }
      }

      // ✅ Resolve direction for Volumetrica orders where PendingQty doesn't indicate Buy/Sell.
      // Fetch a Tradovate quote to get last trade price, then infer direction from order price vs market.
      if (!leaderOrder.action && resolvedTradovateContractId && leaderOrder.orderTypeEnum != null) {
        try {
          const quoteResult = await postJsonWithFirebaseAuth<any>(
            copyApiEndpoint,
            {
              action: 'getQuote',
              userId: currentUser.uid,
              accountId: follower.id,
              contractId: resolvedTradovateContractId
            },
            { purpose: `getQuote for direction inference contractId=${resolvedTradovateContractId}` }
          );
          const tradePrice = quoteResult?.data?.tradePrice;
          logWithTime('📊 getQuote response:', { tradePrice, debug: quoteResult?.data?.debug });
          if (tradePrice && tradePrice > 0) {
            const oPrice = leaderOrder.stopPrice || leaderOrder.price || price;
            const ote = leaderOrder.orderTypeEnum;
            if (ote === 1) { // Limit: below market = Buy, above = Sell
              leaderOrder.action = oPrice < tradePrice ? 'Buy' : 'Sell';
            } else if (ote === 2 || ote === 3) { // Stop/StopLimit: above market = Buy, below = Sell
              leaderOrder.action = oPrice > tradePrice ? 'Buy' : 'Sell';
            }
            logWithTime('🧭 Direction resolved via Tradovate quote:', { action: leaderOrder.action, orderPrice: oPrice, tradePrice, orderType: leaderOrder.orderType });
            // Cache market price for future orders
            if (leaderOrder.contractSymbol) volLastMarketPriceRef.current.set(leaderOrder.contractSymbol, tradePrice);
          } else {
            logWithTime('⚠️ Could not get trade price from Tradovate quote, defaulting to Buy');
            leaderOrder.action = 'Buy';
          }
        } catch (err) {
          errorWithTime('⚠️ Failed to fetch Tradovate quote for direction inference:', err);
          leaderOrder.action = 'Buy';
        }
      }

      // ✅ Volumetrica: combined findAndPlaceOrder (single WSS session)
      if (isVolumetrica) {
        const rawSym = String(contractSymbol || '');
        const rootFromSymbolId = volumetricaFeedSymbolToTradovate(rawSym) || rawSym.split('.').filter(Boolean).slice(-1)[0] || rawSym;

        const resolvedOrderType = orderDetails?.orderType || leaderOrder.orderType;
        const volOrderPayload: any = {
          accountSpec: follower.id.toString(),
          accountId: follower.id,
          action: leaderOrder.action,
          orderQty: adjustedQty,
          orderType: resolvedOrderType,
          timeInForce: orderDetails?.timeInForce || 'Day'
        };
        if (resolvedOrderType === 'Limit') volOrderPayload.price = price;
        if (resolvedOrderType === 'Stop') volOrderPayload.stopPrice = orderDetails?.stopPrice ?? leaderOrder.stopPrice ?? price;
        if (resolvedOrderType === 'StopLimit') {
          const sp = orderDetails?.stopPrice ?? leaderOrder.stopPrice;
          const lp = orderDetails?.price ?? leaderOrder.limitPrice ?? price;
          if (sp != null) volOrderPayload.stopPrice = sp;
          if (lp != null) volOrderPayload.price = lp;
        }

        const placeOrderResult = await postJsonWithFirebaseAuth<any>(
          copyApiEndpoint,
          {
            action: 'findAndPlaceOrder',
            userId: currentUser.uid,
            accountId: follower.id,
            symbol: rootFromSymbolId,
            orderPayload: volOrderPayload
          },
          { purpose: `volumetrica findAndPlaceOrder (${follower.name}) symbol=${rootFromSymbolId}` }
        );

        if (!placeOrderResult.ok) {
          errorWithTime(`Failed to place pending order on Volumetrica follower ${follower.name}:`, {
            status: placeOrderResult.status,
            response: placeOrderResult.data
          });
          return;
        }

        const placeOrderData: any = placeOrderResult.data;
        const followerOrderId = placeOrderData?.orderId || placeOrderData?.id;
        resolvedVolumetricaContractId = placeOrderData?.ContractId ?? placeOrderData?.id;
        resolvedVolumetricaSymbol = placeOrderData?.feedSymbol;

        if (followerOrderId === undefined || followerOrderId === null) {
          errorWithTime(`❌ Volumetrica returned no orderId for follower ${follower.name}`, { response: placeOrderResult.data });
          return;
        }

        try {
          const volContractId = typeof resolvedVolumetricaContractId === 'number' ? resolvedVolumetricaContractId : undefined;
          await savePendingOrderCopy(leaderOrderId, follower.id, followerOrderId, followerPlatform, volContractId);
        } catch (firestoreError) {
          errorWithTime(`⚠️ Failed to save Firestore mapping (continuing anyway):`, firestoreError);
        }

        markPendingCopiedLocal(leaderAccount?.id, leaderOrderId, follower.id);
        trackCopiedPendingLeaderOrder(leaderOrder?.contractId, leaderOrder?.action, leaderOrderId);

        logWithTime(`✅ Pending order placed on Volumetrica follower ${follower.name}:`, {
          followerId: follower.id,
          followerOrderId,
          leaderOrderId,
          adjustedQty,
          volContractId: resolvedVolumetricaContractId
        });

        const symbolForPayload = resolvedVolumetricaSymbol || contractSymbol;
        let snapshotPrice: number | undefined = undefined;
        if (resolvedOrderType === 'Limit') snapshotPrice = (orderDetails?.price ?? leaderOrder.limitPrice ?? price) as number | undefined;
        else if (resolvedOrderType === 'Stop') snapshotPrice = (orderDetails?.stopPrice ?? leaderOrder.stopPrice) as number | undefined;
        else if (resolvedOrderType === 'StopLimit') snapshotPrice = (orderDetails?.stopPrice ?? leaderOrder.stopPrice ?? orderDetails?.price ?? leaderOrder.limitPrice) as number | undefined;

        upsertFollowerOrderSnapshot(
          Number(follower.id),
          {
            symbol: String(symbolForPayload ?? ''),
            qty: adjustedQty,
            price: snapshotPrice,
            direction: leaderOrder.action === 'Buy' ? 'Buy' : 'Sell',
            orderTypeLabel: `${leaderOrder.action} ${resolvedOrderType}`,
            isPending: true,
            timestamp: new Date().toISOString()
          },
          { followerOrderId: Number(followerOrderId), leaderOrderId }
        );

        return; // Done for Volumetrica — skip the generic placeOrder below
      }

      // ✅ MAP CONTRACT ID for TopstepX (different format than Tradovate)
      let topstepXContractId: string | undefined;
      if (isTopstepX) {
        try {
          logWithTime(`🔍 Mapping contract for TopstepX: ${contractSymbol}`);
          const contractResult = await postJsonWithFirebaseAuth<any>(
            copyApiEndpoint,
            {
              action: 'getContract',
              userId: currentUser.uid,
              accountId: follower.id,
              symbol: contractSymbol
            },
            { purpose: `pending order getContract (${follower.name})` }
          );

          if (contractResult.ok) {
            const contractData: any = contractResult.data;
            topstepXContractId = contractData?.id;
            logWithTime(`✅ TopstepX contract mapped: ${contractSymbol} → ${topstepXContractId}`);
          } else {
            errorWithTime(`❌ Failed to map contract ${contractSymbol} for TopstepX`, {
              follower: follower.name,
              status: contractResult.status,
              debugId: contractResult.debugId,
              response: contractResult.data ?? contractResult.text
            });
            return;
          }
        } catch (error) {
          errorWithTime(`❌ Error mapping contract for TopstepX:`, error);
          return;
        }
      }

      // ✅ Build the order payload with detailed logging
      const resolvedOrderType = orderDetails?.orderType || leaderOrder.orderType;
      const symbolForPayload = isTopstepX
        ? contractSymbol
        : (resolvedTradovateSymbol || contractSymbol);
      const basePayload: any = {
        accountSpec: follower.id.toString(),
        accountId: follower.id,
        contractId: isTopstepX ? leaderOrder.contractId : resolvedTradovateContractId,
        symbol: symbolForPayload,
        action: leaderOrder.action,
        orderQty: adjustedQty,
        orderType: resolvedOrderType,
        timeInForce: orderDetails?.timeInForce || 'Day'
      };
      
      if (isTopstepX && topstepXContractId) {
        basePayload.topstepXContractId = topstepXContractId;
      }

      if (resolvedOrderType === 'Limit') {
        basePayload.price = price;
      }

      if (resolvedOrderType === 'Stop') {
        const stopPrice = orderDetails?.stopPrice ?? leaderOrder.stopPrice ?? price;
        basePayload.stopPrice = stopPrice;
      }

      if (resolvedOrderType === 'StopLimit') {
        const stopPrice = orderDetails?.stopPrice ?? leaderOrder.stopPrice;
        const limitPrice = orderDetails?.price ?? leaderOrder.limitPrice ?? price;
        if (stopPrice != null) basePayload.stopPrice = stopPrice;
        if (limitPrice != null) basePayload.price = limitPrice;
      }

      const orderPayload = basePayload;

      const requestBody = {
        action: 'placeOrder',
        userId: currentUser.uid,
        accountId: follower.id,
        orderPayload: orderPayload
      };

      logWithTime(`📤 About to send pending order request:`, {
        platform: followerPlatform,
        apiEndpoint: copyApiEndpoint,
        requestBody: requestBody,
        priceValue: price,
        priceType: typeof price,
        isNaN: isNaN(price),
        adjustedQty: adjustedQty
      });

      // ✅ Place the pending order using platform-specific API
      const placeOrderResult = await postJsonWithFirebaseAuth<any>(
        copyApiEndpoint,
        requestBody,
        { purpose: `placePendingOrder leaderOrderId=${leaderOrderId} followerId=${follower.id} platform=${followerPlatform}` }
      );

      if (!placeOrderResult.ok) {
        errorWithTime(`Failed to place pending order on follower ${follower.name}:`, {
          status: placeOrderResult.status,
          debugId: placeOrderResult.debugId,
          response: placeOrderResult.data
        });
        return;
      }

      const placeOrderData: any = placeOrderResult.data;
      const followerOrderId = placeOrderData?.orderId || placeOrderData?.id;

      // ✅ If we didn't get an order id back, treat this as a failure (prevents false “placed” logs)
      if (followerOrderId === undefined || followerOrderId === null) {
        const raw = placeOrderResult.text ??
          (typeof placeOrderResult.data === 'object' ? JSON.stringify(placeOrderResult.data) : String(placeOrderResult.data ?? ''));
        errorWithTime(`❌ Tradovate/Copy API returned no orderId for follower ${follower.name} - order NOT confirmed`, {
          status: placeOrderResult.status,
          debugId: placeOrderResult.debugId,
          response: placeOrderResult.data,
          preview: String(raw).slice(0, 300)
        });
        return;
      }

      // ✅ CRITICAL: Save this mapping to Firestore immediately (wrap in try-catch for permissions issues)
      try {
        await savePendingOrderCopy(leaderOrderId, follower.id, followerOrderId, followerPlatform);
      } catch (firestoreError) {
        errorWithTime(`⚠️ Failed to save Firestore mapping (continuing anyway):`, firestoreError);
        // Don't fail the whole operation if Firestore write fails
      }

      // ✅ Mark locally so fills won't re-copy as MARKET in this session
      markPendingCopiedLocal(leaderAccount?.id, leaderOrderId, follower.id);

      // ✅ Track this copied pending order by contract+side (handles Tradovate market-child fills).
      trackCopiedPendingLeaderOrder(leaderOrder?.contractId, leaderOrder?.action, leaderOrderId);

      logWithTime(`✅ Pending order placed on follower ${follower.name}:`, {
        followerId: follower.id,
        followerOrderId,
        leaderOrderId: leaderOrderId,
        orderType: leaderOrder.orderType,
        price: leaderOrder.stopPrice || leaderOrder.limitPrice,
        adjustedQty,
        ratio: followerRatio
      });

      // ✅ NEW: Fetch follower's orders after placing pending order
      await fetchFollowerPosition(follower.id).catch(err =>
        errorWithTime(`Failed to fetch follower position after pending order:`, err)
      );

      // ✅ Update follower latest order snapshot for Orders card (pending order)
      // Choose correct pending price per order type: Limit -> price, Stop/StopLimit -> stopPrice
      let snapshotPrice: number | undefined = undefined;
      if (resolvedOrderType === 'Limit') {
        snapshotPrice = (orderDetails?.price ?? leaderOrder.limitPrice ?? price) as number | undefined;
      } else if (resolvedOrderType === 'Stop') {
        snapshotPrice = (orderDetails?.stopPrice ?? leaderOrder.stopPrice) as number | undefined;
      } else if (resolvedOrderType === 'StopLimit') {
        snapshotPrice = (orderDetails?.stopPrice ?? leaderOrder.stopPrice ?? orderDetails?.price ?? leaderOrder.limitPrice) as number | undefined;
      }
      upsertFollowerOrderSnapshot(
        Number(follower.id),
        {
          symbol: String(symbolForPayload ?? ''),
          qty: adjustedQty,
          price: snapshotPrice,
          direction: leaderOrder.action === 'Buy' ? 'Buy' : 'Sell',
          orderTypeLabel: `${leaderOrder.action} ${resolvedOrderType}`,
          isPending: true,
          timestamp: new Date().toISOString()
        },
        {
          followerOrderId: Number(followerOrderId),
          leaderOrderId
        }
      );

    } catch (error) {
      errorWithTime(`Error copying pending order to follower ${follower.name}:`, error);
    }
  });
};

// ✅ NEW: Fetch leader's position details (Tradovate or TopstepX)
const fetchLeaderPosition = async () => {
  if (!currentUser?.uid || !leaderAccount) return;

  const leaderPlatform = leaderAccount.platform || (isLeaderTopstepX ? 'TopstepX' : 'Tradovate');
  const isTopstepX = leaderPlatform === 'TopstepX';
  const isVolumetrica = leaderPlatform === 'Volumetrica';
  const apiEndpoint = isTopstepX ? '/api/projectx' : (isVolumetrica ? '/api/volumetricapos' : '/api/tradovatepos');
  const body = isTopstepX ? {
    action: 'getPositions',
    userId: currentUser.uid,
    accountId: leaderAccount.id.toString(),
    provider: 'topstepx'
  } : {
    userId: currentUser.uid,
    accountId: leaderAccount.id
  };

  try {
    const positionsResult = await postJsonWithFirebaseAuth<any>(
      apiEndpoint,
      body,
      { purpose: `fetchLeaderPosition accountId=${leaderAccount.id} platform=${leaderPlatform}` }
    );

    if (!positionsResult.ok) {
      errorWithTime('Failed to fetch leader positions:', {
        platform: leaderPlatform,
        status: positionsResult.status,
        debugId: positionsResult.debugId,
        response: positionsResult.data
      });
      return;
    }

    const orders = (positionsResult.data as any) || [];
    const position = orders[0];

    // TopstepX: { id, accountId, contractId, type, size, averagePrice }
    //   - type: 1=Long, 2=Short
    //   - size: absolute quantity
    // Tradovate: { netPos, contractId, netPrice }
    //   - netPos: signed quantity (positive=long, negative=short)
    let normalizedPosition: { netPos: number; contractId: any; netPrice: number } | null = null;

    if (position) {
      if (isTopstepX) {
        if (position.size > 0) {
          const netPos = position.type === 1 ? position.size : -position.size;
          normalizedPosition = {
            netPos,
            contractId: position.contractId,
            netPrice: position.averagePrice
          };
        }
      } else {
        if (position.netPos !== 0) {
          normalizedPosition = {
            netPos: position.netPos,
            contractId: position.contractId,
            netPrice: position.netPrice
          };
        }
      }
    }

 

    if (normalizedPosition) {
      let contractSymbol: string;
      if (isTopstepX) {
        // Prefer Tradovate-like symbols (e.g., MNQH6). Fallback to raw symbol extraction.
        contractSymbol = topstepXContractRefToTradovateName(normalizedPosition.contractId);
        if (!contractSymbol) {
          contractSymbol = topstepXContractRefToSymbol(normalizedPosition.contractId);
        }
      } else if (isVolumetrica) {
        contractSymbol = (position as any)?.feedSymbol || String(normalizedPosition.contractId);
      } else {
        contractSymbol = await getCachedContractSymbol(
          normalizedPosition.contractId as number,
          currentUser.uid,
          leaderAccount.id.toString()
        );
      }

      setLeaderPositionData({
        symbol: contractSymbol,
        netPos: normalizedPosition.netPos,
        avgEntryPrice: normalizedPosition.netPrice,
        orderStatus: 'Filled',
        orderType: 'Market'
      });

      setApiPositions(prev => {
        const newPositions = new Map(prev);
        const positionKey = `${leaderAccount.id}_${contractSymbol}`;
        newPositions.set(positionKey, {
          accountId: leaderAccount.id,
          contractSymbol,
          contractId: normalizedPosition.contractId,
          netPos: normalizedPosition.netPos,
          netPrice: normalizedPosition.netPrice,
          timestamp: new Date().toISOString()
        });
        return newPositions;
      });

      logWithTime('📊 Leader position data fetched:', {
        platform: leaderPlatform,
        symbol: contractSymbol,
        quantity: normalizedPosition.netPos,
        avgEntryPrice: normalizedPosition.netPrice,
        orderStatus: 'Filled'
      });
    } else {
      setLeaderPositionData(null);

      // ✅ Clear ALL positions for this account from apiPositions Map
      setApiPositions(prev => {
        const newPositions = new Map(prev);
        const deletedKeys: string[] = [];
        for (const [key, pos] of newPositions.entries()) {
          if (pos.accountId === leaderAccount.id) {
            deletedKeys.push(key);
            newPositions.delete(key);
          }
        }
     
        return newPositions;
      });

      logWithTime('📊 No positions found for leader');
    }
  } catch (error) {
    errorWithTime('Error fetching leader positions:', error);
  }
};

// ✅ NEW: Fetch follower's position details from Tradovate API
const fetchFollowerPosition = async (followerAccountId: number) => {
  if (!currentUser?.uid) return;
  
  try {
    // ✅ Determine platform for this follower
    const followerAccount = accounts.find(acc => acc.id === followerAccountId);
    const platform = followerAccount?.platform || 'Tradovate';
    const isTopstepX = platform === 'TopstepX';
    const isVolumetrica = platform === 'Volumetrica';

    // Volumetrica: positions are tracked locally from copy results — skip API fetch
    if (isVolumetrica) return;

    const apiEndpoint = isTopstepX ? '/api/projectx' : '/api/tradovatepos';

    const body = isTopstepX ? {
      action: 'getPositions',
      userId: currentUser.uid,
      accountId: followerAccountId.toString(),
      provider: 'topstepx'
    } : {
      userId: currentUser.uid,
      accountId: followerAccountId
    };

    const positionsResult = await postJsonWithFirebaseAuth<any>(
      apiEndpoint,
      body,
      { purpose: `fetchFollowerPosition accountId=${followerAccountId} platform=${platform}` }
    );
    
    if (positionsResult.ok) {
      const orders = (positionsResult.data as any) || [];
      
      // Get the most recent position (first in array)
      const position = orders[0];
      
      // Handle TopstepX vs Tradovate position format
      // TopstepX: { id, accountId, contractId, type, size, averagePrice }
      //   - type: 1=Long, 2=Short
      //   - size: absolute quantity
      // Tradovate: { netPos, contractId, netPrice }
      //   - netPos: signed quantity (positive=long, negative=short)
      let normalizedPosition = null;
      
      if (position) {
        if (isTopstepX) {
          // TopstepX position format
          if (position.size > 0) {
            const netPos = position.type === 1 ? position.size : -position.size;
            normalizedPosition = {
              netPos,
              contractId: position.contractId,
              netPrice: position.averagePrice
            };
          }
        } else {
          // Tradovate position format
          if (position.netPos !== 0) {
            normalizedPosition = {
              netPos: position.netPos,
              contractId: position.contractId,
              netPrice: position.netPrice
            };
          }
        }
      }
      

      
      if (normalizedPosition) {
        // Get contract symbol
        let contractSymbol: string;
        
        if (isTopstepX) {
          // TopstepX contract IDs are like "CON.F.US.MES.U25"
          // Extract symbol from contractId string
          const contractIdStr = String(normalizedPosition.contractId);
          const parts = contractIdStr.split('.');
          if (parts.length >= 4) {
            // Format: CON.F.US.MES.U25 → Extract "MES" and month "U25"
            const symbol = parts[3]; // "MES"
            const month = parts[4] || ''; // "U25"
            contractSymbol = `${symbol}${month}`; // "MESU25"
          } else {
            // Fallback: use raw contract ID
            contractSymbol = contractIdStr;
          }
 
        } else {
          // Tradovate uses numeric contract IDs - fetch symbol from API
          contractSymbol = await getCachedContractSymbol(
            normalizedPosition.contractId as number,
            currentUser.uid,
            followerAccountId.toString()
          );
        }
        
        // Get follower account name
        const followerAccount = accounts.find(acc => acc.id === followerAccountId);
        
        setFollowerPositionsData(prev => {
          const next = new Map(prev);
          next.set(followerAccountId, {
            accountId: followerAccountId,
            accountName: followerAccount?.name || 'Follower',
            platform: followerAccount?.platform || platform,
            symbol: contractSymbol,
            contractId: normalizedPosition.contractId,
            netPos: normalizedPosition.netPos, // Position quantity
            avgEntryPrice: normalizedPosition.netPrice, // Average position price
            orderStatus: 'Filled', // Positions are always filled
            orderType: 'Market' // Positions don't have order type
          });
          return next;
        });

        // ✅ UX FIX: If we previously showed a pending stop/limit in Copier Actions for this follower,
        // flip it to a filled state once we observe an actual open position from the API.
        setFollowerLatestOrders(prev => {
          const next = new Map(prev);
          const key = String(followerAccountId);
          const list = next.get(key);
          if (!list || list.length === 0) return prev;

          const positionSide: 'Buy' | 'Sell' = normalizedPosition.netPos > 0 ? 'Buy' : 'Sell';

          const updated = list.map(item => {
            if (!item.isPending) return item;
            if (item.symbol && contractSymbol && item.symbol !== contractSymbol) return item;

            const baseSide =
              (item.direction && /\b(buy|sell)\b/i.test(item.direction) ? (item.direction.match(/\b(buy|sell)\b/i)?.[0] as any) : '') ||
              (item.orderTypeLabel?.startsWith('Buy') ? 'Buy' : item.orderTypeLabel?.startsWith('Sell') ? 'Sell' : '');

            // Only auto-flip a pending snapshot to filled when it looks like an ENTRY order
            // (same side as the resulting open position). If the follower already had a position,
            // pending exit orders (opposite side) should stay pending.
            if (baseSide && baseSide !== positionSide) return item;

            const isManualCloseLabel =
              typeof item.orderTypeLabel === 'string' &&
              /(manual\s*(close|closed)|manuel\s*closed)/i.test(item.orderTypeLabel);
            const filledLabel =
              isManualCloseLabel
                ? item.orderTypeLabel
                : (item.orderTypeLabel ? `${item.orderTypeLabel} (Filled)` : (baseSide ? `${baseSide} Market (Filled)` : 'Filled'));

            return {
              ...item,
              price: isManualCloseLabel ? (item.price ?? normalizedPosition.netPrice) : (normalizedPosition.netPrice ?? item.price),
              direction: filledLabel,
              isPending: false,
              timestamp: new Date().toISOString()
            };
          });

          next.set(key, updated);
          return next;
        });
        
        // ✅ UPDATE: Store in apiPositions Map for unrealized P&L calculation (only if open)
        setApiPositions(prev => {
          const newPositions = new Map(prev);
          const positionKey = `${followerAccountId}_${contractSymbol}`;
          newPositions.set(positionKey, {
            accountId: followerAccountId,
            contractSymbol,
            contractId: normalizedPosition.contractId,
            netPos: normalizedPosition.netPos,
            netPrice: normalizedPosition.netPrice,
            timestamp: new Date().toISOString()
          });
          return newPositions;
        });
        
        logWithTime('📊 Follower position data fetched:', {
          accountId: followerAccountId,
          accountName: followerAccount?.name,
          platform,
          symbol: contractSymbol,
          quantity: normalizedPosition.netPos,
          avgEntryPrice: normalizedPosition.netPrice,
          orderStatus: 'Filled'
        });
      } else {
        // No positions found or position closed (netPos = 0) - remove from maps
        setFollowerPositionsData(prev => {
          const next = new Map(prev);
          next.delete(followerAccountId);
          return next;
        });

        // Important: do NOT mutate pending orders here.
        // Having "no open position" does not mean pending limit/stop orders were filled,
        // and we must not wipe their displayed prices.
        
        // ✅ Clear ALL positions for this account from apiPositions Map
        setApiPositions(prev => {
          const newPositions = new Map(prev);
          const deletedKeys: string[] = [];
          // Delete all entries for this account
          for (const [key, pos] of newPositions.entries()) {
            if (pos.accountId === followerAccountId) {
              deletedKeys.push(key);
              newPositions.delete(key);
            }
          }
      
          return newPositions;
        });
        
        logWithTime('📊 No positions found for follower:', followerAccountId);
      }
    } else {
      errorWithTime('Failed to fetch follower positions:', {
        accountId: followerAccountId,
        platform,
        status: positionsResult.status,
        debugId: positionsResult.debugId,
        response: positionsResult.data
      });
    }
  } catch (error) {
    errorWithTime('Error fetching follower position:', error);
  }
};

// ✅ NEW: Manual scan button handler for Live Positions card
const handleScanPositions = async () => {
  if (isScanningPositions) return;
  if (!currentUser?.uid) return;

  setIsScanningPositions(true);
  try {
    logWithTime('🔎 Scan clicked - fetching positions for leader + followers');

    if (leaderAccount) {
      await fetchLeaderPosition();
    }

    const accountsToScan = leaderAccount
      ? accounts.filter(acc => acc.id !== leaderAccount.id)
      : accounts;

    await Promise.allSettled(accountsToScan.map(acc => fetchFollowerPosition(acc.id)));
  } catch (error) {
    errorWithTime('❌ Manual scan failed:', error);
  } finally {
    setIsScanningPositions(false);
  }
};

const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

const extractNumericPrice = (value: any): number | undefined => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : undefined;
  return Number.isFinite(n as number) ? (n as number) : undefined;
};

const tryResolveManualCloseFillPrice = async (opts: {
  platform: string;
  accountId: number;
  orderId?: number;
  contractId?: number | string;
  closeAction: 'Buy' | 'Sell';
  startedAtMs: number;
}): Promise<number | undefined> => {
  if (!currentUser?.uid) return undefined;

  if (opts.platform === 'Volumetrica') return undefined;

  // Tradovate: fetch fills and filter by orderId.
  if (opts.platform !== 'TopstepX') {
    const orderId = opts.orderId;
    if (!Number.isFinite(orderId)) return undefined;

    const delays = [0, 500, 1500, 3000];
    for (const delayMs of delays) {
      if (delayMs) await sleep(delayMs);

      const fillsResult = await postJsonWithFirebaseAuth<any>(
        '/api/tradovatecopy',
        {
          action: 'getFillsForOrder',
          userId: currentUser.uid,
          accountId: String(opts.accountId),
          orderId
        },
        { purpose: `manualClose getFillsForOrder accountId=${opts.accountId} orderId=${orderId}` }
      );

      if (!fillsResult.ok) continue;
      const data: any = fillsResult.data;
      const avgPrice = extractNumericPrice(data?.avgPrice);
      if (avgPrice !== undefined) return avgPrice;

      const lastPrice = extractNumericPrice(data?.lastPrice);
      if (lastPrice !== undefined) return lastPrice;

      const fills = Array.isArray(data?.fills) ? data.fills : [];
      const maybePrice = extractNumericPrice(fills?.[fills.length - 1]?.price);
      if (maybePrice !== undefined) return maybePrice;
    }
    return undefined;
  }

  // TopstepX: fetch recent trades and match by contractId + side.
  const contractIdStr = opts.contractId != null ? String(opts.contractId) : '';
  if (!contractIdStr) return undefined;

  const delays = [0, 1000, 2500];
  for (const delayMs of delays) {
    if (delayMs) await sleep(delayMs);

    const windowStart = opts.startedAtMs - 60_000;
    const windowEnd = Date.now() + 60_000;
    const tradesResult = await postJsonWithFirebaseAuth<any>(
      '/api/projectx',
      {
        action: 'fetchTrades',
        userId: currentUser.uid,
        accountId: String(opts.accountId),
        startTimestamp: windowStart,
        endTimestamp: windowEnd,
        provider: 'TopstepX'
      },
      { purpose: `manualClose fetchTrades accountId=${opts.accountId}` }
    );

    if (!tradesResult.ok) continue;
    const trades: any[] = Array.isArray((tradesResult.data as any)?.trades) ? (tradesResult.data as any).trades : [];

    // Pick the closest matching execution after startedAtMs.
    // Note: TopstepX trades saved in Firestore may encode side as the *entry* side, so we do NOT filter by side here.
    const matches = trades
      .filter(t => String(t?.contractId ?? '') === contractIdStr)
      .map(t => ({ t, ts: extractNumericPrice(t?.creationTimestamp) }))
      .filter(x => x.ts != null && (x.ts as number) >= opts.startedAtMs);

    matches.sort((a, b) => (a.ts as number) - (b.ts as number));
    const best = matches[0]?.t;
    const exitPrice = extractNumericPrice(best?.exitPrice);
    if (exitPrice !== undefined) return exitPrice;
    const entryPrice = extractNumericPrice(best?.entryPrice);
    if (entryPrice !== undefined) return entryPrice;
  }

  return undefined;
};

// ✅ Manual close for a specific follower position, then deactivate that follower (role OFF)
const deactivateFollowerAfterManualClose = async (accountId: number) => {
  const followerIdStr = String(accountId);
  setActiveFollowers(prev => {
    const next = new Set(prev);
    next.delete(followerIdStr);
    return next;
  });

  try {
    await setDoc(doc(db, 'finances', followerIdStr), { isActive: false }, { merge: true });
    const acc = accounts.find(a => a.id === accountId);
    logWithTime(`✅ Deactivated follower after manual close: ${acc?.name || followerIdStr}`);
  } catch (err) {
    errorWithTime('Error saving follower slider state after manual close:', err);
  }
};

const handleCloseFollowerPositionManually = async (accountId: number) => {
  if (!currentUser?.uid) return;
  if (manualCloseInFlight.has(accountId)) return;

  const pos = followerPositionsData.get(accountId);
  const acc = accounts.find(a => a.id === accountId);
  if (!pos || !acc) return;

  const netPos = Number(pos.netPos ?? 0);
  if (!Number.isFinite(netPos) || netPos === 0) return;

  setManualCloseInFlight(prev => new Set(prev).add(accountId));
  try {
    const startedAtMs = Date.now();
    const platform = acc.platform || 'Tradovate';
    const isTopstepX = platform === 'TopstepX';
    const isVolumetrica = platform === 'Volumetrica';
    const copyApiEndpoint = isTopstepX
      ? '/api/projectxcopy'
      : isVolumetrica
        ? '/api/volumetricacopy'
        : '/api/tradovatecopy';

    const symbol = String(pos.symbol || '').trim();
    if (!symbol) {
      throw new Error('Missing symbol for position');
    }

    const closeAction: 'Buy' | 'Sell' = netPos > 0 ? 'Sell' : 'Buy';
    const closeQty = Math.abs(netPos);

    let resolvedContractId: number | string | undefined = pos.contractId;

    logWithTime('🧯 Manual close requested:', {
      accountId,
      accountName: acc.name,
      platform,
      symbol,
      netPos,
      closeAction,
      closeQty
    });

    let placeOrderResult: any;

    // Volumetrica: use combined findAndPlaceOrder (single WSS session)
    if (isVolumetrica) {
      placeOrderResult = await postJsonWithFirebaseAuth<any>(
        copyApiEndpoint,
        {
          action: 'findAndPlaceOrder',
          userId: currentUser.uid,
          accountId: String(accountId),
          symbol,
          orderPayload: {
            accountSpec: String(accountId),
            accountId: accountId,
            action: closeAction,
            orderQty: closeQty,
            orderType: 'Market',
            timeInForce: 'IOC',
            isAutomated: true,
            source: 'manual_close'
          }
        },
        { purpose: `manualClose findAndPlaceOrder (${acc.name})` }
      );
    } else {
      // Resolve contract id if needed
      if (isTopstepX) {
        const contractResult = await postJsonWithFirebaseAuth<any>(
          copyApiEndpoint,
          { action: 'getContract', userId: currentUser.uid, accountId: String(accountId), symbol },
          { purpose: `manualClose getContract (${acc.name})` }
        );
        if (!contractResult.ok) {
          throw new Error(`TopstepX contract mapping failed (${contractResult.status})`);
        }
        resolvedContractId = (contractResult.data as any)?.id;
        if (!resolvedContractId) throw new Error('TopstepX contractId missing');
      } else {
        if (typeof resolvedContractId !== 'number') {
          const contractResult = await postJsonWithFirebaseAuth<any>(
            copyApiEndpoint,
            { action: 'findContract', userId: currentUser.uid, accountId: String(accountId), symbol },
            { purpose: `manualClose findContract (${acc.name})` }
          );
          if (!contractResult.ok) {
            throw new Error(`Tradovate contract mapping failed (${contractResult.status})`);
          }
          resolvedContractId = (contractResult.data as any)?.id;
        }
        if (typeof resolvedContractId !== 'number') throw new Error('Tradovate contractId missing');
      }

      const orderPayload: any = {
        accountSpec: String(accountId),
        accountId: accountId,
        action: closeAction,
        symbol,
        contractId: resolvedContractId,
        ...(isTopstepX ? { topstepXContractId: resolvedContractId } : {}),
        orderQty: closeQty,
        orderType: 'Market',
        timeInForce: 'IOC',
        isAutomated: true,
        source: 'manual_close'
      };

      placeOrderResult = await postJsonWithFirebaseAuth<any>(
        copyApiEndpoint,
        {
          action: 'placeOrder',
          userId: currentUser.uid,
          accountId: String(accountId),
          orderPayload
        },
        { purpose: `manualClose placeOrder (${acc.name})` }
      );
    }

    if (!placeOrderResult.ok) {
      throw new Error(`Manual close failed (${placeOrderResult.status})`);
    }

    const placedOrderId = (() => {
      const raw = (placeOrderResult.data as any)?.orderId ?? (placeOrderResult.data as any)?.id;
      const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : undefined;
      return Number.isFinite(n as number) ? (n as number) : undefined;
    })();

    // ✅ UX: update Copier Actions snapshot for this follower immediately.
    // Mark as pending so `fetchFollowerPosition` can flip it to "(Filled)" once the API reflects the close.
    upsertFollowerOrderSnapshot(
      accountId,
      {
        symbol,
        qty: closeQty,
        price: undefined,
        direction: 'Manual Closed',
        orderTypeLabel: 'Manual Closed',
        isPending: true,
        timestamp: new Date().toISOString()
      },
      { followerOrderId: placedOrderId }
    );

    // Best-effort: resolve the actual close fill price.
    // Note: placeOrder does not reliably return fill price; we query fills/trades shortly after.
    void (async () => {
      try {
        if (!placedOrderId) return;
        const fillPrice = await tryResolveManualCloseFillPrice({
          platform,
          accountId,
          orderId: placedOrderId,
          contractId: resolvedContractId,
          closeAction,
          startedAtMs
        });
        if (fillPrice === undefined) return;

        upsertFollowerOrderSnapshot(
          accountId,
          {
            symbol,
            qty: closeQty,
            price: fillPrice,
            timestamp: new Date().toISOString()
          },
          { followerOrderId: placedOrderId }
        );
      } catch {
        // Silent: fill price is best-effort only.
      }
    })();

    // Refresh this follower position (immediate + delayed for eventual consistency)
    if (platform === 'Volumetrica') {
      // Volumetrica: clear position locally
      setFollowerPositionsData(prev => {
        const next = new Map(prev);
        next.delete(accountId);
        return next;
      });
    } else {
      await fetchFollowerPosition(accountId);
      scheduleFollowerPositionRefetch(accountId, acc.name, 1000, 'manual_close');
      scheduleFollowerPositionRefetch(accountId, acc.name, 2000, 'manual_close');
    }

    // Deactivate follower role so leader stops sending signals to that account
    await deactivateFollowerAfterManualClose(accountId);
  } catch (err) {
    errorWithTime('❌ Manual close failed:', err);
  } finally {
    setManualCloseInFlight(prev => {
      const next = new Set(prev);
      next.delete(accountId);
      return next;
    });
  }
};

// Add this function after errorWithTime
const copyTradeToFollowers = async (leaderFill: any) => {
  // Check if we have currentUser
  if (!currentUser?.uid) {
    errorWithTime('❌ Cannot copy trades: No authenticated user');
    return;
  }

  const leaderOrderNorm = normalizeIdForFirestore(leaderFill?.orderId);
  const leaderOrderIdNum = leaderOrderNorm.num;
  const leaderOrderIdStr = leaderOrderNorm.str;

  // ✅ FAST PATH: In-memory first, Firestore fallback only if unknown
  const localKey = getPendingLocalKey(leaderAccount?.id, leaderOrderIdNum ?? leaderOrderIdStr);
  const alreadyCopiedAsPendingLocal = pendingOrderCopiedAnyLocalRef.current.has(localKey);

  // ✅ CRITICAL: Check if this fill corresponds to a pending order we already copied
  const alreadyCopiedAsPending = alreadyCopiedAsPendingLocal
    ? true
    : await checkOrderAlreadyCopied(leaderFill.orderId, -1); // -1 means any follower

  const locallyTriggeredPendingCopy =
    leaderOrderIdNum !== undefined && pendingOrderCopyTriggeredRef.current.has(leaderOrderIdNum);
  
  if (alreadyCopiedAsPending || locallyTriggeredPendingCopy) {
    logWithTime(`✅ FILL FOR COPIED PENDING ORDER - Skipping duplicate copy:`, {
      orderId: leaderFill.orderId,
      symbol: leaderFill.contractSymbol,
      action: leaderFill.action,
      qty: leaderFill.qty,
      localPendingTrigger: locallyTriggeredPendingCopy,
      reason: 'This fill corresponds to a pending order already copied to followers'
    });
    
    // Mark this order as matched in Firestore
    try {
      await markOrderAsMatched(leaderFill.orderId);
    } catch {}

    // Ensure local cache is primed even if Firestore is slow/unavailable
    pendingOrderCopiedAnyLocalRef.current.add(localKey);
    
    // Still update positions and stats, but don't copy the fill
    setFills(prev => [leaderFill, ...prev].slice(0, 50));
    await updatePositions(leaderFill);

    // ✅ Volumetrica: update Live Positions card even though we skipped the copy
    // (the pending order was already placed, but the UI needs to reflect the fill)
    const currentFollowersPending = followersRef.current || [];
    const currentActiveFollowersPending = activeFollowersRef.current || new Set<string>();
    const activeVolFollowers = currentFollowersPending.filter((f: any) =>
      currentActiveFollowersPending.has(String(f.id)) && (f.platform === 'Volumetrica')
    );
    for (const follower of activeVolFollowers) {
      const followerRatio = followerRatiosRef.current.get(follower.id.toString()) || 1;
      const adjustedQty = Math.round(leaderFill.qty * followerRatio);
      const fillDelta = leaderFill.action === 'Buy' ? adjustedQty : -adjustedQty;
      const volFollowerId = Number(follower.id);
      setFollowerPositionsData((prev: any) => {
        const next = new Map(prev);
        const existing = next.get(volFollowerId);
        const prevNetPos = existing?.netPos ?? 0;
        const newNetPos = prevNetPos + fillDelta;
        logWithTime('🔍 VOL POS DEBUG (pending fill path)', {
          volFollowerId, existingFound: !!existing, prevNetPos, fillDelta, newNetPos,
          action: leaderFill.action, adjustedQty
        });
        if (newNetPos === 0) {
          next.delete(volFollowerId);
        } else {
          next.set(volFollowerId, {
            accountId: volFollowerId,
            accountName: follower.name || 'Follower',
            platform: 'Volumetrica',
            symbol: leaderFill.contractSymbol,
            netPos: newNetPos,
            avgEntryPrice: leaderFill.price,
            orderStatus: 'Filled',
            orderType: 'Market'
          });
        }
        return next;
      });
    }

    return;
  }

  // ✅ INFO: Log predicted net position (but do NOT skip — positionsRef can be stale when fills arrive rapidly)
  const existingLeaderPosition = Array.from(positionsRef.current.values()).find(pos =>
    pos.accountId === leaderAccount?.id &&
    pos.contractSymbol === leaderFill.contractSymbol &&
    pos.tradeSession === (leaderFill.tradeSession !== undefined ? leaderFill.tradeSession : currentSessionRef.current) &&
    pos.status === 'open'
  );

  if (existingLeaderPosition) {
    let predictedNetPos = existingLeaderPosition.netPosition;
    if (leaderFill.action === 'Buy') predictedNetPos += leaderFill.qty;
    else if (leaderFill.action === 'Sell') predictedNetPos -= leaderFill.qty;
    logWithTime('ℹ️ Closing-order check (info only):', {
      orderId: leaderFill.orderId,
      symbol: leaderFill.contractSymbol,
      action: leaderFill.action,
      qty: leaderFill.qty,
      currentNetPos: existingLeaderPosition.netPosition,
      predictedNetPos
    });
  }

  // ✅ DUPLICATE PREVENTION: Create unique identifier for this trade
  const tradeId = `${leaderFill.accountId}_${leaderFill.orderId}_${leaderFill.contractId}_${leaderFill.qty}_${leaderFill.action}`;
  
  // Check if we've already processed this exact trade
  if (processedOrdersRef.current.has(tradeId)) {
    logWithTime(`🚫 DUPLICATE DETECTED - Skipping trade copy for order ${leaderFill.orderId}:`, {
      tradeId,
      orderId: leaderFill.orderId,
      symbol: leaderFill.contractSymbol,
      action: leaderFill.action,
      qty: leaderFill.qty
    });
    return;
  }

  // Add to processed orders immediately to prevent race conditions
  processedOrdersRef.current.add(tradeId);
  setProcessedOrders(new Set(processedOrdersRef.current));
  
  logWithTime(`✅ NEW TRADE - Processing copy for order ${leaderFill.orderId}:`, {
    tradeId,
    orderId: leaderFill.orderId,
    symbol: leaderFill.contractSymbol,
    action: leaderFill.action,
    qty: leaderFill.qty
  });
  
  // Filter followers to only include active ones
  const currentFollowers = followersRef.current || [];
  const currentActiveFollowers = activeFollowersRef.current || new Set<string>();
  const activeFollowerAccounts = currentFollowers.filter((follower: any) =>
    currentActiveFollowers.has(String(follower.id))
  );
  
  // 🔍 DEBUG: Log active followers status
  logWithTime('🔍 [Copy Check] Active followers status:', {
    totalFollowers: currentFollowers.length,
    activeFollowersSetSize: currentActiveFollowers.size,
    activeFollowerIds: Array.from(currentActiveFollowers),
    matchedAccounts: activeFollowerAccounts.length
  });
  
  if (activeFollowerAccounts.length === 0) {
    errorWithTime('❌ [Copy Failed] No active followers to copy trade to - activeFollowers Set may be empty or no matches');
    return;
  }

  logWithTime(`📋 Copying ${leaderFill.contractSymbol} trade to ${activeFollowerAccounts.length} active followers`);

  const followerCopyConcurrency = 8;
  await mapWithConcurrency(activeFollowerAccounts, followerCopyConcurrency, async (follower) => {
    try {
      // ✅ CHECK: Determine platform and API endpoint
      const followerPlatform = follower.platform || 'Tradovate';
      const isTopstepX = followerPlatform === 'TopstepX';
      const isVolumetrica = followerPlatform === 'Volumetrica';
      const apiEndpoint = isTopstepX
        ? '/api/projectx'
        : isVolumetrica
          ? '/api/volumetrica'
          : '/api/tradovate';
      const copyApiEndpoint = isTopstepX
        ? '/api/projectxcopy'
        : isVolumetrica
          ? '/api/volumetricacopy'
          : '/api/tradovatecopy';
      
      logWithTime(`🎯 Copying trade to follower: ${follower.name} (Platform: ${followerPlatform})`);
      
      // ✅ Do NOT fetch Tradovate access tokens into the browser.
      // Order placement happens via server-side endpoints using Firestore-stored tokens.

      // Prepare order payload for follower account
      const followerRatio = followerRatiosRef.current.get(follower.id.toString()) || 1;
      const adjustedQty = Math.round(leaderFill.qty * followerRatio); // Round to whole contracts

      // ✅ Tradovate followers require numeric contractId.
      // If leader is TopstepX or Volumetrica, leaderFill.contractId is NOT a Tradovate ID; resolve by symbol.
      let resolvedTradovateContractId: number | undefined = undefined;
      let resolvedVolumetricaContractId: number | undefined = undefined;
      let resolvedVolumetricaSymbol: string | undefined = undefined;
      if (!isTopstepX && !isVolumetrica) {
        // Only trust leaderFill.contractId as Tradovate ID when leader IS Tradovate (not Volumetrica/TopstepX)
        resolvedTradovateContractId = (!isLeaderVolumetrica && !isLeaderTopstepX && typeof leaderFill.contractId === 'number') ? leaderFill.contractId : undefined;

        // ✅ FAST PATH: check in-memory cache for previously resolved Tradovate contractId
        const fillSymbol = String(leaderFill.contractSymbol || '');
        const cachedContract = fillSymbol ? volTradovateContractIdCache.current.get(fillSymbol) : undefined;
        if (!resolvedTradovateContractId && cachedContract) {
          resolvedTradovateContractId = cachedContract.id;
          logWithTime(`⚡ Tradovate contract from cache: ${fillSymbol} → ${resolvedTradovateContractId}`);
        }

        if (!resolvedTradovateContractId) {
          try {
            const derivedFromTopstepContractId =
              typeof leaderFill.contractId === 'string'
                ? topstepXContractRefToSymbol(leaderFill.contractId)
                : undefined;
            const derivedTradovateName =
              typeof leaderFill.contractId === 'string'
                ? topstepXContractRefToTradovateName(leaderFill.contractId)
                : undefined;

            const rawSymbol = String(leaderFill.contractSymbol || '');
            const rootFromSymbolId = rawSymbol
              .split('.')
              .filter(Boolean)
              .slice(-1)[0] || rawSymbol;

            // Volumetrica feedSymbol normalization (e.g. '/MNQH26:XCME' → 'MNQH6', 'MNQH26')
            const volTradovateShort = volumetricaFeedSymbolToTradovateName(rawSymbol);
            const volTradovateFull = volumetricaFeedSymbolToTradovate(rawSymbol);

            const candidates = Array.from(
              new Set(
                [
                  volTradovateShort,   // e.g. 'MNQH6' (Tradovate short name)
                  volTradovateFull,    // e.g. 'MNQH26'
                  derivedTradovateName,
                  derivedFromTopstepContractId,
                  rootFromSymbolId,
                  rootFromSymbolId ? `/${rootFromSymbolId}` : undefined,
                ].filter(Boolean) as string[]
              )
            );

            let lastContractResult: any = null;
            for (const querySymbol of candidates) {
              const contractResult = await postJsonWithFirebaseAuth<any>(
                copyApiEndpoint,
                {
                  action: 'findContract',
                  userId: currentUser.uid,
                  accountId: follower.id,
                  symbol: querySymbol
                },
                { purpose: `copy trade findContract (${follower.name}) symbol=${querySymbol}` }
              );
              lastContractResult = contractResult;

              if (contractResult.ok) {
                const contractData: any = contractResult.data;
                const cid = contractData?.id;
                if (typeof cid === 'number' && Number.isFinite(cid)) {
                  resolvedTradovateContractId = cid;
                  const resolvedName = (typeof contractData?.name === 'string' && contractData.name) ? contractData.name : querySymbol;
                  logWithTime(`✅ Tradovate contract mapped: ${querySymbol} → ${resolvedTradovateContractId}`);
                  // Cache for future orders
                  if (fillSymbol) volTradovateContractIdCache.current.set(fillSymbol, { id: cid, name: resolvedName });
                  break;
                }
              }
            }

            if (!resolvedTradovateContractId) {
              errorWithTime(`❌ Failed to map Tradovate contract for TopstepX symbol`, {
                follower: follower.name,
                followerId: follower.id,
                contractSymbol: leaderFill.contractSymbol,
                topstepContractId: leaderFill.contractId,
                tried: candidates,
                response: lastContractResult?.data ?? lastContractResult?.text
              });
              return;
            }
          } catch (error) {
            errorWithTime(`❌ Error mapping Tradovate contract for symbol ${leaderFill.contractSymbol}:`, error);
            return;
          }
        }
      }

      // ✅ Volumetrica: combined findAndPlaceOrder (single WSS session for speed)
      if (isVolumetrica) {
        const rawSym = String(leaderFill.contractSymbol || '');
        const rootFromSymbolId = volumetricaFeedSymbolToTradovate(rawSym) || rawSym.split('.').filter(Boolean).slice(-1)[0] || rawSym;

        const volOrderPayload: any = {
          accountSpec: follower.id.toString(),
          accountId: follower.id,
          action: leaderFill.action,
          orderQty: adjustedQty,
          orderType: 'Market',
          timeInForce: 'IOC',
          isAutomated: true,
          sourceOrderId: leaderFill.orderId,
          tradeId: tradeId
        };

        const placeResult = await postJsonWithFirebaseAuth<any>(
          copyApiEndpoint,
          {
            action: 'findAndPlaceOrder',
            userId: currentUser.uid,
            accountId: follower.id,
            symbol: rootFromSymbolId,
            orderPayload: volOrderPayload
          },
          { purpose: `volumetrica findAndPlaceOrder market (${follower.name}) symbol=${rootFromSymbolId}` }
        );

        if (placeResult.ok) {
          const orderResult: any = placeResult.data;
          const followerPlacedOrderId = (() => {
            const raw = orderResult?.orderId ?? orderResult?.id;
            const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : undefined;
            return Number.isFinite(n as number) ? (n as number) : undefined;
          })();

          logWithTime(`✅ Trade copied to Volumetrica ${follower.name}:`, {
            orderId: followerPlacedOrderId,
            symbol: orderResult?.feedSymbol || rootFromSymbolId,
            action: leaderFill.action,
            qty: adjustedQty
          });

          upsertFollowerOrderSnapshot(
            Number(follower.id),
            {
              symbol: orderResult?.feedSymbol || leaderFill.contractSymbol,
              qty: adjustedQty,
              price: leaderFill.price,
              direction: leaderFill.action === 'Buy' ? 'Buy Market' : 'Sell Market',
              orderTypeLabel: 'Market',
              isPending: false,
              timestamp: new Date().toISOString()
            },
            {
              followerOrderId: followerPlacedOrderId,
              leaderOrderId: (() => {
                const rawLeaderOrderId = (leaderFill as any)?.orderId ?? (leaderFill as any)?.id;
                const n = typeof rawLeaderOrderId === 'string' ? Number(rawLeaderOrderId) : typeof rawLeaderOrderId === 'number' ? rawLeaderOrderId : undefined;
                return Number.isFinite(n as number) ? (n as number) : undefined;
              })()
            }
          );

          // Use ref for latest positions (avoids stale React closure)
          const leaderPositionForThisContract = Array.from(positionsRef.current.values()).find(pos =>
            pos.accountId === leaderAccount?.id &&
            pos.contractSymbol === leaderFill.contractSymbol &&
            pos.tradeSession === (leaderFill.tradeSession !== undefined ? leaderFill.tradeSession : currentSessionRef.current)
          );

          if (leaderPositionForThisContract?.status !== 'closed') {
            const followerSession = leaderFill.tradeSession !== undefined
              ? leaderFill.tradeSession
              : currentSessionRef.current;
            const followerFill = {
              ...leaderFill,
              accountId: follower.id,
              qty: adjustedQty,
              type: 'follower',
              copyStatus: 'success',
              timestamp: new Date().toISOString(),
              tradeSession: followerSession
            };
            await updatePositions(followerFill);
            setFills(prev => [followerFill, ...prev].slice(0, 50));
          }

          // Volumetrica: populate Live Positions card directly from copy result (like pending orders)
          // Use ref to read latest followerPositionsData (avoids stale React closure)
          const volSymbol = orderResult?.feedSymbol || leaderFill.contractSymbol;
          const fillDelta = leaderFill.action === 'Buy' ? adjustedQty : -adjustedQty;

          const volFollowerId = Number(follower.id);
          setFollowerPositionsData((prev: any) => {
            const next = new Map(prev);
            const existing = next.get(volFollowerId);
            const prevNetPos = existing?.netPos ?? 0;
            const newNetPos = prevNetPos + fillDelta;
            logWithTime('🔍 VOL POS DEBUG', {
              volFollowerId,
              typeofId: typeof volFollowerId,
              mapKeys: Array.from(next.keys()),
              mapKeysTypes: Array.from(next.keys()).map(k => typeof k),
              existingFound: !!existing,
              existingNetPos: existing?.netPos,
              prevNetPos,
              fillDelta,
              newNetPos,
              action: leaderFill.action,
              adjustedQty
            });

            if (newNetPos === 0 || leaderPositionForThisContract?.status === 'closed') {
              next.delete(volFollowerId);
            } else {
              next.set(volFollowerId, {
                accountId: volFollowerId,
                accountName: follower.name || 'Follower',
                platform: 'Volumetrica',
                symbol: volSymbol,
                netPos: newNetPos,
                avgEntryPrice: leaderFill.price,
                orderStatus: 'Filled',
                orderType: 'Market'
              });
            }
            return next;
          });
        } else {
          errorWithTime(`❌ Volumetrica findAndPlaceOrder failed for ${follower.name}:`, {
            status: placeResult.status,
            response: placeResult.data
          });
        }
        return; // Done for Volumetrica — skip generic path below
      }

      // ✅ MAP CONTRACT ID for TopstepX (different format than Tradovate)
      let topstepXContractId: string | undefined;
      if (isTopstepX) {
        try {
          logWithTime(`🔍 Mapping contract for TopstepX: ${leaderFill.contractSymbol}`);
          const contractResult = await postJsonWithFirebaseAuth<any>(
            copyApiEndpoint,
            {
              action: 'getContract',
              userId: currentUser.uid,
              accountId: follower.id,
              symbol: leaderFill.contractSymbol
            },
            { purpose: `copy trade getContract (${follower.name})` }
          );

          if (contractResult.ok) {
            const contractData: any = contractResult.data;
            topstepXContractId = contractData?.id;
            logWithTime(`✅ TopstepX contract mapped: ${leaderFill.contractSymbol} → ${topstepXContractId}`);
          } else {
            errorWithTime(`❌ Failed to map contract ${leaderFill.contractSymbol} for TopstepX`, {
              follower: follower.name,
              status: contractResult.status,
              debugId: contractResult.debugId,
              response: contractResult.data ?? contractResult.text
            });
            return;
          }
        } catch (error) {
          errorWithTime(`❌ Error mapping contract for TopstepX:`, error);
          return;
        }
      }
      
      // ✅ FORCE MARKET ORDERS: Always use Market orders for immediate execution
      // For Volumetrica leaders: use resolved Tradovate symbol name (not Volumetrica feedSymbol like /MNQH26:XCME)
      const fillSymbolRaw = String(leaderFill.contractSymbol || '');
      const cachedContractForSymbol = fillSymbolRaw ? volTradovateContractIdCache.current.get(fillSymbolRaw) : undefined;
      const tradovateSymbolForPayload = cachedContractForSymbol?.name || volumetricaFeedSymbolToTradovateName(fillSymbolRaw) || fillSymbolRaw;
      const orderPayload: any = {
        accountSpec: follower.id.toString(),
        accountId: follower.id,
        action: leaderFill.action,
        symbol: isTopstepX ? leaderFill.contractSymbol : tradovateSymbolForPayload,
        contractId: isTopstepX ? leaderFill.contractId : resolvedTradovateContractId,
        orderQty: adjustedQty,
        orderType: 'Market',
        timeInForce: 'Day',
      };
      
      if (isTopstepX && topstepXContractId) {
        orderPayload.topstepXContractId = topstepXContractId;
      }

      logWithTime(`📤 Placing MARKET order for ${follower.name} on ${followerPlatform}:`, {
        ...orderPayload,
        note: 'Market order ensures fill even with price slippage'
      });
      
      // Debug logging for API call
      const apiRequestBody = {
        action: 'placeOrder',
        userId: currentUser.uid,
        accountId: follower.id.toString(),
        orderPayload
      };
      
      logWithTime('🔍 API request body:', {
        action: apiRequestBody.action,
        userId: apiRequestBody.userId,
        accountId: apiRequestBody.accountId,
        userUid: currentUser.uid,
        userEmail: currentUser.email,
        followerName: follower.name,
        followerId: follower.id
      });

      // ✅ Place the order using platform-specific API
      const placeOrderResult = await postJsonWithFirebaseAuth<any>(
        copyApiEndpoint,
        apiRequestBody,
        { purpose: `placeMarketOrder tradeId=${tradeId} followerId=${follower.id} platform=${followerPlatform}` }
      );

      if (placeOrderResult.ok) {
        const orderResult: any = placeOrderResult.data;
        logWithTime(`✅ Trade copied successfully to ${follower.name}:`, {
          contractSymbol: leaderFill.contractSymbol,
          contractId: leaderFill.contractId,
          action: leaderFill.action,
          qty: leaderFill.qty,
          price: leaderFill.price,
          orderId: orderResult.orderId || orderResult.id,
          followerAccount: follower.name
        });

        // ✅ Always update the follower snapshot for the Copier Actions card.
        // Even if we later decide to skip creating a follower fill (due to leader close/session timing),
        // the copier *did* place an order and the UI should reflect the newest action.
        const followerPlacedOrderId = (() => {
          const raw = orderResult?.orderId ?? orderResult?.id;
          const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : undefined;
          return Number.isFinite(n as number) ? (n as number) : undefined;
        })();

        upsertFollowerOrderSnapshot(
          Number(follower.id),
          {
            symbol: leaderFill.contractSymbol,
            qty: adjustedQty,
            price: leaderFill.price,
            direction: leaderFill.action === 'Buy' ? 'Buy Market' : 'Sell Market',
            orderTypeLabel: 'Market',
            isPending: false,
            timestamp: new Date().toISOString()
          },
          {
            followerOrderId: followerPlacedOrderId,
            leaderOrderId: (() => {
              const rawLeaderOrderId = (leaderFill as any)?.orderId ?? (leaderFill as any)?.id;
              const n = typeof rawLeaderOrderId === 'string' ? Number(rawLeaderOrderId) : typeof rawLeaderOrderId === 'number' ? rawLeaderOrderId : undefined;
              return Number.isFinite(n as number) ? (n as number) : undefined;
            })()
          }
        );

        // ✅ GUARD: Check if leader's position for this contract/session is already closed
        // If leader is closed, don't create new follower positions
        const leaderPositionForThisContract = Array.from(positions.values()).find(pos =>
          pos.accountId === leaderAccount?.id &&
          pos.contractSymbol === leaderFill.contractSymbol &&
          pos.tradeSession === (leaderFill.tradeSession !== undefined ? leaderFill.tradeSession : currentSessionRef.current)
        );
        
        if (leaderPositionForThisContract?.status === 'closed') {
          logWithTime('⏭️ Skipping follower fill creation: leader position is already closed', {
            symbol: leaderFill.contractSymbol,
            tradeSession: leaderFill.tradeSession !== undefined ? leaderFill.tradeSession : currentSessionRef.current,
            followerName: follower.name
          });
          return;
        }

        // ✅ FIX: Ensure follower always gets the correct session even if leader session is undefined
        const followerSession = leaderFill.tradeSession !== undefined 
          ? leaderFill.tradeSession 
          : currentSessionRef.current;

        const followerFill = {
          ...leaderFill,
          accountId: follower.id,
          qty: adjustedQty,
          type: 'follower',
          copyStatus: 'success',
          timestamp: new Date().toISOString(),
          tradeSession: followerSession // Always use leader's session or current session as fallback
        };

        logWithTime('📋 Follower fill created with session:', {
          followerName: follower.name,
          leaderSession: leaderFill.tradeSession,
          followerSession: followerSession,
          currentSessionRef: currentSessionRef.current,
          symbol: leaderFill.contractSymbol
        });

        // Update position tracking for follower
        await updatePositions(followerFill);

        // Update UI with successful copy
        setFills(prev => [followerFill, ...prev].slice(0, 50));

        // ✅ NEW: Fetch follower's position data including average entry price
        await fetchFollowerPosition(follower.id);

        // ✅ Tradovate FIX: Immediately after placing an order, `/api/tradovatepos` can return empty
        // even though the order already filled. Do a couple delayed polls for Tradovate followers.
        if (!isTopstepX) {
          scheduleFollowerPositionRefetch(follower.id, follower.name, 1000, 'post_copy_tradovate');
          scheduleFollowerPositionRefetch(follower.id, follower.name, 2000, 'post_copy_tradovate');
        }

        // ✅ FIX: Tradovate/TopstepX position endpoints can lag fills by a second or two.
        // If this was a closing trade, do a delayed re-fetch so the Live Positions card clears reliably.
        if (leaderPositionForThisContract?.status === 'closed' || leaderPositionForThisContract?.netPosition === 0) {
          setTimeout(() => {
            fetchFollowerPosition(follower.id).catch(err =>
              errorWithTime(`❌ Delayed follower position re-fetch failed (${follower.name}):`, err)
            );
          }, 1000);
        }
        
        // ✅ FIX: If this was a closing trade, update follower's daily P&L from Tradovate
        // Give it a small delay to ensure Tradovate has processed the position close
        if (leaderPositionForThisContract?.status === 'closed' || leaderPositionForThisContract?.netPosition === 0) {
          setTimeout(() => {
            fetchAndUpdateRealizedPnL(follower.id, followerFill);
          }, 1000); // 1 second delay to ensure Tradovate has updated
        }

        // ✅ REMOVED: Manual SL/TP orders temporarily disabled
        // await placeManualSlTpOrders(follower, leaderFill, adjustedQty);

      } else {
        const errorText =
          typeof placeOrderResult.data === 'object'
            ? JSON.stringify(placeOrderResult.data)
            : (placeOrderResult.text ?? 'Unknown error');
        errorWithTime(`❌ Failed to copy trade to ${follower.name}:`, {
          status: placeOrderResult.status,
          debugId: placeOrderResult.debugId,
          response: placeOrderResult.data ?? placeOrderResult.text
        });
        
        // Update UI with failed copy
        setFills(prev => [{
          ...leaderFill,
          type: 'copy',
          followerName: follower.name,
          copyStatus: 'failed',
          error: errorText,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 50));
      }
      
    } catch (error) {
      errorWithTime(`❌ Error copying trade to ${follower.name}:`, error);
      
      // Update UI with error
      setFills(prev => [{
        ...leaderFill,
        type: 'copy',
        followerName: follower.name,
        copyStatus: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }, ...prev].slice(0, 50));
    }
  });
};

const refreshAccountsSnapshot = async (options?: { source?: 'load' | 'start' | 'stop' | 'fill'; showLoading?: boolean }) => {
  const source = options?.source ?? 'load';
  const showLoading = options?.showLoading ?? (source === 'load');

  if (!currentUser?.uid) return;
  if (accountsRefreshInFlightRef.current) return;
  accountsRefreshInFlightRef.current = true;

  try {
    if (showLoading) setLoading(true);

    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();

    // Filter to only show accounts (with platform field), exclude expenses/payouts
    const accountsOnly = (data.finances || []).filter((f: any) => f.platform);
    setAccounts(accountsOnly);

    // ✅ Extract realizedPnL from accounts and populate dailyPnL Map (merge)
    setDailyPnL(prev => {
      const newMap = new Map(prev);
      (data.finances || []).forEach((acc: any) => {
        if (acc.realizedPnL !== undefined && acc.realizedPnL !== null) {
          newMap.set(acc.id, acc.realizedPnL);
          newMap.set(acc.id.toString(), acc.realizedPnL);
        }
      });
      return newMap;
    });

    // Set leader/followers + saved follower active state/ratios
    const leader = (data.finances || []).find((acc: any) => acc.leader);
    setLeaderId(leader ? leader.id : null);
    const followers = (data.finances || []).filter((acc: any) => acc.follower).map((acc: any) => acc.id);
    setFollowerIds(followers);

    const activeFollowerIds = (data.finances || [])
      .filter((acc: any) => acc.follower)
      .filter((acc: any) => acc.isActive !== false)
      .map((acc: any) => acc.id.toString());
    setActiveFollowers(new Set(activeFollowerIds));

    const loadedRatios = new Map();
    (data.finances || []).filter((acc: any) => acc.follower).forEach((acc: any) => {
      loadedRatios.set(acc.id.toString(), acc.ratio || 1);
    });
    setFollowerRatios(loadedRatios);

    // ✅ TopstepX balances refresh (non-blocking)
    const topstepXAccounts = accountsOnly.filter((acc: any) => (acc.platform || '') === 'TopstepX');
    if (topstepXAccounts.length > 0) {
      logWithTime(`🔄 Refreshing TopstepX balances (${source})`, { count: topstepXAccounts.length });
      (async () => {
        try {
          const jwt = await currentUser.getIdToken();
          const balancesRes = await fetch('/api/projectx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify({
              action: 'syncAccounts',
              provider: 'TopstepX',
              userId: currentUser.uid,
            })
          });

          if (!balancesRes.ok) {
            const errorText = await balancesRes.text();
            errorWithTime(`❌ Failed to refresh TopstepX balances (${source}):`, {
              status: balancesRes.status,
              response: errorText
            });
            return;
          }

          // Re-fetch finances so UI gets the updated balances
          const refreshed = await fetch(`/api/firestore-get-finances?userId=${currentUser.uid}`, {
            headers: {
              'Authorization': `Bearer ${jwt}`
            }
          });
          const refreshedData = await refreshed.json();
          const refreshedAccountsOnly = (refreshedData.finances || []).filter((f: any) => f.platform);
          setAccounts(refreshedAccountsOnly);
          logWithTime(`✅ TopstepX balances refreshed (${source})`);

          // ✅ TopstepX trades refresh (non-blocking, same logic as AutoSync)
          try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            const allNewTrades: any[] = [];

            for (const acc of topstepXAccounts) {
              try {
                logWithTime(`[TopstepX] Syncing trade history (${source})`, { accountId: acc.id });

                const tradesRes = await fetch('/api/projectx', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt}`
                  },
                  body: JSON.stringify({
                    action: 'fetchTrades',
                    userId: currentUser.uid,
                    accountId: acc.id,
                    startTimestamp: startDate.toISOString(),
                    endTimestamp: endDate.toISOString(),
                    provider: 'TopstepX'
                  })
                });

                if (tradesRes.ok) {
                  const tradesData = await tradesRes.json();
                  if (Array.isArray(tradesData?.trades) && tradesData.trades.length > 0) {
                    allNewTrades.push(...tradesData.trades);
                  }
                  logWithTime(`[TopstepX] Trades sync complete (${source})`, {
                    accountId: acc.id,
                    saved: tradesData?.saved ?? 0,
                    returned: Array.isArray(tradesData?.trades) ? tradesData.trades.length : 0
                  });
                } else {
                  const errorText = await tradesRes.text();
                  errorWithTime(`[TopstepX] Failed to sync trades (${source})`, {
                    accountId: acc.id,
                    status: tradesRes.status,
                    response: errorText
                  });
                }
              } catch (e) {
                errorWithTime(`[TopstepX] Error syncing trades (${source})`, { accountId: acc.id, error: e });
              }
            }

            if (allNewTrades.length > 0) {
              try {
                logWithTime(`[TopstepX] Adding new trades to UI (${source})`, { count: allNewTrades.length });
                await useTradeStore.getState().addTrades(allNewTrades);
              } catch (e) {
                errorWithTime(`[TopstepX] Failed to add trades to store (${source})`, e);
              }
            }
          } catch (e) {
            errorWithTime(`[TopstepX] Trades refresh failed (${source})`, e);
          }
        } catch (e) {
          errorWithTime(`❌ Error refreshing TopstepX balances (${source}):`, e);
        }
      })();
    }

    // ✅ Volumetrica trades refresh (non-blocking, same logic as TopstepX)
    const volumetricaAccounts = accountsOnly.filter((acc: any) => (acc.platform || '') === 'Volumetrica');
    if (volumetricaAccounts.length > 0) {
      (async () => {
        try {
          const jwt = await currentUser.getIdToken();
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);

          const allNewTrades: any[] = [];

          for (const acc of volumetricaAccounts) {
            try {
              const tradesRes = await fetch('/api/volumetrica', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${jwt}`
                },
                body: JSON.stringify({
                  action: 'fetchTrades',
                  userId: currentUser.uid,
                  accountId: acc.id,
                  startDt: startDate.toISOString(),
                  endDt: endDate.toISOString(),
                })
              });

              if (tradesRes.ok) {
                const tradesData = await tradesRes.json();
                if (Array.isArray(tradesData?.trades) && tradesData.trades.length > 0) {
                  allNewTrades.push(...tradesData.trades);
                }
              }
            } catch (e) {
              errorWithTime(`[Volumetrica] Error syncing trades (${source})`, { accountId: acc.id, error: e });
            }
          }

          if (allNewTrades.length > 0) {
            try {
              await useTradeStore.getState().addTrades(allNewTrades);
            } catch (e) {
              errorWithTime(`[Volumetrica] Failed to add trades to store (${source})`, e);
            }
          }
        } catch (e) {
          errorWithTime(`[Volumetrica] Trades refresh failed (${source})`, e);
        }
      })();
    }

    // ✅ Tradovate realizedPnL refresh (non-blocking)
    logWithTime(`🔄 Fetching fresh Day Realized P&L from Tradovate (${source})`);
    const pnlPromises = accountsOnly
      .filter((acc: any) => (acc.platform || 'Tradovate') === 'Tradovate')
      .map(async (acc: any) => {
        try {
          const accountResult = await postJsonWithFirebaseAuth<any>(
            '/api/tradovate',
            {
              action: 'account',
              userId: currentUser.uid,
              accountId: acc.id
            },
            { purpose: `refreshAccountsSnapshot(${source}) realizedPnL accountId=${acc.id}` }
          );

          if (accountResult.ok) {
            const responseData: any = accountResult.data;
            const accountData = responseData?.accounts?.[0] || {};

            const actualRealizedPnL = Number(
              accountData?.realizedPnL ??
                accountData?.cashBalances?.[0]?.realizedPnL ??
                0
            ) || 0;

            const extractedBalanceCandidate =
              accountData?.balance ??
              accountData?.totalCashValue ??
              accountData?.cashBalance ??
              accountData?.cashBalances?.[0]?.totalCashValue ??
              accountData?.cashBalances?.[0]?.cashBalance;
            const actualBalance =
              extractedBalanceCandidate === null || extractedBalanceCandidate === undefined
                ? null
                : (Number(extractedBalanceCandidate) || null);

            setDailyPnL(prev => {
              const newMap = new Map(prev);
              newMap.set(acc.id, actualRealizedPnL);
              newMap.set(acc.id.toString(), actualRealizedPnL);
              return newMap;
            });

            // ✅ Also update cash balance in the UI immediately (otherwise it stays stale until re-fetch)
            if (actualBalance !== null) {
              setAccounts(prev =>
                (prev || []).map((a: any) =>
                  a?.id === acc.id
                    ? {
                        ...a,
                        balance: actualBalance,
                      }
                    : a
                )
              );
            }

            await setDoc(
              doc(db, 'finances', String(acc.id)),
              {
                realizedPnL: actualRealizedPnL,
                ...(actualBalance !== null ? { balance: actualBalance } : {})
              },
              { merge: true }
            );
          }
        } catch (error) {
          // Keep whatever value was loaded from Firestore
          errorWithTime(`❌ Failed to fetch Tradovate P&L (${source}) for account:`, acc?.name ?? acc?.id, error);
        }
      });

    Promise.allSettled(pnlPromises).then(() => {
      logWithTime(`✅ Finished loading Day Realized P&L for all Tradovate accounts (${source})`);
    });
  } finally {
    accountsRefreshInFlightRef.current = false;
    if (showLoading) setLoading(false);
  }
};

// ✅ NEW: Also refresh balances/P&L after leader fills (with 1s delay)
// This reuses the same refresh flow as load/start/stop.
const queueAccountsRefreshAfterLeaderFill = (reason: string, delayMs = 1000) => {
  if (!currentUser?.uid) return;
  if (!leaderAccount) return;
  if (!isCopying) return;

  if (accountsRefreshAfterLeaderFillTimerRef.current != null) {
    window.clearTimeout(accountsRefreshAfterLeaderFillTimerRef.current);
  }

  accountsRefreshAfterLeaderFillTimerRef.current = window.setTimeout(() => {
    accountsRefreshAfterLeaderFillTimerRef.current = null;
    logWithTime('⏱️ Refreshing balances/P&L after leader fill (delayed)', { reason });
    void refreshAccountsSnapshot({ source: 'fill', showLoading: false });
  }, delayMs);
};

useEffect(() => {
  return () => {
    if (accountsRefreshAfterLeaderFillTimerRef.current != null) {
      window.clearTimeout(accountsRefreshAfterLeaderFillTimerRef.current);
      accountsRefreshAfterLeaderFillTimerRef.current = null;
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  void refreshAccountsSnapshot({ source: 'load', showLoading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentUser?.uid]);

// Fetch user's subscription data to determine account limits
useEffect(() => {
  async function fetchSubscriptionData() {
    if (currentUser?.uid) {
      try {
        // Fetch subscription data from Firestore the same way as ProtectedRouteForFeatures
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/firestore-all-subscription?userId=${currentUser.uid}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const parsed = await readJsonOrText(response);
        if (!parsed.isJson) {
          throw new Error(`Non-JSON response from /api/firestore-all-subscription (status ${response.status}) preview: ${parsed.text.slice(0, 200)}`);
        }
        const result: any = parsed.data;
        
        if (result.subscription) {
          // Use the subscription data directly from Firestore
          const subscription = result.subscription;
          const isActive = subscription.hasSubscription && 
                          subscription.subscriptionStatus === 'complete' && 
                          subscription.paymentStatus === 'paid';
          
          setUserSubscription({
            active: isActive,
            subscriptionType: subscription.subscriptionType || null
          });

          logWithTime('✅ User subscription loaded from Firestore:', {
            active: isActive,
            subscriptionType: subscription.subscriptionType,
            maxAccounts: getMaxAccounts(subscription.subscriptionType)
          });
        } else {
          // No subscription found
          setUserSubscription({ active: false, subscriptionType: null });
          logWithTime('❌ No subscription found for user');
        }
      } catch (error) {
        errorWithTime('❌ Failed to fetch subscription data:', error);
        // Set default subscription state on error
        setUserSubscription({ active: false, subscriptionType: null });
      }
    }
  }
  
  fetchSubscriptionData();
}, [currentUser?.uid]);




useEffect(() => {
  if (!isCopying || !leaderAccount || isLeaderTopstepX || isLeaderVolumetrica || !accessToken || !tradovateUserId) {
    logWithTime('🧹 useEffect: Leader WebSocket NOT started or cleaning up:', {
      isCopying, 
      hasLeaderAccount: !!leaderAccount, 
      isLeaderTopstepX,
      isLeaderVolumetrica,
      hasAccessToken: !!accessToken, 
      hasTradovateUserId: !!tradovateUserId
    });
    return;
  }

  // ✅ FIX: Prevent rapid reconnections - add delay if WebSocket was recently closed
  const connectionDelay = wsRef.current ? 0 : 1000; // 1 second delay for reconnections
  
  const connectTimeout = setTimeout(() => {
    // Double-check conditions are still valid after delay
    if (!isCopying || !leaderAccount || !accessToken || !tradovateUserId) {
      logWithTime('🚫 Connection cancelled - conditions changed during delay');
      return;
    }

    // ✅ FIX: Prevent overlapping connections
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      logWithTime('🚫 Skipping connection - WebSocket already exists and active');
      return;
    }

    logWithTime('Initializing WebSocket for leader account:', leaderAccount.id);

    let syncRequestId = 2;
    let syncRequestSent = false;
    let syncDataProcessed = false;
    const ws = new WebSocket('wss://demo.tradovateapi.com/v1/websocket');
    wsRef.current = ws;

  ws.onopen = () => {
    logWithTime('WebSocket opened, sending authorize...');
    lastWsOpenAtRef.current = Date.now();
    setConnectionStatus('connecting');
  };

ws.onmessage = async (event) => { // ← Add 'async' here
  const message = event.data;
  lastWsMessageAtRef.current = Date.now();
  logWithTime('WebSocket message received:', message);

  if (message === 'o') {
    logWithTime('Received open frame, sending authorize...');
    ws.send(`authorize\n1\n\n${accessToken}`);
    return;
  }
  if (message === 'h') {
    lastHeartbeatAtRef.current = Date.now();
    logWithTime('Received heartbeat, responding... WebSocket ID:', wsRef.current === ws ? 'CURRENT' : 'OLD');
    // ✅ FIX: Only respond if this is the current WebSocket instance
    if (wsRef.current === ws) {
      ws.send('[]');
    } else {
      logWithTime('⚠️ Heartbeat from old WebSocket instance - not responding');
    }
    return;
  }
  if (typeof message === 'string' && message.startsWith('a[')) {
    try {
      const payloads = JSON.parse(message.slice(1));
      logWithTime('Parsed payloads:', payloads);

      // ✅ PASS 1: Process orderVersion events FIRST to populate the price map before order processing
      for (const payload of payloads) {
        if (payload.d?.entityType === 'orderVersion' && payload.d?.eventType === 'Created') {
          const versionData = payload.d.entity;
          if (versionData.orderId) {
            // Check if we already have this order stored and if price or stopPrice changed
            const existingDetails = orderDetailsMap.current.get(versionData.orderId);
            const priceChanged = existingDetails && existingDetails.price !== versionData.price;
            const stopPriceChanged = existingDetails && existingDetails.stopPrice !== versionData.stopPrice;
            const qtyChanged =
              existingDetails &&
              typeof existingDetails.orderQty === 'number' &&
              typeof versionData.orderQty === 'number' &&
              existingDetails.orderQty !== versionData.orderQty;
            
            // Store order details including price for later use
            const detailsToStore = {
              orderId: versionData.orderId,
              orderQty: versionData.orderQty,
              orderType: versionData.orderType,
              // Limit price (for Limit or StopLimit)
              price: versionData.price,
              // Stop price (for Stop or StopLimit)
              stopPrice: versionData.stopPrice,
              timeInForce: versionData.timeInForce
            };
            orderDetailsMap.current.set(versionData.orderId, detailsToStore);
            
            if (priceChanged) {
              logWithTime('✏️ Order version price CHANGED:', {
                orderId: versionData.orderId,
                oldPrice: existingDetails?.price,
                newPrice: versionData.price,
                orderType: versionData.orderType
              });
              // Trigger modify copy for this order
              copyModifyToFollowers(versionData.orderId, versionData.price);
              // ✅ UI: If leader has an active pending order, prefer showing the order (not the last fill)
              setLatestLeaderFill(null);
              // 🔄 Update leader pending snapshot price immediately (create if missing)
              addOrUpdateLeaderOrder({
                orderId: versionData.orderId,
                qty: (versionData.orderQty ?? 0) as number,
                price: versionData.price,
                timestamp: new Date().toISOString()
              });
            } else if (stopPriceChanged) {
              logWithTime('✏️ Order version stopPrice CHANGED:', {
                orderId: versionData.orderId,
                oldStopPrice: existingDetails?.stopPrice,
                newStopPrice: versionData.stopPrice,
                orderType: versionData.orderType
              });
              // Trigger modify copy for this order using stopPrice
              copyModifyToFollowers(versionData.orderId, versionData.stopPrice);
              // ✅ UI: If leader has an active pending order, prefer showing the order (not the last fill)
              setLatestLeaderFill(null);
              // 🔄 Update leader pending snapshot price immediately (stop/stoplimit) (create if missing)
              addOrUpdateLeaderOrder({
                orderId: versionData.orderId,
                qty: (versionData.orderQty ?? 0) as number,
                price: versionData.stopPrice,
                timestamp: new Date().toISOString()
              });
            } else if (qtyChanged) {
              const effectivePrice =
                versionData.orderType === 'Stop'
                  ? (versionData.stopPrice ?? existingDetails?.stopPrice)
                  : (versionData.price ?? existingDetails?.price ?? existingDetails?.stopPrice);

              logWithTime('✏️ Order version qty CHANGED:', {
                orderId: versionData.orderId,
                oldQty: existingDetails?.orderQty,
                newQty: versionData.orderQty,
                orderType: versionData.orderType,
                effectivePrice
              });

              if (effectivePrice != null) {
                // Trigger modify copy for this order using the existing price; modifyPayload carries updated orderQty
                copyModifyToFollowers(versionData.orderId, effectivePrice);
              } else {
                errorWithTime('❌ Cannot propagate qty change - missing effectivePrice for modify', {
                  orderId: versionData.orderId,
                  orderType: versionData.orderType,
                  versionPrice: versionData.price,
                  versionStopPrice: versionData.stopPrice,
                  existingPrice: existingDetails?.price,
                  existingStopPrice: existingDetails?.stopPrice
                });
              }

              // ✅ UI: If leader has an active pending order, prefer showing the order (not the last fill)
              setLatestLeaderFill(null);

              // 🔄 Update leader pending snapshot qty immediately (keep existing price)
              addOrUpdateLeaderOrder({
                orderId: versionData.orderId,
                qty: (versionData.orderQty ?? 0) as number,
                price: effectivePrice as any,
                timestamp: new Date().toISOString()
              });
            } else {
              logWithTime('📌 Stored order version details:', {
                orderId: versionData.orderId,
                orderType: versionData.orderType,
                price: versionData.price,
                stopPrice: versionData.stopPrice,
                priceType: typeof versionData.price,
                qty: versionData.orderQty,
                timeInForce: versionData.timeInForce,
                storedObject: detailsToStore
              });
              
              // ✅ FIX: Trigger pending order copy if order already exists (race condition fix)
              // This handles when orderVersion arrives AFTER order Created event
              if (versionData.orderType && versionData.orderType !== 'Market' && !pendingOrderCopyTriggeredRef.current.has(versionData.orderId)) {
                // Use ref-tracked leader order meta instead of React state (state can lag by a render)
                const leaderMeta = leaderOrderMetaRef.current.get(versionData.orderId);
                const belongsToLeader = !!leaderAccount && leaderMeta?.accountId === leaderAccount.id;
                
                // 🔍 DEBUG: Log race condition check
                logWithTime('🔍 [orderVersion Trigger Check]:', {
                  orderId: versionData.orderId,
                  orderType: versionData.orderType,
                  hasLeaderAccount: !!leaderAccount,
                  hasLeaderMeta: !!leaderMeta,
                  belongsToLeader,
                  notAlreadyTriggered: !pendingOrderCopyTriggeredRef.current.has(versionData.orderId)
                });
                
                if (belongsToLeader) {
                  pendingOrderCopyTriggeredRef.current.add(versionData.orderId);
                  logWithTime('🔄 [Race Fix] orderVersion arrived separately - triggering copy:', {
                    orderId: versionData.orderId,
                    orderType: versionData.orderType,
                    leaderHasMeta: true
                  });
                  
                  // Create minimal order object for copy function
                  const orderForCopy = {
                    id: versionData.orderId,
                    orderId: versionData.orderId,
                    accountId: leaderMeta?.accountId ?? leaderAccount.id,
                    contractId: leaderMeta?.contractId,
                    action: leaderMeta?.action,
                    orderType: versionData.orderType,
                    orderQty: versionData.orderQty,
                    price: versionData.price,
                    stopPrice: versionData.stopPrice,
                    timeInForce: versionData.timeInForce
                  };
                  
                  copyPendingOrderToFollowers(orderForCopy);
                }
              }
            }
          }
        }
      }

      // ✅ PASS 2: Process order events (price map is now populated)
      for (const payload of payloads) {
        if (payload.d?.entityType === 'order' && (payload.d?.eventType === 'Created' || payload.d?.eventType === 'Updated')) {
          const orderData = payload.d.entity;
          logWithTime('📋 Order event received:', orderData);

          // ✅ Track orderId to accountId mapping for all orders
          if (orderData.id && orderData.accountId) {
            orderIdToAccountId.current.set(orderData.id, orderData.accountId);
            
            // ✅ NEW: Only track session for newly CREATED orders, not updates
            if (payload.d?.eventType === 'Created') {
              // ✅ FIX: Use ref instead of state to get immediate session value
              const sessionToAssign = currentSessionRef.current;
              orderIdToSession.current.set(orderData.id, sessionToAssign);
              logWithTime('📋 NEW Order created - tracking session:', {
                orderId: orderData.id,
                accountId: orderData.accountId,
                session: sessionToAssign,
                currentSessionState: currentTradeSession,
                currentSessionRef: currentSessionRef.current,
                eventType: payload.d.eventType
              });
            } else {
              logWithTime('📋 Order updated - keeping existing session:', {
                orderId: orderData.id,
                accountId: orderData.accountId,
                existingSession: orderIdToSession.current.get(orderData.id),
                eventType: payload.d.eventType
              });
            }
          }

          // Only track orders for our leader account
          if (orderData.accountId === leaderAccount.id) {
            // ✅ Keep an immediate ref copy of leader order metadata so orderVersion can trigger later
            if (orderData.id) {
              leaderOrderMetaRef.current.set(orderData.id, {
                accountId: orderData.accountId,
                contractId: orderData.contractId,
                action: orderData.action,
                ordStatus: orderData.ordStatus
              });
            }

            // Update accounts with order information
            setAccounts(prev => prev.map(acc => {
              if (acc.id === orderData.accountId) {
                const existingOrders = acc.activeOrders || [];
                
                // Remove existing order with same ID if updating
                const filteredOrders = existingOrders.filter((order: any) => order.id !== orderData.id);
                
                // Add the new/updated order if it's still active
                // Note: Tradovate uses 'ordStatus' field, possible values: PendingNew, Working, Filled, Cancelled, etc.
                if (orderData.ordStatus === 'Working' || orderData.ordStatus === 'Pending' || orderData.ordStatus === 'PendingNew') {
                  // ✅ UI: Only clear last fill for non-market pending orders.
                  // Market orders can emit a brief Working/Pending update *after* the fill and would otherwise wipe the fill snapshot.
                  const versionDetails = orderDetailsMap.current.get(orderData.id);
                  const resolvedTypeLower = String(versionDetails?.orderType ?? orderData.orderType ?? '').toLowerCase();
                  const isMarketOrder = resolvedTypeLower === 'market' || resolvedTypeLower.length === 0;
                  if (!isMarketOrder) {
                    setLatestLeaderFill(null);
                  }

                  filteredOrders.push({
                    id: orderData.id,
                    orderType: orderData.orderType, // 'Stop' or 'Limit'
                    price: orderData.stopPrice || orderData.limitPrice,
                    side: orderData.action, // 'Buy' or 'Sell'
                    contractId: orderData.contractId,
                    qty: orderData.orderQty
                  });
                  
                  logWithTime('✅ Leader order added/updated in real-time:', {
                    orderId: orderData.id,
                    orderType: orderData.orderType,
                    price: orderData.stopPrice || orderData.limitPrice,
                    side: orderData.action,
                    status: orderData.ordStatus,
                    totalActiveOrders: filteredOrders.length
                  });

                  // 🔄 Update leader pending snapshot for Orders card (kept until filled/canceled)
                  try {
                    const resolvedType = (versionDetails?.orderType || orderData.orderType) as 'Limit' | 'Stop' | 'StopLimit' | string;

                    // ✅ Market orders should not render as "Pending"; they are represented via fill events.
                    if (String(resolvedType).toLowerCase() !== 'market') {
                      const displayType = resolvedType === 'StopLimit'
                        ? 'Stop Limit'
                        : resolvedType === 'StopMarket'
                          ? 'Stop'
                          : resolvedType;
                      let pendingPrice: number | undefined = undefined;
                      if (resolvedType === 'Limit') pendingPrice = (versionDetails?.price ?? orderData.limitPrice) as number | undefined;
                      else if (resolvedType === 'Stop') pendingPrice = (versionDetails?.stopPrice ?? orderData.stopPrice) as number | undefined;
                      else if (resolvedType === 'StopLimit') pendingPrice = (versionDetails?.stopPrice ?? orderData.stopPrice ?? versionDetails?.price ?? orderData.limitPrice) as number | undefined;

                      // Cache leader pending label (used later to label triggered fills).
                      // Keyed by contractId + side to avoid async symbol lookups.
                      if (orderData.contractId && orderData.action && resolvedType && resolvedType !== 'Market') {
                        const key = `${orderData.contractId}_${orderData.action}`;
                        leaderPendingOrderLabelByContractSideRef.current.set(key, {
                          label: `${orderData.action} ${displayType}`,
                          updatedAtMs: Date.now(),
                          leaderOrderId: Number(orderData.id)
                        });
                      }

                      // Resolve contract symbol for leader snapshot asynchronously without await inside sync context
                      getCachedContractSymbol(orderData.contractId, currentUser?.uid || '', leaderAccount.id.toString())
                        .then(sym => {
                          setLatestLeaderOrder(prev => ({
                            symbol: sym || prev?.symbol || '',
                            qty: (versionDetails?.orderQty ?? orderData.orderQty ?? prev?.qty ?? 0) as number,
                            price: pendingPrice,
                            label: `${orderData.action} ${displayType}`,
                            action: orderData.action,
                            orderId: orderData.id,
                            timestamp: new Date().toISOString()
                          }));

                          addOrUpdateLeaderOrder({
                            orderId: orderData.id,
                            symbol: sym || '',
                            qty: (versionDetails?.orderQty ?? orderData.orderQty ?? 0) as number,
                            price: pendingPrice,
                            label: `${orderData.action} ${displayType}`,
                            action: orderData.action,
                            status: orderData.ordStatus,
                            timestamp: new Date().toISOString()
                          });
                        })
                        .catch(() => {
                          setLatestLeaderOrder(prev => ({
                            symbol: prev?.symbol || '',
                            qty: (versionDetails?.orderQty ?? orderData.orderQty ?? prev?.qty ?? 0) as number,
                            price: pendingPrice,
                            label: `${orderData.action} ${displayType}`,
                            action: orderData.action,
                            orderId: orderData.id,
                            timestamp: new Date().toISOString()
                          }));

                          addOrUpdateLeaderOrder({
                            orderId: orderData.id,
                            symbol: '',
                            qty: (versionDetails?.orderQty ?? orderData.orderQty ?? 0) as number,
                            price: pendingPrice,
                            label: `${orderData.action} ${displayType}`,
                            action: orderData.action,
                            status: orderData.ordStatus,
                            timestamp: new Date().toISOString()
                          });
                        });
                    }
                  } catch {}

                  // ✅ NEW: Copy pending order to followers (Created) using version details map
                  // Some order events don't carry price/type; read from orderVersion (PASS 1)
                  if (payload.d?.eventType === 'Created') {
                    const versionDetails = orderDetailsMap.current.get(orderData.id);
                    const versionType = versionDetails?.orderType;
                    
                    // 🔍 DEBUG: Log all conditions
                    logWithTime('🔍 [Order Created Trigger Check]:', {
                      orderId: orderData.id,
                      hasVersionDetails: !!versionDetails,
                      versionType: versionType,
                      isNotMarket: versionType !== 'Market',
                      notAlreadyTriggered: !pendingOrderCopyTriggeredRef.current.has(orderData.id),
                      allConditionsMet: versionType && versionType !== 'Market' && !pendingOrderCopyTriggeredRef.current.has(orderData.id)
                    });
                    
                    if (versionType && versionType !== 'Market' && !pendingOrderCopyTriggeredRef.current.has(orderData.id)) {
                      // ✅ Mark as triggered to prevent duplicate if orderVersion arrives separately
                      pendingOrderCopyTriggeredRef.current.add(orderData.id);
                      
                      // 🔍 DEBUG: Check idle time and state health
                      const now = Date.now();
                      const idleTimeSeconds = Math.floor((now - lastCopyAttemptRef.current) / 1000);
                      lastCopyAttemptRef.current = now;
                      
                      logWithTime('🚀 Triggering pending order copy for new order (via Order Created):', {
                        orderId: orderData.id,
                        orderType: versionType,
                        status: orderData.ordStatus,
                        price: versionDetails?.price,
                        qty: versionDetails?.orderQty,
                        tif: versionDetails?.timeInForce,
                        idleSeconds: idleTimeSeconds,
                        activeFollowersSize: activeFollowers.size,
                        followersArrayLength: followers.length
                      });
                      // Call async function without awaiting to avoid blocking
                      copyPendingOrderToFollowers(orderData);
                    } else if (versionType === 'Market') {
                      logWithTime('ℹ️ Skipping pending copy for MARKET order — will copy via fills');
                    } else if (pendingOrderCopyTriggeredRef.current.has(orderData.id)) {
                      logWithTime('⏭️ Skipping duplicate trigger - already queued for copy:', { orderId: orderData.id });
                    } else {
                      logWithTime('⚠️ [DEBUG] Pending order copy NOT triggered - conditions not met:', {
                        orderId: orderData.id,
                        hasVersionDetails: !!versionDetails,
                        versionType: versionType,
                        isMarket: versionType === 'Market',
                        alreadyTriggered: pendingOrderCopyTriggeredRef.current.has(orderData.id),
                        orderDetailsMapSize: orderDetailsMap.current.size
                      });
                    }
                  }
                } else {
                  logWithTime('🗑️ Leader order removed (not active):', {
                    orderId: orderData.id,
                    orderType: orderData.orderType,
                    status: orderData.ordStatus
                  });

                  // Keep leader pending label cache in sync.
                  // If a stop/limit was filled, store a short-lived "recently filled" label so the next market fill
                  // can be displayed as "Buy Stop (Filled)".
                  try {
                    if (orderData.contractId && orderData.action) {
                      const key = `${orderData.contractId}_${orderData.action}`;
                      const versionDetails = orderDetailsMap.current.get(orderData.id);
                      const resolvedType = (versionDetails?.orderType || orderData.orderType) as string | undefined;
                      const displayType = resolvedType === 'StopLimit'
                        ? 'Stop Limit'
                        : resolvedType === 'StopMarket'
                          ? 'Stop'
                          : resolvedType;

                      // Remove any live pending cache for this contract+side when the order is no longer active.
                      leaderPendingOrderLabelByContractSideRef.current.delete(key);

                      if (orderData.ordStatus === 'Filled' && displayType && displayType !== 'Market') {
                        leaderRecentlyFilledPendingLabelByContractSideRef.current.set(key, {
                          label: `${orderData.action} ${displayType}`,
                          filledAtMs: Date.now(),
                          leaderOrderId: Number(orderData.id)
                        });
                      }
                    }
                  } catch {}

                  // ✅ Keep ref map in sync when leader order is no longer active
                  if (orderData.id) {
                    leaderOrderMetaRef.current.delete(orderData.id);
                  }
                  
                  // ✅ NEW: Copy order cancellations to followers
                  if (orderData.ordStatus === 'Cancelled' || orderData.ordStatus === 'Canceled') {
                    logWithTime('🚫 Triggering order cancellation copy for canceled order:', {
                      orderId: orderData.id,
                      status: orderData.ordStatus
                    });

                    // 🧹 Remove only this pending order from the UI (keep other pending orders visible)
                    removeLeaderOrderById(orderData.id, { showCancelToast: true });
                    
                    // ✅ NEW: Fetch leader's orders after cancellation (should be empty now)
                    if (orderData.contractId) {
                      fetchLeaderPosition().catch(err =>
                        errorWithTime('Failed to fetch leader position after order cancellation:', err)
                      );
                    }
                    
                    // Call async function without awaiting to avoid blocking
                    copyCancelToFollowers(orderData.id);
                  }
                  
                  // ✅ Clean up session tracking for completed/cancelled orders
                  if (orderData.ordStatus === 'Filled' || orderData.ordStatus === 'Cancelled' || orderData.ordStatus === 'Canceled') {
                    orderIdToSession.current.delete(orderData.id);
                    // ✅ Clean up pending copy trigger tracking
                    pendingOrderCopyTriggeredRef.current.delete(orderData.id);

                    // ✅ Clean up pending-copy suppression tracking (contractId+side)
                    untrackCopiedPendingLeaderOrder(orderData.contractId, orderData.action, Number(orderData.id));

                    logWithTime('🗑️ Order session tracking cleaned up:', {
                      orderId: orderData.id,
                      status: orderData.ordStatus
                    });
                    // 🧹 Remove only this leader pending snapshot in UI
                    removeLeaderOrderById(orderData.id);

                    // ✅ If leader pending order FILLED, immediately resolve follower pending snapshots in UI.
                    // Followers do not stream order updates here, so otherwise their stop/limit can look stuck.
                    if (orderData.ordStatus === 'Filled') {
                      resolveFollowerPendingSnapshotsForLeaderOrder(Number(orderData.id), 'Filled');
                      queueFollowerPositionsRefresh('leader_pending_order_filled', 250);
                    }

                    // ✅ IMPORTANT: Only delete mappings immediately for FILLED.
                    // For CANCELED, mappings are deleted after follower cancels succeed (see copyCancelToFollowers).
                    if (orderData.ordStatus === 'Filled') {
                      deletePendingOrderMapping(orderData.id);
                    }
                  }
                }
                
                return {
                  ...acc,
                  activeOrders: filteredOrders
                };
              }
              return acc;
            }));
          }
        }
      }
      
      // ✅ PASS 3: Process all other events including fills
      for (const payload of payloads) {
        // Skip order and orderVersion events since we already processed them
        if (payload.d?.entityType === 'order' || payload.d?.entityType === 'orderVersion') {
          continue;
        }
        
        // Authorization success
        if ((payload.s === 200 || payload.status === 200) && payload.i === 1 && !syncRequestSent) {
          logWithTime('✅ WebSocket Authorized! Sending user/syncrequest...');
          ws.send(`user/syncrequest\n${syncRequestId}\n\n${JSON.stringify({ users: [tradovateUserId] })}`);
          
          // ✅ NEW: Subscribe to account-specific data for better PnL tracking
          logWithTime('📊 Subscribing to account positions and cash balances...');
          
          // Subscribe to position updates for the account
          ws.send(`position/deps\n${syncRequestId + 1}\n\n${JSON.stringify({ accountId: leaderAccount.id })}`);
          
          // Subscribe to cash balance updates for realized PnL
          ws.send(`cashBalance/deps\n${syncRequestId + 2}\n\n${JSON.stringify({ accountId: leaderAccount.id })}`);
          
          syncRequestSent = true;
          setConnectionStatus('connected');
          logWithTime('🚀 COPIER READY! WebSocket connected and ready to copy trades');
          continue;
        }

        // ✅ NEW: Sync response with positions and orders - pre-warm cache
        if ((payload.s === 200 || payload.status === 200) && payload.i === 2 && payload.d && !syncDataProcessed) {
          logWithTime('📥 Received sync response with positions and orders');
          const syncData = payload.d;
          
          // Pre-warm the symbol cache with all contracts the leader trades
          if (currentUser?.uid) {
            const positions = syncData.positions || [];
            const orders = syncData.orders || [];
            preWarmSymbolCache(positions, orders, currentUser.uid, leaderAccount.id.toString());
          }
          
          syncDataProcessed = true;
          continue;
        }
        
        // Account events
        if (payload.e === 'props') {
          logWithTime('📡 WebSocket event received:', {
            entityType: payload.d?.entityType,
            eventType: payload.d?.eventType,
            entity: payload.d?.entity
          });

          // ✅ Position event handling for real-time PnL updates
          if (payload.d?.entityType === 'position' && (payload.d?.eventType === 'Created' || payload.d?.eventType === 'Updated')) {
            const positionData = payload.d.entity;
            
            logWithTime('💰 Position update received:', {
              contractId: positionData.contractId,
              netPos: positionData.netPos,
              netPrice: positionData.netPrice,
              realizedPnL: positionData.realizedPnL,
              unrealizedPnL: positionData.unrealizedPnL,
              accountId: leaderAccount.id
            });

            try {
              // Get contract symbol for display
              const contractSymbol = await getCachedContractSymbol(positionData.contractId, currentUser?.uid || '', leaderAccount.id.toString());
              
              const enhancedPosition = {
                ...positionData,
                accountId: leaderAccount.id,
                contractSymbol,
                timestamp: new Date().toISOString(),
                type: 'position_update'
              };

              // Update position tracking with real-time PnL
              await updatePositions(enhancedPosition);
              
              logWithTime('✅ Position updated with real-time PnL:', {
                symbol: contractSymbol,
                netPosition: positionData.netPos,
                unrealizedPnL: positionData.unrealizedPnL,
                realizedPnL: positionData.realizedPnL
              });

              // Followers don't stream fills; re-poll their position endpoints when leader position changes.
              // Debounced to avoid spamming during frequent position updates.
              queueFollowerPositionsRefresh('leader_position_update', 500);

            } catch (error) {
              errorWithTime('Error processing position update:', error);
            }
          }

          // ✅ NEW: Enhanced fill event handling with duplicate prevention
if (payload.d?.entityType === 'fill' && payload.d?.eventType === 'Created') {
  const fillData = payload.d.entity;
  // ✅ Look up the accountId for this fill's orderId
  const accountId = orderIdToAccountId.current.get(fillData.orderId);

  if (accountId === leaderAccount.id) {
    // This fill is for the leader account, safe to copy
    const enhancedFillData = {
      ...fillData,
      accountId: leaderAccount.id
    };
  
  // ✅ DUPLICATE CHECK: Create unique identifier for this fill
  const fillId = `${enhancedFillData.accountId}_${enhancedFillData.orderId}_${enhancedFillData.contractId}_${enhancedFillData.qty}_${enhancedFillData.action}`;
  
  // Check if this fill is for the leader account (it always will be since it's the leader's WebSocket)
  if (enhancedFillData.accountId === leaderAccount.id) {
   try {
      // ✅ Look up which session this order was placed in (if we have it stored)
      const hasStoredSession = orderIdToSession.current.has(enhancedFillData.orderId);
      const orderSession = hasStoredSession ? orderIdToSession.current.get(enhancedFillData.orderId) : undefined;
      
      logWithTime('🔍 Processing fill event:', {
        orderId: enhancedFillData.orderId,
        contractId: enhancedFillData.contractId,
        action: enhancedFillData.action,
        qty: enhancedFillData.qty,
        price: enhancedFillData.price,
        orderSession: orderSession,
        currentSession: currentTradeSession,
        sessionSource: hasStoredSession ? 'stored' : 'will_be_determined_by_updatePositions'
      });

      // ✅ Get contract symbol - backend API requires this
      let contractSymbol: string | undefined;
      try {
        contractSymbol = await getCachedContractSymbol(
          enhancedFillData.contractId,
          currentUser?.uid || '',
          leaderAccount.id.toString()
        );
      } catch (err) {
        errorWithTime('⚠️ Failed to get contract symbol:', err);
        // Don't continue without symbol - backend needs it
      }

      const enhancedFill = {
        ...enhancedFillData,
        contractSymbol,
        timestamp: new Date().toISOString(),
        type: 'leader',
        eventType: 'Created',
        fillId: `${enhancedFillData.accountId}_${enhancedFillData.orderId}_${enhancedFillData.contractId}_${enhancedFillData.qty}_${enhancedFillData.action}`,
        ...(orderSession !== undefined && { tradeSession: orderSession }) // Only add tradeSession if we have it stored
      };

      // ✅ DEBUG: Log final enhanced fill before updating positions
      logWithTime('✅ [Fill Processing] Enhanced fill ready for copying:', {
        contractId: enhancedFill.contractId,
        contractSymbol: enhancedFill.contractSymbol,
        action: enhancedFill.action,
        qty: enhancedFill.qty,
        price: enhancedFill.price,
        fillId: enhancedFill.fillId
      });

      setFills(prev => [enhancedFill, ...prev].slice(0, 50));
      // ✅ A fill supersedes any pending-order snapshot in the UI.
      // Remove ONLY the filled order, keep other pending orders
      removeLeaderOrderById(Number(enhancedFillData.orderId));
      // ✅ Update latest leader fill snapshot for Orders card
      const leaderFillKey = `${enhancedFillData.contractId}_${enhancedFillData.action}`;
      const nowMs = Date.now();
      const recentPending = leaderRecentlyFilledPendingLabelByContractSideRef.current.get(leaderFillKey);
      const livePending = leaderPendingOrderLabelByContractSideRef.current.get(leaderFillKey);

      // Prefer "recently filled" pending label (stop/limit just triggered) if very recent AND it's the same order.
      // ⚠️ CRITICAL: Only use pending label if the fill's orderId matches the pending order's ID!
      // This prevents a new market order from being mistaken for a triggered stop/limit.
      let leaderDirectionLabel = enhancedFill.action === 'Buy' ? 'Buy Market' : 'Sell Market';
      if (recentPending && nowMs - recentPending.filledAtMs <= 15_000 && recentPending.leaderOrderId === enhancedFillData.orderId) {
        leaderDirectionLabel = `${recentPending.label} (Filled)`;
        leaderRecentlyFilledPendingLabelByContractSideRef.current.delete(leaderFillKey);
      } else if (livePending && livePending.leaderOrderId === enhancedFillData.orderId) {
        // Only use livePending label if THIS fill is from THAT pending order
        leaderDirectionLabel = `${livePending.label} (Filled)`;
      }

      setLatestLeaderFill({
        accountName: leaderAccount?.name,
        balance: Number(leaderAccount?.balance) || 0,
        symbol: enhancedFill.contractSymbol,
        qty: Math.abs(enhancedFill.qty || 0),
        price: enhancedFill.price,
        direction: leaderDirectionLabel,
        timestamp: enhancedFill.timestamp
      });
      
      // ✅ NEW: Fetch leader's position data including average entry price
      await fetchLeaderPosition();
      
      await updatePositions(enhancedFill);

      // ✅ NEW: Always refresh follower positions on leader fill.
      // This handles cases where follower position changes without a new placeOrder (e.g., copied SL/TP triggering).
      queueFollowerPositionsRefresh('leader_fill', 250);

      // ✅ NEW: Refresh balances / daily realized P&L (and TopstepX sync) 1s after ANY leader fill.
      // Stops/limits can close trades too; without this, balances/P&L may only refresh on Stop Copier.
      const leaderOrderDetails = orderDetailsMap.current.get(enhancedFillData.orderId);
      const leaderOrderType = String(leaderOrderDetails?.orderType ?? '').toLowerCase();
      queueAccountsRefreshAfterLeaderFill(`leader_fill_${leaderOrderType || 'unknown'}`, 1000);

      // ✅ CHECK: Skip copying if flatten operation is in progress
      if (isFlatteningRef.current) {
        logWithTime('⏸️ Skipping trade copy - flatten operation in progress');
      } else if ((followersRef.current || []).length > 0) {
        const followerCount = (followersRef.current || []).length;
        logWithTime(`🚀 [Fill Event] Leader fill detected, initiating copy to ${followerCount} followers`);

        // ✅ Prevent double execution:
        // If this fill is a triggered Stop/Limit and we already copied the originating pending order to followers,
        // then followers will fill their own pending orders; copying this fill again would add an extra market order.
        const looksLikeTriggeredPendingFill = /\b(stop|limit)\b/i.test(String(leaderDirectionLabel));
        const pendingLeaderOrderId = recentPending?.leaderOrderId ?? livePending?.leaderOrderId;

        let shouldSuppressTriggeredFillCopy = false;
        if (looksLikeTriggeredPendingFill && Number.isFinite(Number(pendingLeaderOrderId))) {
          const localPendingKey = getPendingLocalKey(leaderAccount?.id, Number(pendingLeaderOrderId));
          const pendingWasCopiedLocal = pendingOrderCopiedAnyLocalRef.current.has(localPendingKey);
          const pendingWasCopiedFirestore = pendingWasCopiedLocal
            ? true
            : await checkOrderAlreadyCopied(Number(pendingLeaderOrderId), -1);

          shouldSuppressTriggeredFillCopy = pendingWasCopiedFirestore;

          if (shouldSuppressTriggeredFillCopy) {
            logWithTime('🛑 Skipping fill copy (triggered from copied pending order)', {
              fillOrderId: enhancedFillData.orderId,
              pendingLeaderOrderId: Number(pendingLeaderOrderId),
              contractId: enhancedFillData.contractId,
              action: enhancedFillData.action,
              leaderDirectionLabel
            });
          }
        }

        if (!shouldSuppressTriggeredFillCopy) {
          // Secondary safeguard: if we tracked a copied pending order for this contract+side, suppress as well.
          const copiedPendingSet = copiedPendingLeaderOrdersByContractSideRef.current.get(leaderFillKey);
          const hasCopiedPendingForThisSide = !!copiedPendingSet && copiedPendingSet.size > 0;
          if (looksLikeTriggeredPendingFill && hasCopiedPendingForThisSide) {
            logWithTime('🛑 Skipping fill copy (triggered from copied pending order - contractSide fallback)', {
              orderId: enhancedFillData.orderId,
              contractId: enhancedFillData.contractId,
              action: enhancedFillData.action,
              leaderDirectionLabel,
              pendingLeaderOrderIds: Array.from(copiedPendingSet || [])
            });
          } else {
            // ✅ Pass the actual symbol to copy function - backend needs it
            await copyTradeToFollowers(enhancedFill);
          }
        }
      } else {
        logWithTime('No followers configured - trade not copied');
      }
    } catch (error) {
      errorWithTime('Error processing fill event:', error);
    }
  } else {
    logWithTime('Fill ignored (not from leader account):', {
      orderId: fillData.orderId,
      foundAccountId: accountId,
      leaderAccountId: leaderAccount.id
    });
  }
  continue;
}

          // (Removed verbose position/cashBalance blocks to keep loop structure simple)

          // Your existing ExecutionReport handling...
          if (payload.e === 'props' && payload.d?.entityType === 'ExecutionReport') {
            const report = payload.d.entity;
            logWithTime('ExecutionReport received:', report);

            if (payload.d.eventType === 'Fill' && report.accountId === leaderAccount.id) {
              logWithTime('✅ Fill for leader account:', report);
              setFills(prev => [...prev, report]);
            } else if (payload.d.eventType === 'Fill') {
              logWithTime('Fill received for another account (ignored):', report.accountId);
            }
            continue;
          }

          // Error response
          if (payload.s >= 400 || payload.status >= 400) {
            errorWithTime('Error response from server:', payload);
            ws.close();
            setConnectionStatus('disconnected');
            return;
          }
          }
        }
      }
    } catch (err) {
      errorWithTime('Error parsing WebSocket response:', err);
      ws.close();
      setConnectionStatus('disconnected');
    }
  }
};

  ws.onclose = (event) => {
    const now = Date.now();
    const timeSinceOpenMs = lastWsOpenAtRef.current ? (now - lastWsOpenAtRef.current) : null;
    const timeSinceMsgMs = lastWsMessageAtRef.current ? (now - lastWsMessageAtRef.current) : null;
    const timeSinceHeartbeatMs = lastHeartbeatAtRef.current ? (now - lastHeartbeatAtRef.current) : null;
    const timeSinceOfflineMs = lastOfflineAtRef.current ? (now - lastOfflineAtRef.current) : null;

    const conn = (navigator as any).connection;
    const connectionInfo = conn
      ? {
          effectiveType: conn.effectiveType,
          rtt: conn.rtt,
          downlink: conn.downlink,
          saveData: conn.saveData
        }
      : undefined;

    logWithTime('🔌 Leader WebSocket closed:', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      onLine: navigator.onLine,
      visibilityState: document.visibilityState,
      connection: connectionInfo,
      timeSinceOpenMs,
      timeSinceLastMessageMs: timeSinceMsgMs,
      timeSinceLastHeartbeatMs: timeSinceHeartbeatMs,
      timeSinceLastOfflineMs: timeSinceOfflineMs
    });
    wsRef.current = null;
    setConnectionStatus('disconnected');
    
    // ✅ FIX: Don't attempt immediate reconnection for abnormal closures
    // Let the useEffect handle reconnection with proper delay
  };

  ws.onerror = (err) => {
    const conn = (navigator as any).connection;
    errorWithTime('WebSocket error:', {
      err,
      onLine: navigator.onLine,
      visibilityState: document.visibilityState,
      connection: conn
        ? {
            effectiveType: conn.effectiveType,
            rtt: conn.rtt,
            downlink: conn.downlink,
            saveData: conn.saveData
          }
        : undefined
    });
    // ✅ FIX: Don't close immediately on error, let it try to recover
    // Only set status to disconnected, close will be handled by onclose
    setConnectionStatus('disconnected');
  };

  }, connectionDelay);

  return () => {
    // ✅ FIX: Clear any pending connection timeouts on cleanup
    clearTimeout(connectTimeout);
    
    // ✅ FIX: Force close any active WebSocket
    logWithTime('Cleaning up leader WebSocket...');
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          logWithTime('Closing leader WebSocket with code 1000');
          wsRef.current.close(1000, 'Component cleanup');
        }
      } catch (error) {
        logWithTime('Error closing leader WebSocket:', error);
      }
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  };
}, [isCopying, leaderAccount?.id, accessToken, tradovateUserId, currentUser?.uid]);

// Handler for Add Leader/Follower
  const handleOpenPopup = (type: string) => {
    setPopupType(type);
    setShowAccountPopup(true);
    setSelectedAccount(null);
  };

  // Handler for choosing account
const handleChooseAccount = async () => {
  if (!selectedAccount) return;

  if (popupType === 'leader') {
    // Optimistic update: Update local state immediately
    setAccounts(prev => prev.map(acc => ({
      ...acc,
      leader: acc.id === selectedAccount.id
    })));
    setLeaderId(selectedAccount.id);

    // Then update Firestore
    await Promise.all(accounts.map(acc =>
      setDoc(doc(db, "finances", String(acc.id)), { leader: acc.id === selectedAccount.id }, { merge: true })
    ));
  } else if (popupType === 'follower') {
    // Check if adding this follower would exceed the subscription limit
    const currentTotalAccounts = (leaderAccount ? 1 : 0) + followers.length;
    if (currentTotalAccounts >= maxAccounts) {
      alert(`Account limit reached! You have reached the limit of ${maxAccounts} accounts for your subscription.`);
      return;
    }

    // Optimistic update: Update local state immediately
    setAccounts(prev => prev.map(acc => 
      acc.id === selectedAccount.id ? { ...acc, follower: true } : acc
    ));
    setFollowerIds(prev => [...prev, selectedAccount.id]);
    
    // ✅ NEW: Add new follower as ACTIVE by default
    setActiveFollowers(prev => new Set([...prev, selectedAccount.id.toString()]));
    logWithTime(`✅ New follower added as ACTIVE: ${selectedAccount.name} (ID: ${selectedAccount.id})`);

    // Then update Firestore with follower=true AND isActive=true
    await setDoc(doc(db, "finances", String(selectedAccount.id)), { 
      follower: true,
      isActive: true // ✅ Default new followers to active
    }, { merge: true });
  }

  setShowAccountPopup(false);
  setPopupType(null);
  setSelectedAccount(null);
};

const handleRemoveLeader = async () => {
  if (leaderId) {
    // Optimistic update: Update local state immediately
    setAccounts(prev => prev.map(acc => 
      acc.id === leaderId ? { ...acc, leader: false } : acc
    ));
    setLeaderId(null);

    // Then update Firestore
    await setDoc(doc(db, "finances", String(leaderId)), { leader: false }, { merge: true });
  }
};

const handleRemoveFollower = async (followerId: string) => {
  // Optimistic update: Update local state immediately
  setAccounts(prev => prev.map((acc: any) => 
    acc.id === followerId ? { ...acc, follower: false } : acc
  ));
  setFollowerIds(prev => prev.filter(id => id !== followerId));

  // Then update Firestore
  await setDoc(doc(db, "finances", String(followerId)), { follower: false }, { merge: true });
};

const handleSaveRatio = async () => {
  if (selectedFollowerForRatio) {
    // Update local state immediately for UI responsiveness
    const newRatios = new Map(followerRatios);
    newRatios.set(selectedFollowerForRatio.id.toString(), tempRatio);
    setFollowerRatios(newRatios);
    
    // Save to Firestore
    try {
      await setDoc(
        doc(db, "finances", String(selectedFollowerForRatio.id)), 
        { ratio: tempRatio }, 
        { merge: true }
      );
      
      logWithTime('✅ Ratio saved to Firestore:', {
        accountId: selectedFollowerForRatio.id,
        accountName: selectedFollowerForRatio.name,
        ratio: tempRatio
      });
    } catch (error) {
      errorWithTime('❌ Failed to save ratio to Firestore:', error);
    }
    
    setShowRatioPopup(false);
    setSelectedFollowerForRatio(null);
  }
};

  // Render table rows (always show two rows: crown and slider, even if empty)
  const renderTableRows = () => {
    const leaderRow = (
      <tr className="border-b border-white/10">
        <td className="px-2 py-2">
          <div title="Main">
            <Crown className="w-5 h-5 text-amber-300" />
          </div>
        </td>
        <td className="px-2 py-2">{leaderAccount ? "I" : ""}</td>
      <td className="px-2 py-2">
  {leaderAccount ? (
    <span className="inline-block border border-white/20 rounded px-2 py-1 text-white text-xs">
      {leaderAccount.name}
    </span>
  ) : ""}
</td>
        <td className="px-2 py-2 text-white">
          {leaderAccount ? formatCurrency(Number(leaderAccount.balance) || 0) : ""}
        </td>
        <td className="px-2 py-2">
          {leaderAccount && (
            <div className="flex items-center gap-1">
              <img
                src={
                  leaderAccount.platform === "Tradovate" ? TLGO :
                  leaderAccount.platform === "TopstepX" ? (theme === 'light' ? TPTXLight : TPTX) :
                  leaderAccount.platform === "Volumetrica" ? VolumetricaLogo :
                  NONmatchLogo
                }
                alt="Account Logo"
                className={`${leaderAccount.platform === "Tradovate" ? "w-7 h-7" : leaderAccount.platform === "TopstepX" ? "w-17 h-7" : leaderAccount.platform === "Volumetrica" ? "w-7 h-7" : "w-9 h-9"} object-contain rounded ${leaderAccount.platform === "Tradovate" || leaderAccount.platform === "TopstepX" || leaderAccount.platform === "Volumetrica" ? "" : "border border-white/30"}`}
              />
              {leaderAccount.platform !== "TopstepX" && <span>{leaderAccount.platform}</span>}
            </div>
          )}
        </td>
        <td className="px-2 py-2">
          {leaderAccount && leaderAccount.firm ? (
            <span className="inline-flex items-center border border-white/30 rounded p-[0px]" style={{ marginTop: '6px' }}>
              <img
                src={getFirmLogo(leaderAccount.firm)}
                alt={leaderAccount.firm}
                className="w-6 h-6 object-contain"
                style={{ display: "block" }}
              />
            </span>
          ) : (
            ""
          )}
        </td>
        <td className="px-2 py-2 text-white" style={{ minWidth: 120 }}>
          {(() => {
            if (!leaderAccount) return "";

            if ((leaderAccount.platform || 'Tradovate') === 'TopstepX' || (leaderAccount.platform || 'Tradovate') === 'Volumetrica') {
              const value = topstepXDayRealizedPnLByAccountId.get(String(leaderAccount.id)) || 0;
              const absVal = Math.abs(value);
              const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              let color = 'text-white';
              let textStyle: any = {};
              if (value > 0) {
                color = '';
                textStyle = { color: '#416B4E' };
              }
              if (value < 0) {
                color = '';
                textStyle = { color: '#9a3a3a' };
              }
              return (
                <span className={`inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent ${color}`} style={textStyle}>
                  {value < 0 ? `-$${formatted}` : `$${formatted}`}
                </span>
              );
            }

            const value = dailyPnL.get(leaderAccount.id) || dailyPnL.get(leaderAccount.id.toString()) || 0;
            const absVal = Math.abs(value);
            const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            let color = 'text-white';
            let textStyle = {};
            if (value > 0) {
              color = '';
              textStyle = { color: '#416B4E' };
            }
            if (value < 0) {
              color = '';
              textStyle = { color: '#9a3a3a' };
            }
            return (
              <span className={`inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent ${color}`} style={textStyle}>
                {value < 0 ? `-$${formatted}` : `$${formatted}`}
              </span>
            );
          })()}
        </td>
        <td className="px-2 py-2 text-white" style={{ minWidth: 120 }}>
          {(() => {
            if (leaderAccount && typeof getQuote === 'function') {
              const value = calculateAccountUnrealizedPnL(leaderAccount.id, apiPositions, getQuote, undefined, leaderPositionData);
              const absVal = Math.abs(value);
              const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              let color = 'text-white';
              let textStyle = {};
              if (value > 0) {
                color = '';
                textStyle = { color: '#416B4E' };
              }
              if (value < 0) {
                color = '';
                textStyle = { color: '#9a3a3a' };
              }
              return (
                <span className={`inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent ${color}`} style={textStyle}>
                  {value < 0 ? `-$${formatted}` : `$${formatted}`}
                </span>
              );
            }
            return (
              <span className="inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent text-white">
                $0.00
              </span>
            );
          })()}
        </td>
        <td className="px-2 py-2" style={{ minWidth: 90 }}>
          <div className="flex items-center justify-between w-full">
            <button
              className={`inline-block rounded px-2 py-1 text-xs ml-1 transition-colors cursor-pointer flex items-center gap-1 ${
                theme === 'light'
                  ? 'border border-black bg-transparent text-black hover:bg-gray-200'
                  : 'border border-white/30 rounded px-2 py-1 bg-[#232326] text-white hover:bg-[#94bba3]/20'
              }`}
              title="Leader ratio is locked"
              disabled
            >
              <Lock size={14} />
            </button>
            {leaderAccount && (
              <button
                className="ml-1 text-red-400 hover:text-red-600"
                onClick={handleRemoveLeader}
                title="Remove Leader"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </td>
      </tr>
    );

    const followerRows = followers.map((follower, idx) => (
      <tr key={follower.id} className="border-b border-white/10">
        <td className="px-2 py-2 align-middle">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={activeFollowers.has(follower.id.toString())}
              onChange={async (e) => {
                const followerId = follower.id.toString();
                const newActiveFollowers = new Set(activeFollowers);
                const isActive = e.target.checked;
                
                if (isActive) {
                  newActiveFollowers.add(followerId);
                } else {
                  newActiveFollowers.delete(followerId);
                }
                setActiveFollowers(newActiveFollowers);
                
                // ✅ Save slider state to Firestore immediately using direct Firestore update
                try {
                  logWithTime(`💾 Saving follower slider state: ${follower.name} = ${isActive ? 'ON' : 'OFF'}`);
                  
                  // Use direct Firestore update like other finance document updates
                  await setDoc(doc(db, "finances", String(follower.id)), { 
                    isActive: isActive 
                  }, { merge: true });

                  logWithTime(`✅ Follower slider state saved: ${follower.name} = ${isActive ? 'ON' : 'OFF'}`);
                } catch (error) {
                  errorWithTime(`Error saving follower slider state for ${follower.name}:`, error);
                }
              }}
            />
            <span
              className={`w-8 h-5 flex items-center rounded-full transition-all relative mt-2 ${
                activeFollowers.has(follower.id.toString())
                  ? "bg-[#94bba3]"
                  : "bg-gray-400"
              }`}
            >
              <span
                className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                  activeFollowers.has(follower.id.toString())
                    ? "translate-x-4 left-1"
                    : "left-1"
                }`}
              ></span>
            </span>
          </label>
        </td>
        <td className="px-2 py-2">{romanNumerals[idx + 1]}</td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
          <span className="inline-block border border-white/20 rounded px-2 py-1 text-white text-xs">
  {follower.name}
</span>
          </div>
        </td>
        <td className="px-2 py-2 text-white">
          {formatCurrency(Number(follower.balance) || 0)}
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1">
            <img
              src={
                follower.platform === "Tradovate" ? TLGO :
                follower.platform === "TopstepX" ? (theme === 'light' ? TPTXLight : TPTX) :
                follower.platform === "Volumetrica" ? VolumetricaLogo :
                NONmatchLogo
              }
              alt="Account Logo"
              className={`${follower.platform === "Tradovate" ? "w-7 h-7" : follower.platform === "TopstepX" ? "w-17 h-7" : follower.platform === "Volumetrica" ? "w-7 h-7" : "w-9 h-9"} object-contain rounded ${follower.platform === "Tradovate" || follower.platform === "TopstepX" || follower.platform === "Volumetrica" ? "" : "border border-white/30"}`}
            />
            {follower.platform !== "TopstepX" && <span>{follower.platform}</span>}
          </div>
        </td>
        <td className="px-2 py-2">
          {follower && follower.firm ? (
            <span className="inline-flex items-center border border-white/30 rounded p-[0px]" style={{ marginTop: '6px' }}>
              <img
                src={getFirmLogo(follower.firm)}
                alt={follower.firm}
                className="w-6 h-6 object-contain"
                style={{ display: "block" }}
              />
            </span>
          ) : (
            ""
          )}
        </td>
        <td className="px-2 py-2 text-white" style={{ minWidth: 120 }}>
          {(() => {
            if ((follower.platform || 'Tradovate') === 'TopstepX' || (follower.platform || 'Tradovate') === 'Volumetrica') {
              const value = topstepXDayRealizedPnLByAccountId.get(String(follower.id)) || 0;
              const absVal = Math.abs(value);
              const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              let color = 'text-white';
              let textStyle: any = {};
              if (value > 0) {
                color = '';
                textStyle = { color: '#416B4E' };
              }
              if (value < 0) {
                color = '';
                textStyle = { color: '#9a3a3a' };
              }
              return (
                <span className={`inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent ${color}`} style={textStyle}>
                  {value < 0 ? `-$${formatted}` : `$${formatted}`}
                </span>
              );
            }

            const value = dailyPnL.get(follower.id) || dailyPnL.get(follower.id.toString()) || 0;
            const absVal = Math.abs(value);
            const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            let color = 'text-white';
            let textStyle = {};
            if (value > 0) {
              color = '';
              textStyle = { color: '#416B4E' };
            }
            if (value < 0) {
              color = '';
              textStyle = { color: '#9a3a3a' };
            }
            return (
              <span className={`inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent ${color}`} style={textStyle}>
                {value < 0 ? `-$${formatted}` : `$${formatted}`}
              </span>
            );
          })()}
        </td>
        <td className="px-2 py-2 text-white" style={{ minWidth: 120 }}>
          {(() => {
            if (typeof getQuote === 'function') {
              const value = calculateAccountUnrealizedPnL(follower.id, apiPositions, getQuote, followerPositionsData);
              const absVal = Math.abs(value);
              const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              let color = 'text-white';
              let textStyle = {};
              if (value > 0) {
                color = '';
                textStyle = { color: '#416B4E' };
              }
              if (value < 0) {
                color = '';
                textStyle = { color: '#9a3a3a' };
              }
              return (
                <span className={`inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent ${color}`} style={textStyle}>
                  {value < 0 ? `-$${formatted}` : `$${formatted}`}
                </span>
              );
            }
            return (
              <span className="inline-block border border-white/20 rounded px-2 py-1 text-xs font-semibold bg-transparent text-white">
                $0.00
              </span>
            );
          })()}
        </td>
        <td className="px-2 py-2" style={{ minWidth: 90 }}>
          <div className="flex items-center justify-between w-full">
            <button
              className={`inline-block rounded px-2 py-1 text-xs ml-1 transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'border border-black bg-transparent text-black hover:bg-gray-200'
                  : 'border border-white/30 rounded px-2 py-1 bg-[#232326] text-white hover:bg-[#94bba3]/20'
              }`}
              onClick={() => {
                setSelectedFollowerForRatio(follower);
                setTempRatio(followerRatios.get(follower.id.toString()) || 1);
                setShowRatioPopup(true);
              }}
            >
              {followerRatios.get(follower.id.toString()) || 1}x
            </button>
            <button
              className="ml-1 text-red-400 hover:text-red-600"
              onClick={() => handleRemoveFollower(follower.id)}
              title="Remove Follower"
            >
              <X size={16} />
            </button>
          </div>
        </td>
      </tr>
    ));

    return [leaderRow, ...followerRows];
  };

  async function getTopstepXAccessToken(userId: string) {
    const primaryDocId = `${userId}_topstepx_token`;
    const primarySnap = await getDoc(doc(db, 'projectXTokens', primaryDocId));
    if (primarySnap.exists()) {
      const data = primarySnap.data() as any;
      return {
        access_token: data?.access_token as string | undefined,
        expires_at: data?.expires_at as number | undefined,
        provider: data?.provider as string | undefined
      };
    }

    const q = query(
      collection(db, 'projectXTokens'),
      where('userId', '==', userId),
      where('provider', '==', 'TopstepX'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { access_token: undefined as string | undefined, expires_at: undefined as number | undefined, provider: 'TopstepX' };
    }
    const data = snap.docs[0].data() as any;
    return {
      access_token: data?.access_token as string | undefined,
      expires_at: data?.expires_at as number | undefined,
      provider: data?.provider as string | undefined
    };
  }

  type TopstepXAccount = { id: number; name?: string };

  async function fetchTopstepXActiveAccounts(jwtToken: string): Promise<TopstepXAccount[]> {
    const res = await fetch('https://api.topstepx.com/api/Account/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({ onlyActiveAccounts: true })
    });

    if (!res.ok) {
      throw new Error(`TopstepX account search failed: ${res.status}`);
    }

    const parsed = await readJsonOrText(res);
    if (!parsed.isJson) {
      throw new Error(`TopstepX account search returned non-JSON (status ${res.status}) preview: ${parsed.text.slice(0, 200)}`);
    }
    const data: any = parsed.data;
    if (!data?.success || !Array.isArray(data?.accounts)) {
      throw new Error('Invalid TopstepX account search response');
    }

    return data.accounts as TopstepXAccount[];
  }

  function topstepXContractRefToSymbol(contractRef: unknown): string {
    if (!contractRef) return '';
    const raw = String(contractRef);
    const parts = raw.split('.');
    if (parts.length >= 5 && parts[3]) {
      const base = parts[3];
      const month = parts[4] || '';
      return `${base}${month}`;
    }
    return raw;
  }

  // Volumetrica feedSymbol → Tradovate-compatible name
  // e.g. "/MNQH26:XCME" → "MNQH26", "/ESH26:XCME" → "ESH26", "MNQH26" → "MNQH26"
  function volumetricaFeedSymbolToTradovate(feedSymbol: string): string {
    if (!feedSymbol) return '';
    let s = feedSymbol.trim();
    // Strip leading /
    if (s.startsWith('/')) s = s.slice(1);
    // Strip :EXCHANGE suffix
    const colonIdx = s.indexOf(':');
    if (colonIdx > 0) s = s.slice(0, colonIdx);
    return s;
  }

  // Volumetrica feedSymbol → short Tradovate name (last digit of year)
  // e.g. "/MNQH26:XCME" → "MNQH6"
  function volumetricaFeedSymbolToTradovateName(feedSymbol: string): string {
    const base = volumetricaFeedSymbolToTradovate(feedSymbol);
    if (!base) return '';
    // Match pattern: letters + month letter + 2-digit year → letters + month + last digit
    const m = base.match(/^([A-Z]+)([A-Z])(\d{2})$/i);
    if (m) return `${m[1]}${m[2]}${m[3].slice(-1)}`;
    return base;
  }

  function topstepXContractRefToTradovateName(contractRef: unknown): string {
    // TopstepX: CON.F.US.MNQ.H26 -> Tradovate contract name is typically MNQH6 (last digit of year)
    if (!contractRef) return '';
    const raw = String(contractRef);
    const parts = raw.split('.');
    if (parts.length < 5 || !parts[3]) return '';

    const base = String(parts[3]);
    const expiry = String(parts[4] || '');
    const m = expiry.match(/^([FGHJKMNQUVXZ])(\d{1,2})$/i);
    if (!m) return `${base}${expiry}`;

    const monthCode = m[1].toUpperCase();
    const yearNum = parseInt(m[2], 10);
    if (!Number.isFinite(yearNum)) return `${base}${expiry}`;

    const yearDigit = String(yearNum % 10);
    return `${base}${monthCode}${yearDigit}`;
  }

  function normalizeSideToBuySell(value: any): 'Buy' | 'Sell' | undefined {
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (v.includes('buy')) return 'Buy';
      if (v.includes('sell')) return 'Sell';
    }
    if (value === 1) return 'Buy';
    if (value === 2) return 'Sell';
    return undefined;
  }

  function topstepXSideToBuySell(value: any): 'Buy' | 'Sell' | undefined {
    // TopstepX docs: OrderSide.Bid = 0, OrderSide.Ask = 1
    if (value === 0) return 'Buy';
    if (value === 1) return 'Sell';
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (v === 'bid') return 'Buy';
      if (v === 'ask') return 'Sell';
      if (v.includes('buy')) return 'Buy';
      if (v.includes('sell')) return 'Sell';
    }
    // Fallback for other sources that use 1/2
    return normalizeSideToBuySell(value);
  }

  function topstepXOrderTypeLabel(value: any): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return typeof value === 'string' ? value : 'Order';
    switch (n) {
      case 1: return 'Limit';
      case 2: return 'Market';
      case 3: return 'StopLimit';
      case 4: return 'Stop';
      case 5: return 'TrailingStop';
      case 6: return 'JoinBid';
      case 7: return 'JoinAsk';
      default: return 'Order';
    }
  }

  function topstepXOrderStatusLabel(value: any): string | undefined {
    const n = Number(value);
    if (!Number.isFinite(n)) return typeof value === 'string' ? value : undefined;
    switch (n) {
      case 0: return 'None';
      case 1: return 'Open';
      case 2: return 'Filled';
      case 3: return 'Cancelled';
      case 4: return 'Expired';
      case 5: return 'Rejected';
      case 6: return 'Pending';
      default: return String(n);
    }
  }

  async function stopTopstepXLeaderSignalR() {
    const conn = topstepConnRef.current;
    topstepConnRef.current = null;
    if (conn) {
      try {
        await conn.stop();
      } catch {
        // ignore
      }
    }
    setTopstepLeaderStatus('disconnected');
  }

  async function startTopstepXLeaderSignalR() {
    if (!currentUser?.uid) {
      throw new Error('You must be signed in to load the TopstepX token from Firestore.');
    }
    if (!leaderAccount) {
      throw new Error('No leader account selected.');
    }

    setTopstepLeaderLastError(null);
    setTopstepLeaderStatus('connecting');

    // Ensure Tradovate leader stream is not running
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'Switching to TopstepX leader');
        }
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setAccessToken(null);
    setTradovateUserId(null);

    await stopTopstepXLeaderSignalR();

    // Always refresh the TopstepX JWT on each Start.
    // Reason: TopstepX SignalR sessions can behave like "single-use"/"single-active-session" per token,
    // so reusing the same JWT after stopping can lead to an immediate server disconnect.
    const refreshResult = await postJsonWithFirebaseAuth<{ success?: boolean; error?: string; expires_at?: number }>(
      '/api/projectx',
      {
        action: 'authenticate',
        provider: 'TopstepX',
        userId: currentUser.uid
      },
      { purpose: 'TopstepX refresh token for SignalR leader' }
    );
    if (!refreshResult.ok) {
      const details = (refreshResult.data as any)?.error || refreshResult.text || 'Unknown error';
      setTopstepLeaderLastError(String(details));
      throw new Error(`TopstepX token refresh failed (status ${refreshResult.status}, debugId ${refreshResult.debugId})`);
    }

    const tok = await getTopstepXAccessToken(currentUser.uid);
    if (!tok.access_token) {
      setTopstepLeaderTokenStatus('Not Active');
      throw new Error('No TopstepX JWT found in Firestore (collection: projectXTokens).');
    }
    if (tok.expires_at && Date.now() >= tok.expires_at) {
      setTopstepLeaderTokenStatus('Expired');
      throw new Error('Stored TopstepX token is expired. Re-authenticate to generate a new token.');
    }
    setTopstepLeaderTokenStatus('Valid');

    const token = tok.access_token;
    const hubUrl = 'https://rtc.topstepx.com/hubs/user';

    // IMPORTANT: TradeCopier's leaderAccount.id is not guaranteed to be the TopstepX account id.
    // Resolve the actual TopstepX account id via Account/search (same approach as Test page).
    let subscribeAccountId = Number(leaderAccount.id);
    try {
      const activeAccounts = await fetchTopstepXActiveAccounts(token);
      const leaderIdNum = Number(leaderAccount.id);
      const byId = activeAccounts.find(a => a.id === leaderIdNum);
      const byName = !byId && leaderAccount?.name
        ? activeAccounts.find(a => (a.name || '').trim() === String(leaderAccount.name || '').trim())
        : undefined;

      const resolved = (byId || byName)?.id;
      if (typeof resolved === 'number' && Number.isFinite(resolved)) {
        subscribeAccountId = resolved;
      }

      const exists = activeAccounts.some(a => a.id === subscribeAccountId);
      if (!exists) {
        const idsPreview = activeAccounts.slice(0, 10).map(a => a.id).join(', ');
        throw new Error(`Leader TopstepX accountId ${subscribeAccountId} not found in active accounts (first ids: ${idsPreview})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTopstepLeaderLastError(msg);
      throw e;
    }

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    conn.serverTimeoutInMilliseconds = 30000;
    conn.keepAliveIntervalInMilliseconds = 10000;

    conn.onreconnecting(() => {
      setTopstepLeaderStatus('connecting');
    });
    conn.onreconnected(() => {
      setTopstepLeaderStatus('connected');
    });
    conn.onclose((err) => {
      if (err) {
        setTopstepLeaderLastError(err.message);
        setTopstepLeaderStatus('error');
        return;
      }
      setTopstepLeaderStatus('disconnected');
    });

    // The server can push multiple event types once we subscribe. We only need trades for copying,
    // but registering no-op handlers prevents noisy "No client method" warnings.
    const noop = () => {};
    conn.on('GatewayLogout', noop);
    conn.on('gatewaylogout', noop);
    conn.on('GatewayUserPosition', noop);
    conn.on('gatewayuserposition', noop);

    const toFiniteNumber = (value: any): number | undefined => {
      if (value == null) return undefined;
      if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : undefined;
      }
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    };

    const unwrapTopstepXPayload = (input: any): any => {
      let obj = input;

      // Some servers wrap a single payload in an array
      if (Array.isArray(obj) && obj.length === 1) obj = obj[0];

      // Some servers send JSON strings
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch {
          // keep as string
        }
      }

      // Common envelope shapes: { payload }, { data }, { order }, etc.
      if (obj && typeof obj === 'object') {
        const nested =
          (obj as any).payload ??
          (obj as any).data ??
          (obj as any).order ??
          (obj as any).gatewayUserOrder ??
          (obj as any).GatewayUserOrder;

        if (nested && typeof nested === 'object') return nested;
      }

      return obj;
    };

    const normalizeSignalRArgsToPayload = (args: any[]): any => {
      if (!args || args.length === 0) return undefined;

      // SignalR can call handlers with multiple args; payload is usually last
      const last = unwrapTopstepXPayload(args[args.length - 1]);
      if (last && typeof last === 'object') return last;

      // Otherwise pick the first object-like argument
      const firstObj = args.find(a => a && typeof a === 'object');
      return unwrapTopstepXPayload(firstObj);
    };

    const handleTopstepXGatewayUserOrder = (...args: any[]) => {
      try {
        const raw = normalizeSignalRArgsToPayload(args);

        const accountId =
          toFiniteNumber(raw?.accountId ?? raw?.AccountId ?? raw?.accountID ?? raw?.AccountID) ??
          subscribeAccountId;
        if (accountId !== subscribeAccountId) return;

        // Docs: { id, accountId, contractId, symbolId, status, type, side, size, limitPrice, stopPrice, filledPrice, creationTimestamp, updateTimestamp }
        const contractId = raw?.contractId ?? raw?.ContractId ?? raw?.contract ?? raw?.Contract;
        const symbolId = raw?.symbolId ?? raw?.SymbolId ?? raw?.symbol ?? raw?.Symbol;
        const contractSymbol = typeof symbolId === 'string' && symbolId.length > 0
          ? String(symbolId)
          : topstepXContractRefToSymbol(contractId);

        const sideValue =
          raw?.side ?? raw?.Side ??
          raw?.orderSide ?? raw?.OrderSide ??
          raw?.action ?? raw?.Action;
        const action = topstepXSideToBuySell(sideValue);
        const qty = toFiniteNumber(raw?.size ?? raw?.Size ?? raw?.qty ?? raw?.Qty ?? raw?.quantity ?? raw?.Quantity);

        const orderId = toFiniteNumber(raw?.id ?? raw?.Id ?? raw?.orderId ?? raw?.OrderId);

        const orderType = topstepXOrderTypeLabel(
          raw?.type ?? raw?.Type ?? raw?.orderType ?? raw?.OrderType ?? raw?.order_type ?? raw?.orderTypeId
        );
        const status = topstepXOrderStatusLabel(raw?.status ?? raw?.Status ?? raw?.ordStatus ?? raw?.OrdStatus);

        const priceRaw =
          raw?.limitPrice ?? raw?.LimitPrice ??
          raw?.stopPrice ?? raw?.StopPrice ??
          raw?.filledPrice ?? raw?.FilledPrice ??
          raw?.price ?? raw?.Price;
        const price = toFiniteNumber(priceRaw);

        const ts = raw?.updateTimestamp ?? raw?.UpdateTimestamp ?? raw?.creationTimestamp ?? raw?.CreationTimestamp;
        const timestamp = typeof ts === 'string' ? ts : new Date().toISOString();

        // If we cannot parse key fields, log the raw payload shape for debugging.
        if (!action || qty == null || !contractSymbol) {
          const rawKeys = raw && typeof raw === 'object' ? Object.keys(raw).slice(0, 60) : [];
          logWithTime('⚠️ TopstepX order payload could not be normalized:', {
            argsCount: args.length,
            rawType: Array.isArray(raw) ? 'array' : typeof raw,
            rawKeys,
            rawPreview: raw
          });
        }

        logWithTime('📥 TopstepX order event received:', {
          accountId,
          symbol: contractSymbol,
          action,
          qty,
          orderType,
          price,
          status
        });

        const isTerminal = status === 'Cancelled' || status === 'Rejected' || status === 'Expired' || status === 'Filled';
        const isActive = status === 'Open' || status === 'Pending' || status === undefined;

        // For status updates (especially Cancelled), payloads can omit side/size.
        // Preserve last-known values so the UI still updates meaningfully.
        setLatestLeaderOrder(prev => {
          const resolvedAction = action ?? prev?.action;
          const resolvedQty = qty != null ? Math.abs(qty) : prev?.qty;
          const resolvedSymbol = contractSymbol || prev?.symbol || '';
          const resolvedPrice = price ?? prev?.price;

          // If we still don't have the minimum fields to show anything, keep previous state.
          if (!resolvedAction && !prev) return prev;
          if (resolvedQty == null && !prev) return prev;

          const baseLabel = `${resolvedAction ?? ''} ${orderType}`.trim();
          const nextLabel = status && status !== 'Open' ? `${baseLabel} (${status})` : baseLabel;

          return {
            symbol: resolvedSymbol,
            qty: resolvedQty ?? 0,
            price: resolvedPrice,
            label: nextLabel,
            action: resolvedAction,
            status: status,
            orderId: (orderId as number | undefined) ?? prev?.orderId,
            timestamp
          };
        });

        // ✅ Copy TopstepX leader pending orders using existing pipeline (same as Tradovate leader)
        // Only trigger on non-market orders with a stable orderId.
        if (orderId != null) {
          const orderKey = `topstepx:${subscribeAccountId}:${orderId}`;
          const resolvedOrderType = orderType;
          const isPendingType = resolvedOrderType !== 'Market';

          // ✅ Keep a local order details record for TopstepX leader orders.
          // This enables modify propagation (copyModifyToFollowers), which relies on orderDetailsMap.
          // Use best-effort extraction of prices from the gateway payload.
          const derivedLimitPrice =
            (typeof price === 'number' && Number.isFinite(price))
              ? price
              : (typeof raw?.limitPrice === 'number' ? raw.limitPrice : (typeof raw?.LimitPrice === 'number' ? raw.LimitPrice : undefined));
          const derivedStopPrice =
            (typeof raw?.stopPrice === 'number' ? raw.stopPrice : (typeof raw?.StopPrice === 'number' ? raw.StopPrice : undefined));
          const derivedTimeInForce = (raw?.timeInForce ?? raw?.TimeInForce ?? 'Day') as string;
          const derivedQty = Math.abs(qty ?? 0);

          if (isPendingType) {
            const existing = orderDetailsMap.current.get(orderId);
            orderDetailsMap.current.set(orderId, {
              orderId,
              orderQty: derivedQty || existing?.orderQty,
              orderType: resolvedOrderType || existing?.orderType,
              price: derivedLimitPrice ?? existing?.price,
              stopPrice: derivedStopPrice ?? existing?.stopPrice,
              timeInForce: derivedTimeInForce || existing?.timeInForce
            });
          }

          if (isActive && isPendingType && qty != null && qty !== 0 && action) {
            if (!topstepPendingOrderCopyTriggeredRef.current.has(orderKey)) {
              topstepPendingOrderCopyTriggeredRef.current.add(orderKey);

              const leaderOrderForCopy: any = {
                id: orderId,
                orderId: orderId,
                accountId: subscribeAccountId,
                contractId: contractId,
                contractSymbol: contractSymbol,
                symbol: contractSymbol,
                action: action,
                orderType: resolvedOrderType,
                orderQty: Math.abs(qty),
                price: price,
                limitPrice: raw?.limitPrice ?? raw?.LimitPrice,
                stopPrice: raw?.stopPrice ?? raw?.StopPrice,
                timeInForce: raw?.timeInForce ?? raw?.TimeInForce ?? 'Day'
              };

              logWithTime('📤 TopstepX pending order detected - triggering copyPendingOrderToFollowers', {
                orderId,
                symbol: contractSymbol,
                action,
                qty,
                orderType: resolvedOrderType,
                price,
                status
              });

              // Fire and forget; function handles auth + follower routing
              copyPendingOrderToFollowers(leaderOrderForCopy);
            }

            // Modify detection: if price changes after initial copy, propagate to followers
            // For Stop orders we treat stopPrice as the "price" to modify.
            const effectivePrice =
              resolvedOrderType === 'Stop'
                ? derivedStopPrice
                : (derivedLimitPrice ?? derivedStopPrice);

            if (effectivePrice != null && Number.isFinite(effectivePrice)) {
              const last = topstepOrderLastPriceRef.current.get(orderId);
              if (last != null && last !== effectivePrice) {
                logWithTime('✏️ TopstepX pending order price changed - triggering copyModifyToFollowers', {
                  orderId,
                  oldPrice: last,
                  newPrice: effectivePrice
                });
                copyModifyToFollowers(orderId, effectivePrice);
              }
              topstepOrderLastPriceRef.current.set(orderId, effectivePrice);
            }
          }

          // Cancellation/terminal propagation for pending orders
          if (status === 'Cancelled' || status === 'Rejected' || status === 'Expired') {
            logWithTime('🛑 TopstepX pending order terminal status - triggering copyCancelToFollowers', {
              orderId,
              status
            });
            copyCancelToFollowers(orderId);
            topstepPendingOrderCopyTriggeredRef.current.delete(orderKey);
            topstepOrderLastPriceRef.current.delete(orderId);
          }
        }

        // If an order is terminal and we have no symbol/qty to display, remove this specific order.
        if (isTerminal && !contractSymbol && (qty == null || qty === 0)) {
          removeLeaderOrderById(Number(orderId));
        }
      } catch (e) {
        // keep silent; trade copier should not crash from an order payload mismatch
      }
    };

    conn.on('GatewayUserOrder', handleTopstepXGatewayUserOrder);
    conn.on('gatewayuserorder', handleTopstepXGatewayUserOrder);

    conn.on('GatewayUserTrade', async (data: any) => {
      try {
        const accountId = Number(data?.accountId ?? data?.AccountId ?? data?.accountID ?? subscribeAccountId);
        if (accountId !== subscribeAccountId) return;

        if (data?.voided === true || data?.Voided === true) return;

        // Docs: { id, accountId, contractId, creationTimestamp, price, side, size, orderId }
        const contractId = data?.contractId ?? data?.ContractId;
        const symbolId = data?.symbolId ?? data?.SymbolId;
        const contractSymbol = typeof symbolId === 'string' && symbolId.length > 0
          ? String(symbolId)
          : topstepXContractRefToSymbol(contractId);

        const action = topstepXSideToBuySell(data?.side ?? data?.Side);
        if (!action) return;

        const qty = Number(data?.size ?? data?.Size);
        if (!Number.isFinite(qty) || qty === 0) return;

        const priceRaw = data?.price ?? data?.Price;
        const price = Number(priceRaw);

        const orderIdRaw = data?.orderId ?? data?.OrderId;
        const orderIdNum = typeof orderIdRaw === 'number' ? orderIdRaw : parseInt(String(orderIdRaw ?? ''), 10);
        const orderId = Number.isFinite(orderIdNum) ? orderIdNum : Math.floor(Date.now());

        const ts = data?.creationTimestamp ?? data?.CreationTimestamp;
        const timestamp = typeof ts === 'string' ? ts : new Date().toISOString();

        const leaderFill: any = {
          type: 'leader',
          eventType: 'Created',
          accountId: subscribeAccountId,
          orderId,
          contractId,
          contractSymbol,
          action,
          qty,
          price,
          timestamp
        };

        setFills(prev => [leaderFill, ...prev].slice(0, 50));
        setLatestLeaderFill({
          accountName: leaderAccount?.name,
          balance: Number(leaderAccount?.balance) || 0,
          symbol: contractSymbol,
          qty: Math.abs(qty),
          price: Number.isFinite(price) ? price : undefined,
          direction: action === 'Buy' ? 'Buy Market' : 'Sell Market',
          timestamp
        });

        await updatePositions(leaderFill);
        if (!isFlatteningRef.current && (followersRef.current || []).length > 0) {
          await copyTradeToFollowers(leaderFill);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setTopstepLeaderLastError(msg);
      }
    });

    topstepConnRef.current = conn;
    await conn.start();
    await conn.invoke('SubscribeAccounts');
    await conn.invoke('SubscribeOrders', subscribeAccountId);
    await conn.invoke('SubscribePositions', subscribeAccountId);
    await conn.invoke('SubscribeTrades', subscribeAccountId);
    setTopstepLeaderStatus('connected');
  }

  function stopVolumetricaLeaderWss() {
    volumetricaWsClosedIntentionallyRef.current = true;
    const ws = volumetricaWsRef.current;
    volumetricaWsRef.current = null;
    if (ws) {
      try { ws.close(1000, 'Stop Volumetrica leader'); } catch {}
    }
    setVolumetricaLeaderStatus('disconnected');
    setVolumetricaLeaderLastError(null);
  }

  async function startVolumetricaLeaderWss() {
    if (!currentUser?.uid) throw new Error('Not authenticated');
    if (!leaderAccount) throw new Error('No leader account selected');

    setVolumetricaLeaderLastError(null);
    setVolumetricaLeaderStatus('connecting');

    // Ensure other leader streams are not running
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'Switching to Volumetrica leader');
        }
      } catch {}
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setAccessToken(null);
    setTradovateUserId(null);
    if (topstepConnRef.current) {
      await stopTopstepXLeaderSignalR();
    }
    stopVolumetricaLeaderWss();
    volumetricaWsClosedIntentionallyRef.current = false;

    // Get fresh WSS credentials from server
    const tokenResult = await postJsonWithFirebaseAuth<any>(
      '/api/volumetrica',
      { action: 'getWssToken', userId: currentUser.uid },
      { purpose: 'Volumetrica leader getWssToken' }
    );
    if (!tokenResult.ok || !tokenResult.data?.tradingWssEndpoint || !tokenResult.data?.tradingWssToken) {
      const errMsg = (tokenResult.data as any)?.error || `Failed to get Volumetrica WSS token (status ${tokenResult.status})`;
      setVolumetricaLeaderLastError(errMsg);
      setVolumetricaLeaderStatus('error');
      throw new Error(errMsg);
    }

    const { tradingWssEndpoint, tradingWssToken } = tokenResult.data;

    // Load protobuf types (browser-compatible, from src/lib/)
    const { loadProto: loadVolProto } = await import('@/lib/volumetricaProto');
    const { ClientRequestMsg, ServerResponseMsg } = await loadVolProto();

    const leaderAccountId = Number(leaderAccount.id);
    logWithTime('🔍 Volumetrica leader account ID:', { raw: leaderAccount.id, asNumber: leaderAccountId, type: typeof leaderAccount.id });

    const ws = new WebSocket(tradingWssEndpoint);
    ws.binaryType = 'arraybuffer';
    volumetricaWsRef.current = ws;

    const sendMsg = (msg: any) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const err = ClientRequestMsg.verify(msg);
      if (err) { errorWithTime('Invalid Volumetrica ClientRequestMsg:', err); return; }
      const encoded = ClientRequestMsg.encode(ClientRequestMsg.create(msg)).finish();
      ws.send(encoded);
    };

    // Ping keepalive
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let volInfoMsgHandled = false;

    ws.onopen = () => {
      logWithTime('🔌 Volumetrica leader WSS opened, logging in...');
      sendMsg({ LoginReq: { Token: tradingWssToken, AccountSubscriptionMode: 2, KeepConcurrentSessionOn: true } });
    };

    // Helper: safely parse protobuf sint64 (now strings with longs:String).
    // Returns a JS number. Long artifacts (beyond MAX_SAFE_INTEGER) clamp to ±1
    // preserving sign (negative = Sell, positive = Buy per Volumetrica convention).
    const parseSint64 = (v: unknown, fallback = 0): number => {
      if (v == null) return fallback;
      const s = String(v);
      if (s === '' || s === '0') return fallback;
      // Try native parse first
      const n = Number(s);
      if (!Number.isFinite(n)) return fallback;
      if (Math.abs(n) > Number.MAX_SAFE_INTEGER) {
        // Long artifact — preserve sign, clamp magnitude to 1
        return n < 0 ? -1 : 1;
      }
      return n;
    };

    ws.onmessage = async (event: MessageEvent) => {
      try {
        const buf = new Uint8Array(event.data instanceof ArrayBuffer ? event.data : new ArrayBuffer(0));
        if (!buf.length) return;
        const decoded = ServerResponseMsg.decode(buf);
        const msg: any = ServerResponseMsg.toObject(decoded, { longs: String, enums: Number, defaults: false });

        // 🔍 DEBUG: Log all non-trivial message types received
        const msgKeys = Object.keys(msg).filter(k => {
          const v = msg[k];
          if (v === null || v === undefined || v === false || v === 0 || v === '' || v === '0' || v === 'false') return false;
          if (Array.isArray(v) && v.length === 0) return false;
          return true;
        });
        if (msgKeys.length > 0 && !msgKeys.every(k => k === 'Pong')) {
          logWithTime('📨 Volumetrica leader WSS msg keys:', msgKeys);
        }

        // Login response
        if (msg.LoginMsg) {
          if (msg.LoginMsg.Success) {
            logWithTime('✅ Volumetrica leader WSS logged in');
            // Subscribe to account data
            sendMsg({ InfoReq: { Mode: 1, RequestId: Date.now() } });
            // Start ping keepalive
            pingInterval = setInterval(() => {
              sendMsg({ Ping: { Connected: true, AckValue: Date.now() } });
            }, 15_000);
          } else {
            const reason = msg.LoginMsg.Reason || 'Login failed';
            errorWithTime('❌ Volumetrica leader login failed:', reason);
            setVolumetricaLeaderLastError(reason);
            setVolumetricaLeaderStatus('error');
            ws.close();
            return;
          }
        }

        // InfoMsg response — account list received, now subscribe to orders & positions
        if (msg.InfoMsg && !volInfoMsgHandled) {
          volInfoMsgHandled = true;
          logWithTime('📥 Volumetrica leader InfoMsg received, subscribing to OrdAndPos...');
          sendMsg({ InfoReq: { Mode: 2, RequestId: Date.now() } });
          setVolumetricaLeaderStatus('connected');
          logWithTime('🚀 Volumetrica leader COPIER READY!');
        }

        // Pong — keepalive ack
        if (msg.Pong) return;

        // LoggedOff — server kicked us
        if (msg.LoggedOff) {
          errorWithTime('🔌 Volumetrica leader logged off by server:', msg.LoggedOff.Reason);
          setVolumetricaLeaderLastError(msg.LoggedOff.Reason || 'Logged off');
          setVolumetricaLeaderStatus('error');
          ws.close();
          return;
        }

        // ✅ FillReports — real-time fill events (this is the key leader signal)
        if (msg.FillReports && Array.isArray(msg.FillReports) && msg.FillReports.length > 0) {
          logWithTime('📥 Volumetrica leader FillReports received:', msg.FillReports.length, 'fills, raw:', JSON.stringify(msg.FillReports));
          for (const fill of msg.FillReports) {
            const fillAccountId = parseSint64(fill.AccountId ?? fill.accountId);
            logWithTime('🔍 Fill AccountId check:', { fillAccountId, leaderAccountId, match: fillAccountId === leaderAccountId });
            if (fillAccountId !== leaderAccountId) continue;

            const qty = parseSint64(fill.Quantity ?? fill.quantity);
            if (qty === 0) continue;

            const action: 'Buy' | 'Sell' = qty > 0 ? 'Buy' : 'Sell';
            const absQty = Math.abs(qty);
            const price = Number(fill.Price ?? fill.price ?? 0);
            const contractId = parseSint64(fill.ContractId ?? fill.contractId);
            const feedSymbol = String(fill.FeedSymbol ?? fill.feedSymbol ?? '');
            // Track last market price per symbol for direction inference
            if (feedSymbol && price > 0) volLastMarketPriceRef.current.set(feedSymbol, price);
            const fillId = parseSint64(fill.FillId ?? fill.fillId, Date.now());
            const sourceOrderId = parseSint64(fill.SourceOrderId ?? fill.sourceOrderId);
            const utc = parseSint64(fill.Utc ?? fill.utc);
            const timestamp = utc > 0 ? new Date(utc > 1e12 ? utc : utc * 1000).toISOString() : new Date().toISOString();

            const leaderFill: any = {
              type: 'leader',
              eventType: 'Created',
              accountId: leaderAccountId,
              orderId: sourceOrderId || fillId,
              contractId,
              contractSymbol: feedSymbol,
              action,
              qty: absQty,
              price: Number.isFinite(price) ? price : undefined,
              timestamp,
              fillId: `vol_${leaderAccountId}_${fillId}`,
            };

            logWithTime('📥 Volumetrica leader fill received:', {
              fillId,
              symbol: feedSymbol,
              action,
              qty: absQty,
              price,
              sourceOrderId,
            });

            setFills(prev => [leaderFill, ...prev].slice(0, 50));
            setLatestLeaderFill({
              accountName: leaderAccount?.name,
              balance: Number(leaderAccount?.balance) || 0,
              symbol: feedSymbol,
              qty: absQty,
              price: Number.isFinite(price) ? price : undefined,
              direction: action === 'Buy' ? 'Buy Market' : 'Sell Market',
              timestamp,
            });

            await updatePositions(leaderFill);

            // Refresh follower positions on leader fill
            queueFollowerPositionsRefresh('volumetrica_leader_fill', 250);

            // Copy to followers
            if (!isFlatteningRef.current && (followersRef.current || []).length > 0) {
              await copyTradeToFollowers(leaderFill);
            }
          }
        }

        // ✅ OrderInfo — order status updates (for pending order support)
        if (msg.OrderInfo && Array.isArray(msg.OrderInfo) && msg.OrderInfo.length > 0) {
          // Also grab raw decoded OrderInfo for Long diagnostics
          const rawOrderInfoArr = (decoded as any).OrderInfo || (decoded as any).orderInfo || [];
          for (let oi = 0; oi < msg.OrderInfo.length; oi++) {
            const order = msg.OrderInfo[oi];

            const orderAccountId = parseSint64(order.AccNumber ?? order.accNumber);
            if (orderAccountId !== leaderAccountId) continue;

            const snapType = order.SnapType ?? order.snapType;
            const feedSymbol = String(order.FeedSymbol ?? order.feedSymbol ?? '');
            const orderId = parseSint64(order.OrgServerId ?? order.orgServerId);
            const orderState = order.OrderState ?? order.orderState ?? 0;
            const orderTypeEnum = order.OrderType ?? order.orderType ?? 0;
            const orderPrice = Number(order.OrderPrice ?? order.orderPrice ?? 0);
            const limitPrice = Number(order.OrderLimitPrice ?? order.orderLimitPrice ?? 0);
            const filledQty = parseSint64(order.FilledQty ?? order.filledQty);
            const avgPrice = Number(order.AvgPrice ?? order.avgPrice ?? 0);

            // Track market price ONLY from filled orders (avgPrice). Pending order prices are
            // intentionally away from market and would corrupt the direction inference reference.
            if (feedSymbol && avgPrice > 0) volLastMarketPriceRef.current.set(feedSymbol, avgPrice);

            // PendingQty: read raw Long object from decoded protobuf for reliable sign.
            // longs:String/toObject loses precision for sint64 sentinels (both MIN/MAX map to
            // the same negative JS Number). The raw decoded Long preserves high/low bits.
            const rawPQ = rawOrderInfoArr[oi]?.PendingQty ?? rawOrderInfoArr[oi]?.pendingQty;
            let pendingQty: number;
            let pqDiag: any;
            if (rawPQ != null && typeof rawPQ === 'object' && 'high' in rawPQ && 'low' in rawPQ) {
              const h = rawPQ.high | 0;
              const l = rawPQ.low | 0;
              // Any Long where |high| >= 2^30 is a sentinel (no real order has billions of contracts)
              const isSentinel = Math.abs(h) >= 1073741824;
              if (isSentinel) {
                pendingQty = h < 0 ? -1 : 1;
              } else if (h === 0 && l === 0) {
                pendingQty = 0;
              } else {
                // Small real value: safe to use toNumber
                pendingQty = typeof rawPQ.toNumber === 'function' ? rawPQ.toNumber() : parseSint64(order.PendingQty ?? order.pendingQty);
              }
              pqDiag = { high: h, low: l, unsigned: rawPQ.unsigned, isSentinel, resolvedQty: pendingQty };
            } else {
              // Fallback: rawPQ is already a string/number (toObject already ran)
              const s = String(order.PendingQty ?? order.pendingQty ?? '');
              // Check for known sentinel string patterns (exact Long.MIN/MAX toString values)
              if (s === '-9223372036854775808' || s === '9223372036854775807') {
                pendingQty = s.startsWith('-') ? -1 : 1;
              } else {
                pendingQty = parseSint64(order.PendingQty ?? order.pendingQty);
              }
              pqDiag = { raw: s, resolvedQty: pendingQty };
            }

            logWithTime('📋 Volumetrica leader OrderInfo RAW:', JSON.stringify(order));
            logWithTime('📋 Volumetrica leader OrderInfo parsed:', {
              orderId, feedSymbol, orderState, orderTypeEnum,
              pendingQty, filledQty, orderPrice, limitPrice, snapType,
              pendingQtyDiag: pqDiag,
            });

            // Skip historical snapshots (SnapType 1), process real-time (2) and initial state (0)
            if (snapType === 1) continue;

            // Map enum to label
            const orderTypeLabel = orderTypeEnum === 0 ? 'Market' : orderTypeEnum === 1 ? 'Limit' : orderTypeEnum === 2 ? 'Stop' : orderTypeEnum === 3 ? 'StopLimit' : 'Order';
            // Map state: 0=Submitted, 1=Canceled, 2=Error, 100=PendingRequest, 101=PendingModify, 102=PendingCancel
            const isActive = orderState === 0 || orderState === 100 || orderState === 101;
            const isCanceled = orderState === 1 || orderState === 102;
            const isError = orderState === 2 || orderState === 3;

            // PendingQty is always negative for pending orders (it's just qty, NOT direction).
            // Use absolute value for quantity; direction is inferred from price vs market below.
            const rawQty = pendingQty || filledQty;
            let absQty = Math.abs(rawQty) || (isActive ? 1 : 0);

            // Infer direction from price relative to last known market price
            let action: 'Buy' | 'Sell' | undefined;
            if (isActive && orderPrice > 0) {
              const lastMkt = volLastMarketPriceRef.current.get(feedSymbol);
              if (lastMkt && lastMkt > 0) {
                if (orderTypeEnum === 1) { // Limit: below market = Buy, above = Sell
                  action = orderPrice < lastMkt ? 'Buy' : 'Sell';
                } else if (orderTypeEnum === 2 || orderTypeEnum === 3) { // Stop/StopLimit: above market = Buy, below = Sell
                  action = orderPrice > lastMkt ? 'Buy' : 'Sell';
                }
                logWithTime('🧭 Direction inferred from price vs market:', { action, orderPrice, lastMkt, orderType: orderTypeLabel });
              } else {
                logWithTime('⚠️ No last market price for direction inference on', feedSymbol, '- will resolve via Tradovate quote');
                // Leave action undefined — copyPendingOrderToFollowers will fetch a Tradovate quote to resolve
              }
            } else if (filledQty !== 0) {
              // For filled orders, qty sign IS reliable
              action = filledQty > 0 ? 'Buy' : 'Sell';
            }

            if (orderId && feedSymbol) {
              const statusLabel = isCanceled ? 'Cancelled' : isError ? 'Error' : isActive ? 'Open' : 'Unknown';
              const label = `${action ?? ''} ${orderTypeLabel}`.trim();

              const isPendingType = orderTypeEnum === 1 || orderTypeEnum === 2 || orderTypeEnum === 3; // Limit, Stop, StopLimit

              if (isActive) {
                // Show as pending order in the UI (use the plural state the UI reads)
                setLatestLeaderFill(null);
                addOrUpdateLeaderOrder({
                  orderId,
                  symbol: feedSymbol,
                  qty: absQty,
                  price: orderPrice || limitPrice || undefined,
                  label,
                  action,
                  status: statusLabel,
                  timestamp: new Date().toISOString(),
                });

                // ✅ Store order details so copyModifyToFollowers can find them
                orderDetailsMap.current.set(orderId, {
                  orderType: orderTypeLabel,
                  orderQty: absQty,
                  price: orderTypeEnum === 1 ? (limitPrice || orderPrice) : orderPrice, // Limit uses limitPrice
                  stopPrice: orderTypeEnum === 2 || orderTypeEnum === 3 ? orderPrice : undefined,
                  timeInForce: 'Day',
                });

                // ✅ Copy pending order to followers (only for Limit/Stop/StopLimit, not Market)
                // Direction (action) may be undefined here — it will be resolved in copyPendingOrderToFollowers
                // by fetching a Tradovate quote when needed.
                if (isPendingType && absQty > 0) {
                  if (!volPendingOrderCopyTriggeredRef.current.has(orderId)) {
                    volPendingOrderCopyTriggeredRef.current.add(orderId);

                    const effectivePrice = orderTypeEnum === 2 ? orderPrice : (limitPrice || orderPrice); // Stop uses orderPrice, Limit uses limitPrice
                    const leaderOrderForCopy: any = {
                      id: orderId,
                      orderId: orderId,
                      accountId: leaderAccountId,
                      contractId: 0, // Volumetrica uses feedSymbol, not numeric contractId
                      contractSymbol: feedSymbol,
                      symbol: feedSymbol,
                      action: action, // may be undefined — resolved in copyPendingOrderToFollowers
                      orderType: orderTypeLabel,
                      orderTypeEnum: orderTypeEnum, // pass enum for direction inference
                      orderQty: absQty,
                      price: effectivePrice || undefined,
                      limitPrice: limitPrice || undefined,
                      stopPrice: orderTypeEnum === 2 || orderTypeEnum === 3 ? orderPrice : undefined,
                      timeInForce: 'Day',
                    };

                    logWithTime('📤 Volumetrica pending order detected - triggering copyPendingOrderToFollowers', {
                      orderId, symbol: feedSymbol, action, qty: absQty,
                      orderType: orderTypeLabel, price: effectivePrice,
                    });

                    copyPendingOrderToFollowers(leaderOrderForCopy).catch(err =>
                      errorWithTime('❌ copyPendingOrderToFollowers failed:', err)
                    );
                  }

                  // Modify detection: if price changes after initial copy, propagate
                  const effectivePrice = orderTypeEnum === 2 ? orderPrice : (limitPrice || orderPrice);
                  if (effectivePrice != null && Number.isFinite(effectivePrice) && effectivePrice > 0) {
                    const last = volOrderLastPriceRef.current.get(orderId);
                    if (last != null && last !== effectivePrice) {
                      // Update stored order details with new price before propagating
                      const existing = orderDetailsMap.current.get(orderId);
                      if (existing) {
                        if (orderTypeEnum === 2 || orderTypeEnum === 3) existing.stopPrice = effectivePrice;
                        if (orderTypeEnum === 1 || orderTypeEnum === 3) existing.price = effectivePrice;
                        orderDetailsMap.current.set(orderId, existing);
                      }
                      logWithTime('✏️ Volumetrica pending order price changed - triggering copyModifyToFollowers', {
                        orderId, oldPrice: last, newPrice: effectivePrice,
                      });
                      copyModifyToFollowers(orderId, effectivePrice).catch(err =>
                        errorWithTime('❌ copyModifyToFollowers failed:', err)
                      );
                    }
                    volOrderLastPriceRef.current.set(orderId, effectivePrice);
                  }
                }
              } else if (isCanceled || isError) {
                // Remove from pending orders list, show cancel toast
                removeLeaderOrderById(orderId, { showCancelToast: isCanceled });

                // ✅ Propagate cancellation to followers
                if (volPendingOrderCopyTriggeredRef.current.has(orderId)) {
                  logWithTime('🛑 Volumetrica pending order canceled - triggering copyCancelToFollowers', { orderId });
                  copyCancelToFollowers(orderId).catch(err =>
                    errorWithTime('❌ copyCancelToFollowers failed:', err)
                  );
                  volPendingOrderCopyTriggeredRef.current.delete(orderId);
                  volOrderLastPriceRef.current.delete(orderId);
                  orderDetailsMap.current.delete(orderId);
                }
              }

              // Also update the singular state for backward compat
              setLatestLeaderOrder(prev => ({
                symbol: feedSymbol || prev?.symbol || '',
                qty: absQty || prev?.qty || 0,
                price: (orderPrice || limitPrice) || prev?.price,
                label: statusLabel !== 'Open' ? `${label} (${statusLabel})` : label,
                action: action ?? prev?.action,
                status: statusLabel,
                orderId: orderId ?? prev?.orderId,
                timestamp: new Date().toISOString(),
              }));
            }
          }
        }

        // ✅ PositionInfo — position updates
        if (msg.PositionInfo && Array.isArray(msg.PositionInfo) && msg.PositionInfo.length > 0) {
          for (const pos of msg.PositionInfo) {
            const posAccountId = parseSint64(pos.AccNumber ?? pos.accNumber);
            if (posAccountId !== leaderAccountId) continue;

            const feedSymbol = String(pos.FeedSymbol ?? pos.feedSymbol ?? '');
            const openQty = parseSint64(pos.OpenQuantity ?? pos.openQuantity);
            const openPrice = Number(pos.OpenPrice ?? pos.openPrice ?? 0);

            // Track open price as rough market proxy for direction inference (accept any snapType)
            if (feedSymbol && openPrice > 0) volLastMarketPriceRef.current.set(feedSymbol, openPrice);

            logWithTime('📊 Volumetrica leader position update:', {
              symbol: feedSymbol,
              netPos: openQty,
              avgPrice: openPrice,
            });

            // Update Live Positions card for Volumetrica leader (only when values change to avoid excessive re-renders)
            if (feedSymbol) {
              const prev = volLeaderPosRef.current;
              if (openQty !== 0 && openPrice > 0) {
                if (prev?.netPos !== openQty || prev?.avgEntryPrice !== openPrice || prev?.symbol !== feedSymbol) {
                  volLeaderPosRef.current = { symbol: feedSymbol, netPos: openQty, avgEntryPrice: openPrice };
                  setLeaderPositionData({ symbol: feedSymbol, netPos: openQty, avgEntryPrice: openPrice });
                }
              } else if (openQty === 0 && prev !== null) {
                volLeaderPosRef.current = null;
                setLeaderPositionData(null);
              }
            }
          }
        }

      } catch (err) {
        errorWithTime('Error processing Volumetrica leader WSS message:', err);
      }
    };

    ws.onclose = (event) => {
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
      volumetricaWsRef.current = null;
      if (!volumetricaWsClosedIntentionallyRef.current) {
        logWithTime('🔌 Volumetrica leader WSS closed unexpectedly:', { code: event.code, reason: event.reason });
        setVolumetricaLeaderStatus('disconnected');
      }
    };

    ws.onerror = (err) => {
      errorWithTime('Volumetrica leader WSS error:', err);
      setVolumetricaLeaderStatus('error');
    };
  }

  async function startCopier() {
    if (!leaderAccount) return;
    setIsStarting(true);

    // Pre-warm Volumetrica WSS token (fire-and-forget) so the first copy is instant
    if (currentUser?.uid) {
      const volFollowers = followers.filter((f: any) => f.platform === 'Volumetrica');
      if (volFollowers.length > 0) {
        postJsonWithFirebaseAuth('/api/volumetricacopy', {
          action: 'warmToken',
          userId: currentUser.uid,
          accountId: String(volFollowers[0].id),
        }, { purpose: 'warmToken' }).catch(() => {});
      }
    }

    // Refresh balances/PnL on Start as well (same as page load), without blocking.
    void refreshAccountsSnapshot({ source: 'start', showLoading: false });

    try {
      if (isLeaderTopstepX) {
        logWithTime(`🔌 Starting TopstepX leader (SignalR):`, leaderAccount.id);
        await startTopstepXLeaderSignalR();
        setIsStarting(false);
        setIsCopying(true);
        return;
      }

      if (isLeaderVolumetrica) {
        logWithTime(`🔌 Starting Volumetrica leader (WSS):`, leaderAccount.id);
        await startVolumetricaLeaderWss();
        setIsStarting(false);
        setIsCopying(true);
        return;
      }

      const apiEndpoint = '/api/tradovate';
      const copyApiEndpoint = '/api/tradovatecopy';
      logWithTime(`🔐 Starting authentication for leader account (${leaderPlatform}):`, leaderAccount.id);

      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const tokenResult = await postJsonWithFirebaseAuth<{ access_token?: string; error?: string; source?: string }>(
        apiEndpoint,
        {
          action: 'getWebsocketToken',
          userId: currentUser?.uid,
          accountId: leaderAccount.id
        },
        { purpose: `leader getWebsocketToken accountId=${leaderAccount.id}` }
      );

      if (!tokenResult.ok || !tokenResult.data?.access_token) {
        throw new Error(`Failed to get Tradovate access token (status ${tokenResult.status}, debugId ${tokenResult.debugId}, source ${(tokenResult.data as any)?.source})`);
      }

      logWithTime('✅ Access token received', { debugId: tokenResult.debugId });
      setAccessToken(tokenResult.data.access_token);

      const userToken = await currentUser.getIdToken();
      const userRes = await fetch(copyApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          action: 'getUserInfo',
          userId: currentUser?.uid,
          accountId: leaderAccount.id
        }),
      });

      const parsed = await readJsonOrText(userRes);
      if (!parsed.isJson) {
        throw new Error(`getUserInfo returned non-JSON (status ${userRes.status}) preview: ${parsed.text.slice(0, 200)}`);
      }
      const userData: any = parsed.data;
      let platformUserId = null;
      if (Array.isArray(userData)) {
        platformUserId = userData[0]?.id;
      } else if (userData.id) {
        platformUserId = userData.id;
      } else if (userData.accounts && userData.accounts.length > 0) {
        platformUserId = userData.accounts[0].userId;
      }
      if (!platformUserId) {
        throw new Error(`Failed to get ${leaderPlatform} user ID`);
      }

      logWithTime(`✅ ${leaderPlatform} user ID received:`, platformUserId);
      setTradovateUserId(platformUserId);

      setTimeout(() => {
        logWithTime('🚀 Starting trade copying - credentials ready!');
        setIsStarting(false);
        setIsCopying(true);
      }, 1000);
    } catch (error) {
      errorWithTime('❌ Start Copier failed:', error);
      setIsStarting(false);
    }
  }

  async function stopCopier() {
    logWithTime('🛑 Stop button clicked - initiating cleanup...');

    if (wsRef.current) {
      logWithTime('🔌 IMMEDIATE: Closing leader WebSocket...');
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'Stop button immediate close');
        }
      } catch (error) {
        logWithTime('Error in immediate leader WebSocket close:', error);
      }
      wsRef.current = null;
    }

    if (topstepConnRef.current) {
      logWithTime('🔌 IMMEDIATE: Stopping TopstepX SignalR...');
      await stopTopstepXLeaderSignalR();
    }

    if (volumetricaWsRef.current) {
      logWithTime('🔌 IMMEDIATE: Stopping Volumetrica leader WSS...');
      stopVolumetricaLeaderWss();
    }

    setIsCopying(false);
    setIsStarting(false);
    setConnectionStatus('disconnected');
    setTopstepLeaderStatus('disconnected');
    setTopstepLeaderTokenStatus('Not Active');
    setVolumetricaLeaderStatus('disconnected');
    setVolumetricaLeaderLastError(null);

    setAccessToken(null);
    setTradovateUserId(null);

    processedOrdersRef.current.clear();
    setProcessedOrders(new Set());
    logWithTime('🧹 Cleared processed orders cache');

    // Clear local pending-order tracking
    pendingOrderCopyTriggeredRef.current.clear();
    pendingOrderCopiedAnyLocalRef.current.clear();
    pendingOrderCopiedLocalRef.current.clear();
    volPendingOrderCopyTriggeredRef.current.clear();
    volOrderLastPriceRef.current.clear();
    volLastMarketPriceRef.current.clear();
    volTradovateContractIdCache.current.clear();
    volLeaderPosRef.current = null;

    savedClosedPositions.current.clear();
    logWithTime('🧹 Cleared saved closed positions cache');

    logWithTime('✅ Stop completed - all streams should be closed');

    // Refresh balances/PnL on Stop as well (same as page load), without blocking.
    void refreshAccountsSnapshot({ source: 'stop', showLoading: false });
  }



  const leaderNetPos = leaderPositionData?.netPos ?? 0;

  return (
    <PageContainer scrollable>
      <PageHead title="Tradescale" />
      <div className="pb-8">
        <div className="flex items-center justify-between -mt-5 pb-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Trade Copier
          </h2>
        </div>
        {/* Top summary cards */}
        <div className="grid gap-4 grid-cols-4 mb-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium">Accounts Connected</CardTitle>
              <User className={`h-4 w-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {accountsConnected}
              </div>
              <p className="text-xs text-muted-foreground">
                Number of accounts in rows
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium">Total Capital Connected</CardTitle>
              <DollarSign className={`h-4 w-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(totalCapital)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total balance of all accounts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium">Unrealized P&L, Total</CardTitle>
              <DollarSign className={`h-4 w-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
              {(() => {
                // Calculate total unrealized P&L for all accounts
                let totalUnrealizedPnL = 0;
                
                if (typeof getQuote === 'function') {
                  // ✅ Avoid double-counting leader (accounts list already includes leader)
                  const uniqueAccountIds = new Set<string>();
                  if (leaderAccount?.id != null) uniqueAccountIds.add(String(leaderAccount.id));
                  for (const acc of accounts) {
                    if (acc?.id != null) uniqueAccountIds.add(String(acc.id));
                  }

                  for (const accountId of uniqueAccountIds) {
                    const isLeader = leaderAccount?.id != null && String(leaderAccount.id) === accountId;
                    totalUnrealizedPnL += calculateAccountUnrealizedPnL(accountId, apiPositions, getQuote, followerPositionsData, isLeader ? leaderPositionData : undefined);
                  }
                }
                
                const absVal = Math.abs(totalUnrealizedPnL);
                const formatted = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                let textStyle: any = {};
                
                if (totalUnrealizedPnL > 0) {
                  textStyle = { color: '#416B4E' };
                } else if (totalUnrealizedPnL < 0) {
                  textStyle = { color: '#9a3a3a' };
                }
                
                return (
                  <>
                    <div className="text-2xl font-bold text-white" style={textStyle}>
                      {totalUnrealizedPnL < 0 ? `-$${formatted}` : `$${formatted}`}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Floating P&L across all accounts
                    </p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium">Copier Status</CardTitle>
              <Webhook className={`h-4 w-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {copierStatus}
              </div>
              <p className="text-xs text-muted-foreground">
                Status of trade copying
              </p>
            </CardContent>
          </Card>
        </div>
        {/* Accounts, Orders, Connections */}
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3 flex flex-col gap-3">
            {/* Accounts Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <CardTitle className="text-sm font-medium">Accounts</CardTitle>
                <Maximize className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
  <div className="text-xs text-muted-foreground mb-2">
    All connected trading accounts
  </div>
<div className="flex items-center justify-between mb-6 mt-4">
  {/* Left side: Add Leader & Add Follower */}
  <div className="flex gap-2">
    <Button
      className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white"
      onClick={() => handleOpenPopup('leader')}
    >
  <Archive size={16} className="mr-1 relative" style={{ top: '0.5px' }} />
      Choose Leader
    </Button>
    <Button
      className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white"
      onClick={() => handleOpenPopup('follower')}
    >
      <Plus size={16} className="mr-1 relative" style={{ top: '0.5px' }} />
      Add Follower
    </Button>
  </div>
  {/* Right side: Start Copier & Counter */}
<div className="flex items-center gap-2">
{!isCopying && !isStarting ? (
<Button
  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white"
  onClick={() => { void startCopier(); }}
>
  Start Copier
</Button>
) : isStarting ? (
<Button
  className="h-9 w-auto px-2 bg-transparent border border-white/15 rounded text-white"
  disabled
>
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
    Starting...
  </div>
</Button>
) : (isLeaderTopstepX ? topstepLeaderStatus === 'connected' : isLeaderVolumetrica ? volumetricaLeaderStatus === 'connected' : connectionStatus === 'connected') ? (
  <Button
    size="sm"
    variant="outline"
    className="h-7 border border-red-400 bg-red-200 text-red-800 hover:bg-red-300 hover:text-red-900 rounded dark:border-red-500/20 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 dark:hover:text-red-400"
    onClick={() => { void stopCopier(); }}
  >
    Stop
  </Button>
) : (
  <Button
    className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white"
    onClick={() => { void startCopier(); }}
  >
    Start Copier
  </Button>
)
}
      <span className="text-white text-base font-semibold ml-2">
        {totalAccounts}/{maxAccounts}
      </span>
    </div>
  </div>

      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                <table className="min-w-full text-sm text-white">
                    <thead>
                      <tr className="border border-white/15 bg-transparent rounded-lg">
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 60 }}>Role</th>
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 60 }}>Pos</th>
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 180 }}>Account</th>
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 120 }}>Balance</th>
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 80 }}>Connection</th>
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 80 }}>Firm</th>
                        <th className="px-1 py-2 font-medium text-left" style={{ minWidth: 120 }}>Day Realized P&L</th>
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 100 }}>Unrealized P&L</th>
                        <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 80 }}>Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderTableRows()}
                    </tbody>
                  </table>
<Button
  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#bb9494]/20 transition-transform rounded text-white mt-3 flex items-center gap-2"
  onClick={handleFlattenAllPositions}
  disabled={isFlatteningPositions}
>
  {isFlatteningPositions ? (
    <Loader2 size={16} className="animate-spin" />
  ) : (
    <X size={16} />
  )}
  {isFlatteningPositions ? '' : 'Flatten & Cancel All'}
</Button>
                </div>
              </CardContent>
            </Card>
            {/* Analysis Card - With Daily Realized PnL */}
            
            {/* Orders Card */}
     <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                    <CardTitle className="text-sm font-medium">Live Positions</CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Card / List view toggle */}
                      <div className="flex items-center border border-white/15 rounded overflow-hidden mr-12">
                        <button
                          className={`px-2 py-1.5 flex items-center gap-1 text-xs transition-all ${livePositionsView === 'card' ? 'text-white' : 'bg-transparent text-muted-foreground hover:bg-white/5'}`}
                          style={livePositionsView === 'card' ? { boxShadow: 'inset 0 0 8px 1px rgba(255,255,255,0.15), inset 0 1px 3px rgba(255,255,255,0.1)' } : undefined}
                          onClick={() => setLivePositionsView('card')}
                        >
                          <LayoutGrid className="h-3.5 w-3.5" />
                          Card
                        </button>
                        <button
                          className={`px-2 py-1.5 flex items-center gap-1 text-xs transition-all ${livePositionsView === 'list' ? 'text-white' : 'bg-transparent text-muted-foreground hover:bg-white/5'}`}
                          style={livePositionsView === 'list' ? { boxShadow: 'inset 0 0 8px 1px rgba(255,255,255,0.15), inset 0 1px 3px rgba(255,255,255,0.1)' } : undefined}
                          onClick={() => setLivePositionsView('list')}
                        >
                          <List className="h-3.5 w-3.5" />
                          List
                        </button>
                      </div>
                      <Button
                        className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white flex items-center gap-2"
                        onClick={() => { void handleScanPositions(); }}
                        disabled={!currentUser?.uid || isScanningPositions}
                      >
                        {isScanningPositions ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-label="Scanning" />
                        ) : (
                          <>
                            <Search className="h-4 w-4" aria-hidden="true" />
                            <span>Scan (Refresh)</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground mb-2">
                      Shows current open positions & manual closing option
                    </div>
                      {leaderPositionData || followerPositionsData.size > 0 ? (
                        livePositionsView === 'card' ? (
                        <div className="flex flex-wrap gap-3">
                          {/* Leader Position Card - Always First */}
                          {leaderPositionData && (
                            <div className="border border-white/20 rounded-lg p-3 min-w-[200px] bg-white/5">
                              <div className="text-xs font-semibold text-white mb-2 truncate">
                                {leaderAccount?.name || 'Leader'}
                              </div>
                              <div className="text-sm font-medium text-white">
                                {leaderNetPos > 0 ? 'Buy' : 'Sell'} {Math.abs(leaderNetPos)} {leaderPositionData.symbol || 'N/A'} @{leaderPositionData.avgEntryPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </div>
                            </div>
                          )}
    
                          {/* Follower Position Cards */}
                          {Array.from(followerPositionsData.values()).map(followerPos => {
                            const netPos = followerPos.netPos ?? 0;
                            const isClosing = manualCloseInFlight.has(followerPos.accountId);
                            return (
                              <div key={followerPos.accountId} className="border border-white/20 rounded-lg p-3 min-w-[200px] bg-white/5">
                                <div className="text-xs font-semibold text-white mb-2 truncate">
                                  {followerPos.accountName || 'Follower'}
                                </div>
                                <div className="text-sm font-medium text-white">
                                  {netPos > 0 ? 'Buy' : 'Sell'} {Math.abs(netPos)} {followerPos.symbol || 'N/A'} @{followerPos.avgEntryPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                </div>
    
                                <div className="mt-3">
                                  <Button
                                    className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#bb9494]/20 transition-transform rounded text-white flex items-center gap-2"
                                    onClick={() => { void handleCloseFollowerPositionManually(followerPos.accountId); }}
                                    disabled={isClosing || !currentUser?.uid}
                                  >
                                    {isClosing ? (
                                      <Loader2 className="h-4 w-4 animate-spin" aria-label="Closing" />
                                    ) : (
                                      'Close Manually'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        ) : (
                        /* ── List View ── */
                        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                          <table className="min-w-full text-sm text-white">
                            <thead>
                              <tr className="border border-white/15 bg-transparent rounded-lg">
                                <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 60 }}>Pos</th>
                                <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 180 }}>Account</th>
                                <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 100 }}>Symbol</th>
                                <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 60 }}>QTY</th>
                                <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 60 }}>Side</th>
                                <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 100 }}>Price</th>
                                <th className="px-2 py-2 font-medium text-left" style={{ minWidth: 60 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Leader row */}
                              {leaderPositionData && (() => {
                                const pos = leaderNetPos;
                                return (
                                  <tr className="border-b border-white/10">
                                    <td className="px-2 py-2">I</td>
                                    <td className="px-2 py-2">
                                      <span className="inline-block border border-white/20 rounded px-2 py-1 text-white text-xs">
                                        {leaderAccount?.name || 'Leader'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">{leaderPositionData.symbol || 'N/A'}</td>
                                    <td className="px-2 py-2">{Math.abs(pos)}</td>
                                    <td className="px-2 py-2">
                                      <span className={pos > 0 ? 'text-[#416B4E]' : 'text-[#9a3a3a]'}>
                                        {pos > 0 ? 'Buy' : 'Sell'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">
                                      {leaderPositionData.avgEntryPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                    </td>
                                    <td className="px-2 py-2"></td>
                                  </tr>
                                );
                              })()}
                              {/* Follower rows */}
                              {Array.from(followerPositionsData.values()).map((followerPos, idx) => {
                                const netPos = followerPos.netPos ?? 0;
                                const isClosing = manualCloseInFlight.has(followerPos.accountId);
                                return (
                                  <tr key={followerPos.accountId} className="border-b border-white/10">
                                    <td className="px-2 py-2">{romanNumerals[idx + 1]}</td>
                                    <td className="px-2 py-2">
                                      <span className="inline-block border border-white/20 rounded px-2 py-1 text-white text-xs">
                                        {followerPos.accountName || 'Follower'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">{followerPos.symbol || 'N/A'}</td>
                                    <td className="px-2 py-2">{Math.abs(netPos)}</td>
                                    <td className="px-2 py-2">
                                      <span className={netPos > 0 ? 'text-[#416B4E]' : 'text-[#9a3a3a]'}>
                                        {netPos > 0 ? 'Buy' : 'Sell'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">
                                      {followerPos.avgEntryPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                    </td>
                                    <td className="px-2 py-2">
                                      <Button
                                        className="h-7 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#bb9494]/20 transition-transform rounded text-white text-xs"
                                        onClick={() => { void handleCloseFollowerPositionManually(followerPos.accountId); }}
                                        disabled={isClosing || !currentUser?.uid}
                                      >
                                        {isClosing ? (
                                          <Loader2 className="h-3 w-3 animate-spin" aria-label="Closing" />
                                        ) : (
                                          'Close'
                                        )}
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        )
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-3">
                          <button className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors">
                            <Eye className="h-5 w-5 text-muted-foreground" />
                          </button>
                          Live Positions will appear here <br /> once the copier is turned on
                        </div>
                      )}
                    </CardContent>
                  </Card>

              <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-4">
                  Shows current pending orders [Limit/Stop] <br />Leader pending orders only show on placement
                </div>
                {(() => {
                  // Helper function to check if an order is pending (not market)
                  const isPendingOrder = (label?: string, orderTypeLabel?: string): boolean => {
                    const orderLabel = label || orderTypeLabel || '';
                    // Only show Limit and Stop orders, exclude Market orders
                    return /\b(Limit|Stop)\b/i.test(orderLabel);
                  };

                  // Get leader account
                  if (!leaderAccount) {
                    return (
                      <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-3">
                        <div>No account configured</div>
                      </div>
                    );
                  }

                  const cards: any[] = [];

                  // Helper to render account order card with multiple orders stacked
                  const renderAccountCard = (account: any, isLeader: boolean) => {
                    let ordersToDisplay: any[] = [];

                    if (isLeader) {
                      // Show all leader orders stacked
                      if (latestLeaderOrders && latestLeaderOrders.length > 0) {
                        ordersToDisplay = latestLeaderOrders.filter(order => isPendingOrder(order?.label));
                      }
                    } else {
                      const followerOrders = followerLatestOrders.get(String(account.id)) ?? [];
                      // Only show truly-pending follower orders. Filled snapshots may still contain
                      // words like "Limit"/"Stop" in their labels, so gate on `isPending`.
                      ordersToDisplay = followerOrders.filter(order =>
                        order?.isPending === true && isPendingOrder(order?.orderTypeLabel, order?.direction)
                      );
                    }

                    if (!ordersToDisplay || ordersToDisplay.length === 0) return null;

                    return (
                      <div
                        key={`order_card_${account.id}`}
                        className="border border-white/20 rounded-lg p-3 min-w-[200px] bg-white/5"
                      >
                        {/* Account name */}
                        <div className="text-xs font-semibold text-white mb-3 truncate">
                          {account.name}
                        </div>

                        {/* Stack all orders vertically */}
                        <div className="space-y-3">
                          {ordersToDisplay.map((order, idx) => {
                            const fillPrice = order.price !== undefined
                              ? `(${Number(order.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                              : '';

                            const timestamp = order.timestamp;
                            const timeString = timestamp
                              ? new Date(timestamp).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                })
                              : 'Pending';

                            const symbol = order.symbol || '';
                            const qty = order.qty ?? '';
                            const label = isLeader ? (order.label || '') : (order.orderTypeLabel || order.direction || '');

                            const rowKey = (() => {
                              if (isLeader) {
                                const id = (order as any)?.orderId;
                                return `leader_${String(id ?? idx)}`;
                              }
                              const fid = (order as any)?.followerOrderId;
                              const lid = (order as any)?.leaderOrderId;
                              if (fid != null) return `follower_${String(account.id)}_${String(fid)}`;
                              if (lid != null) return `follower_${String(account.id)}_leader_${String(lid)}`;
                              return `follower_${String(account.id)}_${String(order.symbol ?? '')}_${String(order.timestamp ?? '')}_${idx}`;
                            })();

                            return (
                              <div key={rowKey} className="border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
                                {/* Order summary */}
                                <div className="text-sm font-medium text-white mb-1">
                                  {label} {qty} {symbol} @{fillPrice}
                                </div>
                                {/* Time */}
                                <div className="text-xs text-muted-foreground">
                                  {timeString}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Balance at bottom */}
                        <div className="text-xs mt-3 pt-3 border-t border-white/10 flex justify-between">
                          <span className="text-muted-foreground">Balance:</span>
                          <span className="text-white font-medium">
                            {formatCurrency(Number(account.balance) || 0)}
                          </span>
                        </div>
                      </div>
                    );
                  };

                  // Render leader card
                  const leaderCard = renderAccountCard(leaderAccount, true);
                  if (leaderCard) cards.push(leaderCard);

                  // Render follower cards
                  for (const follower of followers) {
                    const followerCard = renderAccountCard(follower, false);
                    if (followerCard) cards.push(followerCard);
                  }

                  // If no pending orders
                  if (cards.length === 0) {
                    // Show canceled order if available, otherwise show empty state
                    if (canceledLeaderOrder) {
                      return (
                        <div className="flex flex-wrap gap-3">
                          <div
                            className="border border-red-900/50 rounded-lg p-3 min-w-[200px] bg-red-900/10"
                          >
                            <div className="text-xs font-semibold text-red-400 mb-2">
                              {leaderAccount?.name}
                            </div>
                            <div className="text-sm font-medium text-white mb-3">
                              {canceledLeaderOrder.label} Canceled
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(() => {
                                const t = new Date(canceledLeaderOrder.timestamp);
                                return t.toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                });
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-3">
                        <button className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors">
                          <Eye className="h-5 w-5 text-muted-foreground" />
                        </button>
                        Pending orders will appear here <br /> once the copier places them
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-wrap gap-3">
                      {cards}
                      {canceledLeaderOrder && (
                        <div
                          className="border border-red-900/50 rounded-lg p-3 min-w-[200px] bg-red-900/10"
                        >
                          <div className="text-xs font-semibold text-red-400 mb-2">
                            {leaderAccount?.name}
                          </div>
                          <div className="text-sm font-medium text-white mb-3">
                            {canceledLeaderOrder.label} Canceled
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(() => {
                              const t = new Date(canceledLeaderOrder.timestamp);
                              return t.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
          {/* Right side cards */}
          <div className="space-y-3">
            {/* Connections card */}
            <Card className="flex flex-col">
              <CardHeader className="flex flex-col items-start space-y-1 pb-0">
                <div className="flex flex-row items-center justify-between w-full">
                  <CardTitle className="text-sm font-medium">Connections</CardTitle>
                  <Link className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Go to Connect Page to add your accounts
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  <AccountsCardList />
                </div>
              </CardContent>
            </Card>

            {/* Connection Details Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                <CardTitle className="text-sm font-medium">Connection details</CardTitle>
                <BatteryPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="mt-4">
                <div className="space-y-4">
                  {/* Leader Account Name */}
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-muted-foreground w-32">Leader Account Name</div>
                    <div className="h-9 px-3 bg-transparent border border-white/15 rounded flex items-center justify-between text-white text-sm whitespace-nowrap">
                      <span>{leaderAccount?.name || 'None'}</span>
                      {leaderAccount && copierStatus === "On" && (
                        <span className="text-green-400 ml-2">✓</span>
                      )}
                    </div>
                  </div>

                  {/* Leader Stream */}
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-muted-foreground w-32">Leader Stream</div>
                    <div className="h-9 px-3 bg-transparent border border-white/15 rounded flex items-center justify-between text-white text-sm whitespace-nowrap">
                      <span>
                        {isLeaderTopstepX
                          ? (topstepLeaderStatus === 'connected' ? 'SignalR Connected' : topstepLeaderStatus === 'connecting' ? 'SignalR Connecting' : 'Not Active')
                          : isLeaderVolumetrica
                            ? (volumetricaLeaderStatus === 'connected' ? 'WSS Connected' : volumetricaLeaderStatus === 'connecting' ? 'WSS Connecting' : volumetricaLeaderStatus === 'error' ? 'Error' : 'Not Active')
                            : (tradovateUserId ? 'Valid' : 'Not Active')}
                      </span>
                      {((isLeaderTopstepX && topstepLeaderStatus === 'connected') || (isLeaderVolumetrica && volumetricaLeaderStatus === 'connected') || (!isLeaderTopstepX && !isLeaderVolumetrica && tradovateUserId)) && copierStatus === "On" && (
                        <span className="text-green-400 ml-2">✓</span>
                      )}
                    </div>
                  </div>

                  {/* Token */}
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-muted-foreground w-32">{isLeaderTopstepX ? 'JWT Token' : isLeaderVolumetrica ? 'WSS Token' : 'Access Token'}</div>
                    <div className="h-9 px-3 bg-transparent border border-white/15 rounded flex items-center justify-between text-white text-sm whitespace-nowrap">
                      <span>
                        {isLeaderTopstepX
                          ? topstepLeaderTokenStatus
                          : isLeaderVolumetrica
                            ? (volumetricaLeaderStatus === 'connected' || volumetricaLeaderStatus === 'connecting' ? 'Valid' : 'Not Active')
                            : (accessToken ? 'Valid' : 'Not Active')}
                      </span>
                      {((isLeaderTopstepX && topstepLeaderTokenStatus === 'Valid') || (isLeaderVolumetrica && volumetricaLeaderStatus === 'connected') || (!isLeaderTopstepX && !isLeaderVolumetrica && accessToken)) && copierStatus === "On" && (
                        <span className="text-green-400 ml-2">✓</span>
                      )}
                    </div>
                  </div>

                  {/* Tradovate WebSocket Connection (only relevant for Tradovate leaders) */}
                  {!isLeaderTopstepX && !isLeaderVolumetrica && (
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-muted-foreground w-32">Connection</div>
                      <div className="h-9 px-3 bg-transparent border border-white/15 rounded flex items-center justify-between text-white text-sm whitespace-nowrap">
                        <span>{connectionStatus === 'connected' ? 'Connected' :
                         connectionStatus === 'connecting' ? 'Connecting' : 'Not Active'}</span>
                        {connectionStatus === 'connected' && copierStatus === "On" && (
                          <span className="text-green-400 ml-2">✓</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Live Market Data Test Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium mb-2">Live Market Data</CardTitle>
                <LineChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {Object.keys(quotes).length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-2">Waiting for data...</div>
                ) : (
                  <div className="space-y-2">
                    {Object.values(quotes).map((quote) => (
                      <div key={quote.contractId} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{quote.symbolName}</span>
                        <span className="text-sm font-medium text-white">
                          ${quote.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
        {/* Account selection popup */}
<Dialog open={showAccountPopup} onOpenChange={setShowAccountPopup}>
  <DialogContent className="sm:max-w-[425px] bg-[#18181b] bg-black border border-white/15 rounded-lg shadow-2xl">
    <DialogHeader>
      <DialogTitle>
        <span className="text-lg font-semibold">Select {popupType === "leader" ? "Leader" : "Follower"} Account</span>
      </DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pr-2">
        <AccountsCardListSelect
          onSelect={setSelectedAccount}
          selectedId={selectedAccount?.id}
          excludeIds={popupType === 'leader' ? followerIds : (leaderAccount ? [leaderAccount.id] : []).concat(followerIds)}
          popupType={popupType}
        />
      </div>
    </div>
<div className="flex justify-end mt-4">
  <Button
    onClick={handleChooseAccount}
    disabled={!selectedAccount || (popupType === 'follower' && totalAccounts >= maxAccounts)}
    className={
      (!selectedAccount || (popupType === 'follower' && totalAccounts >= maxAccounts))
        ? "h-9 w-auto px-2 bg-transparent border border-white/15 text-gray-400"
        : "h-9 w-auto px-2 bg-transparent border border-white/15 text-white hover:bg-[#94bba3]/20 transition-transform"
    }
  >
    Choose
  </Button>
  <Button
    variant="outline"
    className="h-9 w-auto px-2 bg-transparent border border-white/15 text-white hover:bg-[#94bba3]/20 transition-transform ml-2"
    onClick={() => setShowAccountPopup(false)}
  >
    Cancel
  </Button>
</div>
  </DialogContent>
</Dialog>

        {/* Ratio selection popup */}
<Dialog open={showRatioPopup} onOpenChange={setShowRatioPopup}>
  <DialogContent className="sm:max-w-[425px] bg-[#18181b] bg-black border border-white/15 rounded-lg shadow-2xl">
    <DialogHeader>
      <DialogTitle>
        <span className="text-lg font-semibold">Set Ratio for {selectedFollowerForRatio?.name}</span>
      </DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-2">
      <div className="text-sm text-gray-400">
        Choose how many contracts this follower should trade relative to the leader.
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white">Ratio:</span>
        <input
          type="number"
          min="1"
          max="100"
          value={tempRatio}
          onChange={(e) => setTempRatio(Math.max(1, parseInt(e.target.value) || 1))}
          readOnly
          className="w-20 px-2 py-1 bg-transparent border border-white/15 rounded text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          style={{
            MozAppearance: 'textfield',
            WebkitAppearance: 'none',
            appearance: 'none'
          }}
        />
        <div className="flex flex-col ml-1">
          <button
            type="button"
            onClick={() => setTempRatio(prev => Math.min(100, prev + 1))}
            className="w-4 h-3 flex items-center justify-center text-white hover:text-[#94bba3] transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setTempRatio(prev => Math.max(1, prev - 1))}
            className="w-4 h-3 flex items-center justify-center text-white hover:text-[#94bba3] transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <span className="text-white">x</span>
      </div>
      <div className="text-xs">
        <div className="text-white">Example:</div>
        <div className="text-gray-400 mt-1">If leader buys 1 contract</div>
        <div className="text-gray-400">This follower will buy {tempRatio} contract{tempRatio > 1 ? 's' : ''}</div>
      </div>
    </div>
    <div className="flex justify-end mt-4">
      <Button
        onClick={handleSaveRatio}
        className="h-9 w-auto px-2 bg-transparent border border-white/15 text-white hover:bg-[#94bba3]/20 transition-transform"
      >
        Save
      </Button>
    </div>
  </DialogContent>
</Dialog>

        {/* ✅ NEW: Follower details popup */}
<Dialog open={showFollowerPopup} onOpenChange={setShowFollowerPopup}>
  <DialogContent className="sm:max-w-[600px] bg-[#18181b] bg-black border border-white/15 rounded-lg shadow-2xl">
    <DialogHeader>
      <DialogTitle>
        <span className="text-lg font-semibold">Positions Details ┃ Active Followers [ {selectedPositionFollowers.length - 1} ]</span>
      </DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-2">
      {/* ✅ NEW: Total cumulative PnL section */}
      <div className="mb-4">
        <span className="px-3 py-2 rounded text-xs bg-transparent text-white border border-white/20">
          Total cumulative PnL: <span className={`text-lg font-semibold ml-1 ${(() => {
            // Calculate total PnL from all positions (leader + followers)
            const totalPnL = selectedPositionFollowers
              .filter((position: any) => position.status === 'closed' && position.pnl !== undefined)
              .reduce((sum: number, position: any) => sum + position.pnl, 0);
            
            return totalPnL > 0 
              ? 'text-emerald-400'
              : totalPnL < 0 
              ? 'text-red-400'
              : 'text-white';
          })()}`}>
            {(() => {
              const totalPnL = selectedPositionFollowers
                .filter((position: any) => position.status === 'closed' && position.pnl !== undefined)
                .reduce((sum: number, position: any) => sum + position.pnl, 0);
              
              return totalPnL > 0 
                ? `+$${totalPnL.toFixed(2)}` 
                : totalPnL < 0 
                ? `-$${Math.abs(totalPnL).toFixed(2)}`
                : '$0.00';
            })()}
          </span>
        </span>
      </div>
      <div className="text-sm text-gray-400 mb-4">
        All accounts that were active for this position (leader + followers)
      </div>
      <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <div className="space-y-2">
          {selectedPositionFollowers.map((follower: any, idx: number) => {
            const followerRatio = followerRatios.get(follower.accountId.toString()) || 1;
            return (
              <div key={follower.accountId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-6">
                    {romanNumerals[idx] || `${idx + 1}`}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{follower.accountName}</span>
                      {follower.isLeader && (
                        <span className="px-2 py-1 rounded text-xs bg-[#94bba3]/20 text-white border border-white/15 flex items-center justify-center">
                          LEADER
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">ID: {follower.accountId}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-gray-400 text-xs">Ratio</div>
                    <div className="text-white">{followerRatio}x</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-400 text-xs">Quantity</div>
                    <div className="text-white">
                      {follower.status === 'closed' 
                        ? Math.max(follower.totalBought, follower.totalSold)
                        : Math.abs(follower.netPosition)}
                    </div>
                  </div>
                  {follower.status === 'closed' && follower.pnl !== undefined && (
                    <div className="text-center">
                      <div className="text-gray-400 text-xs">PnL</div>
                      <div className={`${follower.pnl > 0 ? 'text-emerald-400' : follower.pnl < 0 ? 'text-red-400' : 'text-white'}`}>
                        {follower.pnl > 0 ? `+$${follower.pnl.toFixed(2)}` : `-$${Math.abs(follower.pnl).toFixed(2)}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    <div className="flex justify-end mt-4">
      <Button
        variant="outline"
        className="h-9 w-auto px-4 bg-transparent border border-white/15 text-white hover:bg-[#94bba3]/20 transition-transform"
        onClick={() => setShowFollowerPopup(false)}
      >
        Close
      </Button>
    </div>
  </DialogContent>
</Dialog>

      {/* ✅ Invalid Token Dialog */}
      <Dialog
        open={showInvalidTokenDialog}
        onOpenChange={(open) => {
          setShowInvalidTokenDialog(open);
          if (!open) setInvalidTokenAccounts([]);
        }}
      >
        <DialogContent>
          <div className="flex flex-col items-center justify-center py-6">
            <img src={LG34} alt="Account Access Expired" className="w-16 h-16 mb-4" />
            <div className="text-lg font-semibold text-center mb-2">
              Issue in automatic account re-authorization
            </div>
            <div className="text-sm text-muted-foreground text-center mb-4">
              One or more connected accounts need to be re-authorized:
            </div>
            
            <div className="space-y-2 mb-6 w-full max-h-96 overflow-y-auto">
              {invalidTokenAccounts.map((account, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-transparent border border-white/15 rounded">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <img src={TLGO} alt="Tradovate" className="w-8 h-8 object-contain rounded" />
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {String(account?.accountName ?? account?.name ?? account?.accountId ?? `Account ${index + 1}`)}
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
              To reconnect, go to <b>"Connect Accounts"</b> and re-authorize your accounts.
            </div>
            
            <Button
              onClick={() => setShowInvalidTokenDialog(false)}
              className="h-9 px-6 bg-transparent border border-white/15 hover:bg-[#94bba3]/20"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  </PageContainer>
);
}