// Shared server-side version of matchFillsToPositions
// Move logic from Tradecalc.tsx to here for use in cron job

const FUTURES_CONTRACT_MULTIPLIER = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5, CL: 1000, QM: 500, NG: 10000, QG: 2500, GC: 100, MGC: 10, SI: 5000, SIL: 1000, HG: 25000, LE: 40000, HE: 40000, ZB: 1000, ZN: 1000, ZF: 1000, ZT: 1000, UB: 1000, FGBL: 1000, FGBM: 1000, FGBS: 1000, FGBX: 1000, FDAX: 25, FDXM: 5, FESX: 10, FSTX: 5, "6E": 125000, "6A": 100000, "6B": 62500, "6C": 100000, "6J": 12500000, "6S": 125000, "6M": 500000, "6N": 100000, "6Z": 500000, ZC: 5000, ZS: 5000, ZW: 5000, ZO: 5000, ZR: 2000, ZL: 60000, ZM: 100, KC: 37500, SB: 112000, CT: 50000, CC: 10, OJ: 15000 };
const FUTURES_CONTRACT_FEES = {
  ES: 2.05, MES: 0.95, NQ: 1.55, MNQ: 0.52, YM: 1.80, MYM: 0.52, RTY: 2.05, M2K: 0.52, CL: 2.80, QM: 1.40, NG: 2.80, QG: 1.40, GC: 2.80, MGC: 1.30, SI: 2.80, SIL: 1.40, HG: 2.80, LE: 2.80, HE: 2.80, ZB: 1.80, ZN: 1.80, ZF: 1.80, ZT: 1.80, UB: 1.80, FGBL: 1.80, FGBM: 1.80, FGBS: 1.80, FGBX: 1.80, FDAX: 2.50, FDXM: 1.20, FESX: 1.20, FSTX: 1.20, "6E": 1.80, "6A": 1.80, "6B": 1.80, "6C": 1.80, "6J": 1.80, "6S": 1.80, "6M": 1.80, "6N": 1.80, "6Z": 1.80, ZC: 1.80, ZS: 1.80, ZW: 1.80, ZO: 1.80, ZR: 1.80, ZL: 1.80, ZM: 1.80, KC: 2.80, SB: 2.80, CT: 2.80, CC: 2.80, OJ: 2.80 };

const FIRM_FUTURES_CONTRACT_FEE_OVERRIDES = {
  "Apex Trader Funding": {},
  "MyFundedFutures": {},
  "Take Profit Trader": {},
  "Tradeify": {},
  "Alpha Futures": {},
  "Top One Futures": {},
  "Funding Ticks": {},
  "Funded Next Futures": {},
  "Aqua Futures": {},
  "Topstep": {},
  "Lucid": {},
  "Other": {},
};

function getFeePerSide(baseSymbol, firm) {
  const key = firm ? String(firm).trim() : "";
  const overrides = key ? FIRM_FUTURES_CONTRACT_FEE_OVERRIDES[key] : undefined;
  const override = overrides ? overrides[baseSymbol] : undefined;
  if (typeof override === 'number') return override;
  return FUTURES_CONTRACT_FEES[baseSymbol] || 0;
}

function getBaseSymbol(symbol) {
  if (!symbol) return '';
  symbol = symbol.toUpperCase();
  const bases = Object.keys(FUTURES_CONTRACT_MULTIPLIER).sort((a, b) => b.length - a.length);
  for (const base of bases) {
    if (symbol.includes(base)) return base;
  }
  return symbol;
}

