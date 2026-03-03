import { useEffect, useState } from 'react';
import { useAuth } from '@/context/FAuth';
import { useTheme } from '@/providers/theme-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NONmatchLogo from '@/assets/images/NONEmatch.png';
import TLGO from '@/assets/images/tradovate.png';
import TPTX from '@/assets/images/topstepX.jpg';
import TPTXLight from '@/assets/images/topstepXlight.png';
import VolumetricaLogo from '@/assets/images/volumetrica.png';

// Firm logo imports
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

const formatCurrency = (value: number) => {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export default function AccountsCardList() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
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
        const data = await res.json();
        // Filter to only show accounts (with platform field), exclude expenses/payouts
        const accountsOnly = (data.finances || []).filter((f: any) => f.platform);
        setAccounts(accountsOnly);
      }
    }
    fetchAccounts();
  }, [currentUser?.uid]);

  return (
    <div className="grid gap-3">
      {accounts.map(acc => (
        <Card key={acc.id}>
          <CardHeader className="flex flex-row items-center gap-3 pb-0">
            {acc.firm && FIRM_LOGOS[acc.firm] ? (
              <img
                src={FIRM_LOGOS[acc.firm]}
                alt={acc.firm + " Logo"}
                className="w-10 h-10 object-contain rounded border border-white/30"
              />
            ) : (
              <img
                src={
                  acc.platform === "Tradovate" ? TLGO :
                  acc.platform === "TopstepX" ? (theme === 'light' ? TPTXLight : TPTX) :
                  acc.platform === "Volumetrica" ? VolumetricaLogo :
                  NONmatchLogo
                }
                alt="Account Logo"
                className={`${acc.platform === "TopstepX" ? "w-17 h-7" : "w-8 h-8"} object-contain rounded ${acc.platform === "Tradovate" || acc.platform === "TopstepX" || acc.platform === "Volumetrica" ? "" : "border border-white/30"}`}
              />
            )}
            <CardTitle className="text-base font-semibold">{acc.name}</CardTitle>
          </CardHeader>
<CardContent>
  <div className="flex items-center gap-2 text-sm text-white">
    Balance: <span className="font-bold">{formatCurrency(Number(acc.balance) || 0)}</span>
    {/* Platform logo next to balance */}
    <div className="flex items-center gap-1 ml-2">
      <img
        src={
          acc.platform === "Tradovate" ? TLGO :
          acc.platform === "TopstepX" ? (theme === 'light' ? TPTXLight : TPTX) :
          acc.platform === "Volumetrica" ? VolumetricaLogo :
          acc.logo
        }
        alt="Account Logo"
        className={`inline-block ${acc.platform === "TopstepX" ? "w-17 h-7" : "w-6 h-6"} object-contain align-middle ${acc.platform === "Tradovate" || acc.platform === "TopstepX" || acc.platform === "Volumetrica" ? "" : "border border-white/30 rounded"}`}
      />
      {acc.platform === "Tradovate" && <span className="text-sm">Tradovate</span>}
      {acc.platform === "Volumetrica" && <span className="text-sm">Volumetrica</span>}
    </div>
  </div>
</CardContent>
        </Card>
      ))}
    </div>
  );
}