function matchFillsToPositions(fills, includeAllDates = false, options) {
  const today = new Date();
  const isToday = (timestamp) => {
    const fillDate = new Date(timestamp);
    return (
      fillDate.getFullYear() === today.getFullYear() &&
      fillDate.getMonth() === today.getMonth() &&
      fillDate.getDate() === today.getDate()
    );
  };
  const todaysFills = includeAllDates ? fills : fills.filter(fill => isToday(fill.timestamp));
  const grouped = {};
  todaysFills.forEach(fill => {
    const symbol = fill.contract?.name || fill.contractSymbol || fill.symbol;
    if (!grouped[symbol]) grouped[symbol] = [];
    grouped[symbol].push(fill);
  });
  const closedPositions = [];
  Object.entries(grouped).forEach(([symbol, symbolFills]) => {
    symbolFills.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const baseSymbol = getBaseSymbol(symbol);
    const contractMultiplier = FUTURES_CONTRACT_MULTIPLIER[baseSymbol] || 1;
    const feePerSide = getFeePerSide(baseSymbol, options && options.firm);
    // Tradovate-style position tracking
    let positionQty = 0;
    let avgEntryPrice = 0;
    let entryTime = null;
    let entryFills = [];
    let positionSide = null; // 'long' or 'short'
    // Accumulator to aggregate partial closes so we emit a single closed position
    // for the original entry when it is fully closed.
    let closingAccumulator = null;
    for (const fill of symbolFills) {
      const qty = fill.qty;
      const action = fill.action.toLowerCase();
      const price = fill.price;
      const timestamp = fill.timestamp;
      const contract = fill.contract || {};

      // Determine if this is opening or closing
      if (action === 'buy') {
        if (positionQty === 0) {
          // New long position
          positionSide = 'long';
          avgEntryPrice = price;
          positionQty = qty;
          entryTime = timestamp;
          entryFills = [fill];
          closingAccumulator = null;
        } else if (positionSide === 'long') {
          // Add to long position
          avgEntryPrice = (avgEntryPrice * positionQty + price * qty) / (positionQty + qty);
          positionQty += qty;
          entryFills.push(fill);
        } else if (positionSide === 'short') {
          // Buy to cover short position (close part/all)
          const closedQty = Math.min(positionQty, qty);
          const grossPnl = (avgEntryPrice - price) * closedQty * contractMultiplier;
          const fees = closedQty * 2 * feePerSide;
          const pnl = grossPnl - fees;
          // Initialize accumulator if needed
          if (!closingAccumulator) {
            closingAccumulator = {
              symbol: contract.symbol || symbol,
              contractName: contract.name || symbol,
              entryPrice: avgEntryPrice,
              totalClosedQty: 0,
              weightedExitPrice: 0,
              entryTime: entryTime,
              exitTime: null,
              pnl: 0,
              contract,
            };
          }
          // accumulate weighted exit price and pnl
          const prevQty = closingAccumulator.totalClosedQty;
          closingAccumulator.weightedExitPrice = (closingAccumulator.weightedExitPrice * prevQty + price * closedQty) / (prevQty + closedQty);
          closingAccumulator.totalClosedQty += closedQty;
          closingAccumulator.exitTime = timestamp;
          closingAccumulator.pnl += pnl;

          positionQty -= closedQty;
          if (positionQty === 0) {
            // emit a single aggregated closed position for this entry
            closedPositions.push({
              symbol: closingAccumulator.symbol,
              contractName: closingAccumulator.contractName,
              entryPrice: closingAccumulator.entryPrice,
              exitPrice: closingAccumulator.weightedExitPrice,
              qty: closingAccumulator.totalClosedQty,
              entryTime: closingAccumulator.entryTime,
              exitTime: closingAccumulator.exitTime,
              pnl: closingAccumulator.pnl,
              contract: closingAccumulator.contract,
            });
            // reset
            avgEntryPrice = 0;
            entryTime = null;
            entryFills = [];
            positionSide = null;
            closingAccumulator = null;
          }
        }
      } else if (action === 'sell') {
        if (positionQty === 0) {
          // New short position
          positionSide = 'short';
          avgEntryPrice = price;
          positionQty = qty;
          entryTime = timestamp;
          entryFills = [fill];
          closingAccumulator = null;
        } else if (positionSide === 'short') {
          // Add to short position
          avgEntryPrice = (avgEntryPrice * positionQty + price * qty) / (positionQty + qty);
          positionQty += qty;
          entryFills.push(fill);
        } else if (positionSide === 'long') {
          // Sell to close long position (close part/all)
          const closedQty = Math.min(positionQty, qty);
          const grossPnl = (price - avgEntryPrice) * closedQty * contractMultiplier;
          const fees = closedQty * 2 * feePerSide;
          const pnl = grossPnl - fees;
          if (!closingAccumulator) {
            closingAccumulator = {
              symbol: contract.symbol || symbol,
              contractName: contract.name || symbol,
              entryPrice: avgEntryPrice,
              totalClosedQty: 0,
              weightedExitPrice: 0,
              entryTime: entryTime,
              exitTime: null,
              pnl: 0,
              contract,
            };
          }
          const prevQty = closingAccumulator.totalClosedQty;
          closingAccumulator.weightedExitPrice = (closingAccumulator.weightedExitPrice * prevQty + price * closedQty) / (prevQty + closedQty);
          closingAccumulator.totalClosedQty += closedQty;
          closingAccumulator.exitTime = timestamp;
          closingAccumulator.pnl += pnl;

          positionQty -= closedQty;
          if (positionQty === 0) {
            closedPositions.push({
              symbol: closingAccumulator.symbol,
              contractName: closingAccumulator.contractName,
              entryPrice: closingAccumulator.entryPrice,
              exitPrice: closingAccumulator.weightedExitPrice,
              qty: closingAccumulator.totalClosedQty,
              entryTime: closingAccumulator.entryTime,
              exitTime: closingAccumulator.exitTime,
              pnl: closingAccumulator.pnl,
              contract: closingAccumulator.contract,
            });
            avgEntryPrice = 0;
            entryTime = null;
            entryFills = [];
            positionSide = null;
            closingAccumulator = null;
          }
        }
      }
    }
  });
  return closedPositions;
}

module.exports = { matchFillsToPositions };
