 'use client';

import React from 'react';
import PageHead from '@/components/shared/page-head';
import { useEffect, useRef, useState } from 'react';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { loadTradesFromFirestore, useTradeStore } from '@/components/shared/datastore';
import type { Trade } from '@/components/shared/datastore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CornerUpLeft, Plus, Trash2, Pencil, X, Edit, Loader2, GitFork } from 'lucide-react';
import { useAuth } from '@/context/FAuth';
import { useTheme } from '@/providers/theme-provider';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageContainer from '@/components/layout/page-container';
import { Star } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

function useAllTrades() {
  const { currentUser } = useAuth();
  const trades = useTradeStore(state => state.trades);
  const [myfxbookTrades, setMyfxbookTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (currentUser) loadTradesFromFirestore();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/myfxbook?userId=${currentUser.uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const accounts = data.accounts || [];
      let fetched: Trade[] = [];
      for (const acc of accounts) {
        if (!acc.accountId) continue;
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/myfxbook?userId=${currentUser.uid}&trades=1&accountId=${acc.accountId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (Array.isArray(data.history)) {
          fetched = fetched.concat(
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
      setMyfxbookTrades(fetched);
    })();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return setAllTrades([]);
    const manualTrades = trades.filter(trade => trade.userId === currentUser.uid && trade.source !== 'myfxbook');
    const firestoreMap = new Map(trades.map(t => [t.id, t]));
    const mergedMyfxbook = myfxbookTrades.map(trade => {
      const firestoreDoc = firestoreMap.get(trade.id);
      return {
        ...trade,
        screenshot: firestoreDoc?.screenshot || '',
        description: firestoreDoc?.description || '',
        screenshotHeadline: firestoreDoc?.screenshotHeadline || '',
        screenshot2: firestoreDoc?.screenshot2 || '',
        screenshot2Description: firestoreDoc?.screenshot2Description || '',
        screenshot2Headline: firestoreDoc?.screenshot2Headline || '',
      };
    });
    setAllTrades([...manualTrades, ...mergedMyfxbook]);
  }, [trades, myfxbookTrades, currentUser]);

  return allTrades;
}



const groupTradesByMonth = (trades: Trade[]) => {
  const groups: { [key: string]: Trade[] } = {};
  trades.forEach(trade => {
    // Use split to avoid timezone issues
    const [yyyy, mm] = trade.date.split('-');
    const date = new Date(Number(yyyy), Number(mm) - 1, 1);
    const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(trade);
  });
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => b.date.localeCompare(a.date));
  });
  return groups;
};

const MonthGrid = ({ months, onMonthSelect }: { 
  months: { monthYear: string, trades: Trade[] }[], 
  onMonthSelect: (monthYear: string) => void 
}) => (
  <div className="grid gap-7 auto-rows-auto grid-cols-[repeat(auto-fill,350px)] justify-start">
    {months.map(({ monthYear, trades }) => {
      const [month, year] = monthYear.split(' ');
      return (
        <Card 
          key={monthYear}
          className="cursor-pointer transition-all duration-200 hover:border-white/30 w-[350px]"
          onClick={() => onMonthSelect(monthYear)}
        >
          <CardHeader>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-5 w-5 text-muted-foreground"
                >
                  <path d="M8 6h8v12H8z" />
                  <path d="M12 3v3" />
                  <path d="M12 18v3" />
                </svg>
                <div className="flex items-center gap-5">
                  <CardTitle className="text-[1.5rem] font-medium">
                    {month}, {year}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {trades.length} {trades.length === 1 ? 'trade' : 'trades'}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      );
    })}
  </div>
);

function formatDayWithSuffix(day: number) {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function formatDate(dateString: string) {
  if (!dateString) return '';
  const [yyyy, mm, dd] = dateString.split('-');
  const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

const assetCategories = [
  { label: "Forex", value: "forex" },
  { label: "Futures", value: "futures" },
  { label: "Crypto", value: "crypto" },
  { label: "Stocks", value: "stock" },
];

function getAssetCategory(symbol: string) {
  if (!symbol) return '';
  const s = symbol.toUpperCase().replace(/[^A-Z0-9/]/g, '');

  const futuresList = [
    'NQ', 'ES', 'YM', 'CL', 'GC', 'ZB', 'RTY', 'SI', 'HG', 'NG', '6E', '6J', '6B', '6A', '6C', 'ZN', 'ZF', 'ZT', 'LE', 'HE', 'ZC', 'ZS', 'ZW', 'ZR', 'ZL', 'ZK', 'ZT', 'ZQ', 'MES', 'MNQ', 'M2K', 'MGC', 'MCL', 'MYM', 'SIL', 'PL', 'PA', 'KC', 'SB', 'CT', 'OJ', 'CC', 'LBS', 'FESX', 'FDAX', 'FGBL', 'FGBM', 'FGBS', 'FGBX'
  ];

  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s) || /^[A-Z]{6}$/.test(s)) return 'forex';
  if (futuresList.some(fut => s.startsWith(fut))) return 'futures';
  if (/BTC|ETH|SOL|DOGE|XRP|ADA|BNB|USDT|USDC|MATIC|DOT|SHIB|LTC|TRX|AVAX|LINK|UNI|BCH|XLM|ETC|FIL|ICP|APT|ARB|HBAR|VET|NEAR|QNT|OP|GRT|AAVE|STX|SAND|EOS|XTZ|MKR|SNX|CRV|ENJ|BAT|ZRX|COMP|KNC|OMG|YFI|BAL|REN|LEND|SRM|SUSHI|1INCH|RUNE|CAKE|FTT|FTM|LUNA|UST|CRO|CEL|MANA|CHZ|GALA|AXS|FLOW|DYDX|RPL|LDO|GMX|INJ|PEPE|MEME|ORDI|WIF|JUP|PYTH|TIA|STRK|AEVO|ZETA|JTO|MANTA|ALT|BIGTIME|PIXEL|PORTAL|DEGEN|TURBO|DOG|FLOKI|BONK|WEN|TOSHI|MOG|BOME|POPCAT|BOOK|NORMIE|SATS|RATS/.test(s)) return 'crypto';
  if (/^[A-Z]{1,5}$/.test(s)) return 'stock';
  return '';
}

// Checklist type for checked/unchecked support
type ChecklistItem = { text: string; checked: boolean };

export default function TradeLogbookPage() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const allTrades = useAllTrades();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  
  // Debug: Track selectedTrade changes
  useEffect(() => {

  }, [selectedTrade]);
  
  const [notes, setNotes] = useState<{ headline: string, points: string[] }[]>([]);
  const [pendingNote, setPendingNote] = useState<{ headline: string, points: string[], editIdx?: number } | null>(null);
  const [popupImage, setPopupImage] = useState<string | null>(null);

  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteHeadline, setNoteHeadline] = useState('');
  const [notePoints, setNotePoints] = useState<string[]>(['']);
  const [isAddingNote, setIsAddingNote] = useState(false);

  const [uploadedScreenshot, setUploadedScreenshot] = useState<string | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [screenshotDescription, setScreenshotDescription] = useState('');
  const [screenshotHeadline, setScreenshotHeadline] = useState('');
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [isInitialScreenshot, setIsInitialScreenshot] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [globalStrategies, setGlobalStrategies] = useState<string[]>([]);
const [globalChecklist, setGlobalChecklist] = useState<string[]>([]);
const [newChecklistItem, setNewChecklistItem] = useState('');

// Grouping functionality states
const [isGroupingMode, setIsGroupingMode] = useState(false);
const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
const [isCreatingGroup, setIsCreatingGroup] = useState(false);
const [ungroupingTradeId, setUngroupingTradeId] = useState<string | null>(null);

// Grouping helper functions
const handleStartGrouping = () => {
  setIsGroupingMode(true);
  setSelectedTrades(new Set());
};

const handleStopGrouping = () => {
  setIsGroupingMode(false);
  setSelectedTrades(new Set());
};

const handleTradeSelection = (tradeId: string, trade: Trade) => {
  if (!isGroupingMode) return;
  
  setSelectedTrades(prev => {
    const newSet = new Set(prev);
    if (newSet.has(tradeId)) {
      newSet.delete(tradeId);
    } else {
      newSet.add(tradeId);
    }
    return newSet;
  });
};

const handleCreateGroup = async () => {
  if (selectedTrades.size < 2 || isCreatingGroup) return;
  
  setIsCreatingGroup(true);
  
  const selectedTradeObjects = groupedTrades[selectedMonth!].filter(trade => 
    selectedTrades.has(trade.id || '')
  );
  
  try {
    // Calculate combined values
    const totalPnL = selectedTradeObjects.reduce((sum, trade) => sum + trade.pnl, 0);
    const symbols = [...new Set(selectedTradeObjects.map(trade => trade.symbol))].join(', ');
    const accounts = [...new Set(selectedTradeObjects.map(trade => trade.account || trade.accountId))].join(' & ');
    
    // Create a clean version of original trades for Firestore
    const cleanOriginalTrades = selectedTradeObjects.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      pnl: trade.pnl,
      date: trade.date,
      account: trade.account || trade.accountId,
      accountId: trade.accountId,
      platform: trade.platform,
      screenshot: trade.screenshot || '',
      userId: trade.userId,
      ...(trade.entryTime && { entryTime: trade.entryTime }),
      ...(trade.exitTime && { exitTime: trade.exitTime }),
      ...(trade.strategy && { strategy: trade.strategy }),
      ...(trade.notes && { notes: trade.notes })
    }));
    
    // Create grouped trade document
    const groupedTrade = {
      symbol: symbols,
      pnl: totalPnL,
      date: selectedTradeObjects[0].date,
      account: accounts,
      platform: 'Manual Group',
      screenshot: '',
      isGroup: true,
      originalTrades: cleanOriginalTrades,
      groupedTradeIds: selectedTradeObjects.map(t => t.id).filter(Boolean)
    };
    
    // Save grouped trade and remove individual trades in parallel
    const token = await currentUser.getIdToken();
    const saveGroupPromise = fetch('/api/firestore-add-trade', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: currentUser?.uid,
        trade: groupedTrade
      })
    });
    
    // Remove all individual trades in parallel
    const removePromises = selectedTradeObjects
      .filter(trade => trade.id)
      .map(trade => 
        fetch('/api/firestore-remove-trade', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: currentUser?.uid,
            id: trade.id
          })
        })
      );
    
    // Wait for all operations to complete in parallel
    const [saveResponse, ...removeResponses] = await Promise.all([
      saveGroupPromise,
      ...removePromises
    ]);
    
    // Check save response
    const saveResult = await saveResponse.json();
    if (!saveResponse.ok) {
     
      throw new Error(`Failed to save grouped trade: ${saveResult.error || 'Unknown error'}`);
    }
    
    // Check remove responses (optional - don't fail if some removals fail)
    removeResponses.forEach((response, index) => {
      if (!response.ok) {
       
      }
    });
    
    // Single refresh at the end
    if (currentUser) {
      await loadTradesFromFirestore();
    }
    
  } catch (error) {
   
    alert('Failed to create group. Please try again.');
  } finally {
    setIsCreatingGroup(false);
  }
  
  // Reset grouping mode
  setIsGroupingMode(false);
  setSelectedTrades(new Set());
};

const handleUngroup = async (groupedTrade: Trade) => {
  if (ungroupingTradeId) return; // Prevent multiple simultaneous ungroup operations
  
  try {
    setUngroupingTradeId(groupedTrade.id || '');
    
    const originalTrades = (groupedTrade as any).originalTrades;
    
    if (!originalTrades || !Array.isArray(originalTrades)) {
     
      alert('Cannot ungroup: No original trade data found');
      return;
    }
    
    // Prepare clean trades for restoration
    const cleanTrades = originalTrades.map(trade => ({
      ...trade,
      isGroup: undefined,
      originalTrades: undefined,
      groupedTradeIds: undefined
    }));
    
    // Create all promises but don't await them yet
    const token = await currentUser.getIdToken();
    const addPromises = cleanTrades.map(trade =>
      fetch('/api/firestore-add-trade', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: currentUser?.uid,
          trade: trade
        })
      })
    );
    
    const removeGroupPromise = groupedTrade.id ? 
      fetch('/api/firestore-remove-trade', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: currentUser?.uid,
          id: groupedTrade.id
        })
      }) : Promise.resolve({ ok: true });
    
    // Execute all operations in parallel - this is the key optimization
    await Promise.all([removeGroupPromise, ...addPromises]);
    
    // Single refresh at the end
    if (currentUser) {
      await loadTradesFromFirestore();
    }
    
  } catch (error) {
 
    alert('Failed to ungroup trades. Please try again.');
  } finally {
    setUngroupingTradeId(null);
  }
};

const handleRemovePredefinedGroup = (groupId: string) => {
  // This function is no longer needed since we don't have predefined groups
};

const getDisplayTrades = (monthTrades: Trade[]) => {
  if (!selectedMonth) return monthTrades;
  
  // Simply return all trades since we don't have virtual predefined groups anymore
  return monthTrades;
};

  const [rating, setRating] = useState(0);

  const updateTrade = useTradeStore(state => state.updateTrade);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [strategies, setStrategies] = useState<string[]>([]);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [newStrategy, setNewStrategy] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const sessionOptions = [
    "London Session",
    "New York AM",
    "New York PM",
    "Asia"
  ];
  const [selectedSession, setSelectedSession] = useState('');
  const [setupChecklist, setSetupChecklist] = useState<ChecklistItem[]>([]);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [newSetupItem, setNewSetupItem] = useState('');





useEffect(() => {
  setShowDescription(false);
  setScreenshotDescription(selectedTrade?.screenshot2Description || '');
  setScreenshotHeadline(selectedTrade?.screenshotHeadline || ''); // <-- FIXED: use left headline!
  setUploadedScreenshot(selectedTrade?.screenshot2 || null);
  setRating(selectedTrade?.rating || 0);
  setShowSetupDialog(false);
  setNewSetupItem('');
  setNotes(selectedTrade?.notes || []);
  setSelectedCategory(selectedTrade?.assetCategory || getAssetCategory(selectedTrade?.symbol || ''));
  setSelectedStrategy(selectedTrade?.strategy || '');
  setSelectedSession(selectedTrade?.session || '');
  setSetupChecklist(
    selectedTrade?.setupChecklist
      ? selectedTrade.setupChecklist.map((item: any) =>
          typeof item === 'string' ? { text: item, checked: false } : item
        )
      : []
  );
  if (
    selectedTrade?.strategy &&
    selectedTrade.strategy.trim() !== "" &&
    !strategies.includes(selectedTrade.strategy)
  ) {
    setStrategies(prev => [...prev, selectedTrade.strategy!]);
  }
}, [selectedTrade?.id]);

  // Auto-save pending changes when navigating away (for Tradovate trades)
  useEffect(() => {
    const savePendingChanges = async () => {
      if (!selectedTrade || !selectedTrade.id) {
      
        return;
      }

      const hasChanges = screenshotDescription.trim() || screenshotHeadline.trim() || noteHeadline.trim() || pendingNote;
      if (!hasChanges) {
      
        return;
      }

   
      
      try {
        // Save any pending screenshot description/headline
        if (screenshotDescription.trim() || screenshotHeadline.trim()) {
          const updates: any = {};
          
          if (isInitialScreenshot) {
            if (screenshotDescription.trim()) updates.description = screenshotDescription.trim();
            if (screenshotHeadline.trim()) updates.screenshotHeadline = screenshotHeadline.trim();
          } else {
            if (screenshotDescription.trim()) updates.screenshot2Description = screenshotDescription.trim();
            if (screenshotHeadline.trim()) updates.screenshot2Headline = screenshotHeadline.trim();
          }
          
          // Only call updateTrade if we have actual updates
          if (Object.keys(updates).length > 0) {
          
            await updateTrade(selectedTrade.id, updates);
          }
        }
        
        // Save any pending note
        if (pendingNote && pendingNote.headline.trim()) {
          const newNotes = [...notes, { 
            headline: pendingNote.headline, 
            points: pendingNote.points.filter(p => p.trim() !== '') 
          }];
        
          await updateTrade(selectedTrade.id, { notes: newNotes });
        } else if (noteHeadline.trim() && showNoteDialog) {
          // Only save if note dialog is still open (not already saved)
          const newNotes = [...notes, { 
            headline: noteHeadline, 
            points: notePoints.filter(p => p.trim() !== '') 
          }];
        
          await updateTrade(selectedTrade.id, { notes: newNotes });
        }
        
    
      } catch (error) {
       
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasChanges = selectedTrade && selectedTrade.id && (
        screenshotDescription.trim() || 
        screenshotHeadline.trim() || 
        noteHeadline.trim() || 
        pendingNote
      );
      
      if (hasChanges) {
        // Save changes asynchronously
        savePendingChanges();
        
        // Show browser warning for unsaved changes
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const hasChanges = selectedTrade && selectedTrade.id && (
          screenshotDescription.trim() || 
          screenshotHeadline.trim() || 
          noteHeadline.trim() || 
          pendingNote
        );
        
        if (hasChanges) {
          savePendingChanges();
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Save changes on cleanup
      savePendingChanges();
    };
  }, [selectedTrade, screenshotDescription, screenshotHeadline, noteHeadline, pendingNote, notes, isInitialScreenshot, updateTrade]);

useEffect(() => {
  // Unique strategies from all trades
  const uniqueStrategies = Array.from(
    new Set(allTrades.map(t => t.strategy).filter(Boolean))
  ) as string[];
  
  // Only add new strategies from trades, don't remove existing ones
  setGlobalStrategies(prev => {
    const combined = new Set([...prev, ...uniqueStrategies]);
    return Array.from(combined);
  });

  // Unique checklist items from all trades
  const uniqueChecklist = Array.from(
    new Set(
      allTrades
        .flatMap(t =>
          Array.isArray(t.setupChecklist)
            ? t.setupChecklist.map((item: any) =>
                typeof item === 'string' ? item : item.text
              )
            : []
        )
        .filter(Boolean)
    )
  );
  setGlobalChecklist(uniqueChecklist);
}, [allTrades]);

const handleAddChecklistItem = async () => {
  const trimmed = newChecklistItem.trim();
  if (trimmed && !globalChecklist.includes(trimmed)) {
    setGlobalChecklist([...globalChecklist, trimmed]);
    // Also add to current trade's setupChecklist and save
    if (selectedTrade && selectedTrade.id) {
      const updated = [
        ...setupChecklist,
        { text: trimmed, checked: false }
      ];
      setSetupChecklist(updated);
      await updateTrade(selectedTrade.id, { setupChecklist: updated });
    }
  }
  setNewChecklistItem('');
};


  const groupedTrades = groupTradesByMonth(allTrades);

const handleSetRating = async (value: number) => {

  
  setRating(value);
  if (selectedTrade && selectedTrade.id) {

    
    try {
      await updateTrade(selectedTrade.id, { rating: value });
    
      setSelectedTrade({
        ...selectedTrade,
        rating: value,
        session: selectedSession, // <-- preserve the latest session from state
        // add other fields if you have similar issues
      });
    } catch (error) {
    
    }
  } else {
   
  }
};

  // Asset Category
  const handleCategoryChange = async (cat: string) => {
    setSelectedCategory(cat);
    if (selectedTrade && selectedTrade.id) {
      await updateTrade(selectedTrade.id, { assetCategory: cat });
    }
  };

  // Strategy
const handleStrategyChange = async (strat: string) => {
  setSelectedStrategy(strat);
  if (selectedTrade && selectedTrade.id) {

    
    try {
      await updateTrade(selectedTrade.id, { strategy: strat });
    
      setSelectedTrade({
        ...selectedTrade,
        strategy: strat,
        session: selectedSession, // preserve latest session
        setupChecklist: setupChecklist, // preserve latest checklist
        // add other fields if needed
      });
    } catch (error) {
     
    }
  } else {
   
  }
};

  // Session
  const handleSessionChange = async (session: string) => {
    setSelectedSession(session);
    if (selectedTrade && selectedTrade.id) {

      
      try {
        await updateTrade(selectedTrade.id, { session });
       
      } catch (error) {
       
      }
    } else {
      
    }
  };

  // Setup Checklist handlers (checked/unchecked support)
  const handleAddSetupItem = async () => {
    if (newSetupItem.trim() && !setupChecklist.some(i => i.text === newSetupItem.trim())) {
      const updated = [...setupChecklist, { text: newSetupItem.trim(), checked: false }];
      setSetupChecklist(updated);
      setNewSetupItem('');
      setShowSetupDialog(false);
      if (selectedTrade && selectedTrade.id) {
 
        
        try {
          await updateTrade(selectedTrade.id, { setupChecklist: updated });
        
        } catch (error) {
         
        }
      } else {
       
      }
    }
  };

  const handleRemoveSetupItem = async (idx: number) => {
    const updated = setupChecklist.filter((_, i) => i !== idx);
    setSetupChecklist(updated);
    if (selectedTrade && selectedTrade.id) {

      
      try {
        await updateTrade(selectedTrade.id, { setupChecklist: updated });
      
      } catch (error) {
       
      }
    } else {
     
    }
  };

const handleToggleChecklistItem = async (idx: number) => {
  const updated = setupChecklist.map((item, i) =>
    i === idx ? { ...item, checked: !item.checked } : item
  );
  setSetupChecklist(updated);
  if (selectedTrade && selectedTrade.id) {
    await updateTrade(selectedTrade.id, { setupChecklist: updated });
    const refreshed = useTradeStore.getState().trades.find(t => t.id === selectedTrade.id);
    setSelectedTrade(refreshed || selectedTrade);
  }
};

  // Strategy modal handlers
const handleAddStrategy = () => {
  const trimmed = newStrategy.trim();
  if (trimmed && !globalStrategies.includes(trimmed)) {
    // Add to global strategies list
    setGlobalStrategies([...globalStrategies, trimmed]);
    setShowStrategyModal(false);
  }
  setNewStrategy('');
};

const handleRemoveStrategy = async (strat: string) => {
  // Remove from global list only
  setGlobalStrategies(globalStrategies.filter(s => s !== strat));
  
  // Clear from currently selected trade if it matches
  if (selectedStrategy === strat) {
    setSelectedStrategy('');
  }
  // Note: We no longer remove the strategy from all trades that use it
  // This allows trades to keep their strategy assignment even if removed from dropdown
};

  // Screenshot handlers
const handleUploadScreenshot = async (file: File) => {
  if (!selectedTrade || !selectedTrade.id) return;
  const reader = new FileReader();
  reader.onload = () => {
    const screenshotData = reader.result as string;
    if (!selectedTrade.screenshot) {
      // Optimistically update UI
      setSelectedTrade({ ...selectedTrade, screenshot: screenshotData });
      updateTrade(selectedTrade.id, { screenshot: screenshotData }); // async, don't await
    } else {
      setUploadedScreenshot(screenshotData);
      setSelectedTrade({ ...selectedTrade, screenshot2: screenshotData });
      updateTrade(selectedTrade.id, { screenshot2: screenshotData }); // async, don't await
    }
  };
  reader.readAsDataURL(file);
};

const handleRemoveInitialScreenshot = async () => {
  if (!selectedTrade) return;
  // If right screenshot exists, move it to the left
  if (uploadedScreenshot) {
    await updateTrade(selectedTrade.id, {
      screenshot: uploadedScreenshot,
      screenshotHeadline: "", // <-- clear headline
      screenshot2: "",
      screenshot2Headline: "",
      screenshot2Description: "",
      description: "",
    });
    setSelectedTrade({
      ...selectedTrade,
      screenshot: uploadedScreenshot,
      screenshotHeadline: "",
      screenshot2: "",
      screenshot2Headline: "",
      screenshot2Description: "",
      description: "",
    });
    setUploadedScreenshot(null);
  } else {
    // Just remove the left screenshot and headline
    await updateTrade(selectedTrade.id, {
      screenshot: "",
      screenshotHeadline: "", // <-- clear headline
      description: "",
    });
    setSelectedTrade({
      ...selectedTrade,
      screenshot: "",
      screenshotHeadline: "", // <-- clear headline
      description: "",
    });
  }
};

const handleRemoveUploadedScreenshot = async () => {
  if (!selectedTrade) return;
  await updateTrade(selectedTrade.id, {
    screenshot2: "",
    screenshot2Headline: "",
    screenshot2Description: "",
  });
  setSelectedTrade({
    ...selectedTrade,
    screenshot2: "",
    screenshot2Headline: "",
    screenshot2Description: "",
  });
  setUploadedScreenshot(null);
};

async function removeChecklistItemFromAllTrades(itemToRemove: string) {
  setGlobalChecklist(globalChecklist.filter(i => i !== itemToRemove));
  // Remove from all trades in Firestore
  for (const trade of allTrades) {
    if (
      Array.isArray(trade.setupChecklist) &&
      trade.setupChecklist.some(i => (typeof i === 'string' ? i === itemToRemove : i.text === itemToRemove))
    ) {
      const updatedChecklist = trade.setupChecklist.filter(
        i => (typeof i === 'string' ? i !== itemToRemove : i.text !== itemToRemove)
      );
      await updateTrade(trade.id, { setupChecklist: updatedChecklist });
    }
  }
}

  // Notes logic unchanged (already persists to Firestore)

  const sortedMonths = Object.keys(groupedTrades)
    .sort((a, b) => {
      // Parse month and year for correct sorting
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const dateA = new Date(`${monthA} 1, ${yearA}`);
      const dateB = new Date(`${monthB} 1, ${yearB}`);
      return dateB.getTime() - dateA.getTime();
    })
    .map(monthYear => ({
      monthYear,
      trades: groupedTrades[monthYear]
    }));

  // Breadcrumbs logic
  let breadcrumbs = [
    { title: 'Dashboard', link: '/#/dashboard' },
    { title: 'Trade Logbook', link: '/#/dashboard/TradeLogbook' }
  ];
  
  if (selectedMonth && !selectedTrade) {
    breadcrumbs.push({
      title: selectedMonth,
      link: '#'
    });
  }
if (selectedTrade) {
  const [yyyy, mm, dd] = selectedTrade.date.split('-');
  const day = Number(dd);
  breadcrumbs.push({
    title: `${formatDayWithSuffix(day)} [${formatCurrency(selectedTrade.pnl)}]`,
    link: '#'
  });
}

  return (
    <>
      <PageContainer scrollable>
      <div className="min-h-screen overflow-y-auto p-4 md:p-8">
        <PageHead title={`Tradescale`} />
        {!currentUser ? (
          <div className="text-center text-muted-foreground py-8">
            Please sign in to view your trade logbook
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                {/* Custom breadcrumb handling for Trade Logbook navigation */}
                <div className="flex items-center space-x-1">
                  {breadcrumbs.map((item, index) => (
                    <div key={item.title} className="flex items-center">
                      {index > 0 && <span className="mx-2 text-muted-foreground">/</span>}
                      {index === breadcrumbs.length - 1 ? (
                        <span className="text-foreground">{item.title}</span>
                      ) : (
                        <a
                          href={item.link}
                          className="text-white hover:text-white/80 cursor-pointer"
                          onClick={(e) => {
                            // Handle Trade Logbook click when inside a trade
                            if (item.title === 'Trade Logbook' && selectedTrade) {
                              e.preventDefault();
                              setSelectedTrade(null); // Go back to month overview
                            }
                            // Let other links work normally
                          }}
                        >
                          {item.title}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Navigation Buttons */}
              {selectedMonth && !selectedTrade && (
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="text-[#94bba3] hover:text-[#94bba3]/80 transition-colors p-2"
                  title="Back to months"
                >
                  <CornerUpLeft className="h-4 w-4" />
                </button>
              )}
              {selectedTrade && (
                <button
                  onClick={() => setSelectedTrade(null)}
                  className="text-[#94bba3] hover:text-[#94bba3]/80 transition-colors p-2"
                  title="Back to trades"
                >
                  <CornerUpLeft className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-8">
              {!selectedMonth ? (
                <MonthGrid months={sortedMonths} onMonthSelect={setSelectedMonth} />
              ) : !selectedTrade ? (
                <>
                  {/* Create Group and Predefine Group Buttons */}
                  <div className="mb-4 flex items-center gap-4">
                    {!isGroupingMode ? (
                      <>
                        <Button
                          variant="ghost" 
                          size="icon"
                          className="h-9 w-auto px-2 bg-[#94bba3]/20 border border-white/15 hover:bg-[#94bba3]/20 transition-transform hover:scale-105"
                          onClick={handleStartGrouping}
                        >
                          <GitFork className="h-4 w-4 mr-2" />
                          Create Group
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost" 
                          size="icon"
                          className="h-9 w-auto px-2 bg-transparent border border-white/20 hover:bg-white/10 transition-transform hover:scale-105"
                          onClick={handleCreateGroup}
                          disabled={selectedTrades.size < 2 || isCreatingGroup}
                        >
                          {isCreatingGroup ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            `Done (${selectedTrades.size})`
                          )}
                        </Button>
                        <Button
                          variant="ghost" 
                          size="icon"
                          className="h-9 w-auto px-2 bg-transparent border border-white/20 hover:bg-white/10 transition-transform hover:scale-105"
                          onClick={handleStopGrouping}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {getDisplayTrades(groupedTrades[selectedMonth]).map((trade, index) => {
                      const isSelected = selectedTrades.has(trade.id || '');
                      const isGroupTrade = (trade as any).isGroup;
                      
                      return (
                        <Card
                          key={trade.id || index}
                          className={`
                            relative transition-all duration-200 hover:border-white/30 cursor-pointer
                            ${isSelected ? 'ring-2 ring-[#94bba3] border-[#94bba3]' : ''}
                          `}
                          onClick={() => {
                            if (isGroupingMode && !isGroupTrade) {
                              handleTradeSelection(trade.id || '', trade);
                            } else if (!isGroupingMode) {
                         
                              setSelectedTrade(trade);
                            }
                          }}
                        >
                          {/* Selection Circle */}
                          {isGroupingMode && !isGroupTrade && (
                            <div className={`
                              absolute bottom-2 right-2 w-6 h-6 rounded-full border-2 z-10
                              ${isSelected 
                                ? 'bg-[#94bba3] border-[#94bba3]' 
                                : 'bg-transparent border-white/50'
                              }
                              flex items-center justify-center
                            `}>
                              {isSelected && (
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          )}
                          
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
                            <CardTitle className="text-sm font-medium">
                              {isGroupTrade ? `Group: ${trade.symbol}` : trade.symbol}
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
                              <path d="M8 6h8v12H8z" />
                              <path d="M12 3v3" />
                              <path d="M12 18v3" />
                            </svg>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold ${
                              trade.pnl > 0 
                                ? 'text-emerald-500' 
                                : trade.pnl < 0 
                                  ? 'text-red-500' 
                                  : 'text-muted-foreground'
                            }`}>
                              {formatCurrency(trade.pnl)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {isGroupTrade ? (
                                <span>
                                  {formatDate(trade.date)}
                                  <span className="mx-1">|</span>
                                  {(trade as any).groupTrades?.length || (trade as any).originalTrades?.length || 'Multiple'} trades grouped
                                </span>
                              ) : (
                                formatDate(trade.date)
                              )}
                            </p>
                            {isGroupTrade && (
                              <div className="flex items-center justify-between mt-1">
                                {/* Delete button for predefined groups */}
                                {(trade as any).isPredefined && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-500/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemovePredefinedGroup(trade.id || '');
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                                {/* Ungroup button for manual groups (Firestore groups) */}
                                {!!(trade as any).originalTrades && !(trade as any).isPredefined && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={ungroupingTradeId === trade.id}
                                    className="h-7 px-2 bg-transparent border border-white/20 hover:bg-white/10 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUngroup(trade);
                                    }}
                                  >
                                    {ungroupingTradeId === trade.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Ungrouping...
                                      </>
                                    ) : (
                                      'Ungroup'
                                    )}
                                  </Button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Left 75% */}
                  <div className="md:basis-3/4 w-full">
                    <Card className="p-6">
                      <div className="text-2xl font-semibold mb-1">Trade Details</div>
                      <div className="text-sm text-muted-foreground mb-4">Personal Trading Library</div>
                      <hr className="my-4 border-white/5 mx-2" />
                      {/* NET P&L and Symbol side by side */}
                      <div className="flex flex-col md:flex-row gap-4 mb-4">
                        {/* NET P&L Card */}
                        <Card className="relative overflow-hidden w-full md:w-1/2">
                          {theme === 'dark' && (
                          <div
                            aria-hidden
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `
                                linear-gradient(
                                  to bottom,
                                  rgba(148,187,163,0.10) 0%,
                                  rgba(148,187,163,0.04) 40%,
                                  rgba(0,0,0,0.0) 60%,
                                  #000 100%
                                )
                              `,
                              zIndex: 0,
                            }}
                          />
                          )}
                          <CardHeader className="relative z-10">
                            <CardTitle className="text-base">NET P&L</CardTitle>
                          </CardHeader>
                          <CardContent className="relative z-10">
                            <Input
                              value={formatCurrency(selectedTrade.pnl)}
                              readOnly
                              className="border-white/15 bg-black text-white rounded-md py-2 px-3 w-full outline-none"
                            />
                          </CardContent>
                        </Card>
                        {/* Symbol Card */}
                        <Card className="relative overflow-hidden w-full md:w-1/2">
                          {theme === 'dark' && (
                          <div
                            aria-hidden
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `
                                linear-gradient(
                                  to bottom,
                                  rgba(148,187,163,0.10) 0%,
                                  rgba(148,187,163,0.04) 40%,
                                  rgba(0,0,0,0.0) 60%,
                                  #000 100%
                                )
                              `,
                              zIndex: 0,
                            }}
                          />
                          )}
                          <CardHeader className="relative z-10">
                            <CardTitle className="text-base">Symbol</CardTitle>
                          </CardHeader>
                          <CardContent className="relative z-10">
                            <Input
                              value={selectedTrade.symbol}
                              readOnly
                              className="border-white/15 bg-black text-white rounded-md py-2 px-3 w-full outline-none"
                            />
                          </CardContent>
                        </Card>
                      </div>
                    {/* Screenshot Card */}
        <Card className="mb-4 relative overflow-hidden">
  {theme === 'dark' && (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `
          linear-gradient(
            to bottom,
            rgba(148,187,163,0.10) 0%,
            rgba(148,187,163,0.04) 40%,
            rgba(0,0,0,0.0) 60%,
            #000 100%
          )
        `,
        zIndex: 0,
      }}
    />
  )}

  <CardHeader className="relative z-10">
    <CardTitle className="text-base">Screenshot</CardTitle>
  </CardHeader>
  <CardContent className="relative z-10">
    <div className="flex flex-col md:flex-row gap-4 w-full">
      {/* Left: Initial Screenshot */}
      <div className="flex flex-col items-start w-full md:w-1/2">
        {selectedTrade?.screenshot ? (
          <div className="relative w-full flex flex-col items-start">
            <img
              src={selectedTrade.screenshot}
              alt="Trade Screenshot"
              className="w-full max-w-[420px] max-h-[420px] object-contain rounded cursor-pointer"
              onClick={() => setPopupImage(selectedTrade.screenshot)}
            />
            {/* Headline below screenshot */}
            {selectedTrade.screenshotHeadline && (
              <div className="font-bold text-xs text-[#94bba3] mt-2 mb-2">{selectedTrade.screenshotHeadline}</div>
            )}
            {/* Row: bin + plus/pen */}
            <div className="flex items-center gap-2 mt-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-700"
                onClick={handleRemoveInitialScreenshot}
                title="Delete Screenshot"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#94bba3] hover:text-[#94bba3]/80"
                onClick={() => {
                  setIsInitialScreenshot(true);
                  setScreenshotHeadline(selectedTrade?.screenshotHeadline || '');
                  setShowScreenshotDialog(true);
                }}
                title={selectedTrade.screenshotHeadline ? "Edit Headline" : "Add Headline"}
              >
                {selectedTrade.screenshotHeadline ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full h-[420px] flex flex-col items-center justify-center border border-dashed border-white/15 rounded bg-black/20 text-muted-foreground">
            {/* Empty state */}
          </div>
        )}
      </div>
      {/* Right: Uploaded Screenshot or Add Screenshot */}
      <div className="flex flex-col items-start w-full md:w-1/2">
        {uploadedScreenshot ? (
          <div className="relative w-full flex flex-col items-start">
            <img
              src={uploadedScreenshot}
              alt="Uploaded Screenshot"
              className="w-full max-w-[420px] max-h-[420px] object-contain rounded cursor-pointer"
              onClick={() => setPopupImage(uploadedScreenshot)}
            />
            {/* Headline below screenshot */}
            {selectedTrade.screenshot2Headline && (
              <div className="font-bold text-xs text-[#94bba3] mt-2 mb-2">{selectedTrade.screenshot2Headline}</div>
            )}
            {/* Row: bin + plus/pen */}
            <div className="flex items-center gap-2 mt-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-700"
                onClick={handleRemoveUploadedScreenshot}
                title="Delete Screenshot"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#94bba3] hover:text-[#94bba3]/80"
                onClick={() => {
                  setIsInitialScreenshot(false);
                  setScreenshotHeadline(selectedTrade?.screenshot2Headline || '');
                  setShowScreenshotDialog(true);
                }}
                title={selectedTrade.screenshot2Headline ? "Edit Headline" : "Add Headline"}
              >
                {selectedTrade.screenshot2Headline ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center h-full mt-16 md:mt-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUploadScreenshot(file);
              }}
            />
            <Card
              className="flex items-center gap-2 p-2 mb-2 cursor-pointer w-fit hover:bg-[#94bba3]/10 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-6 h-6 flex items-center justify-center rounded bg-[#94bba3] text-white mr-2">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-sm">Add Screenshot</span>
            </Card>
          </div>
        )}
      </div>
    </div>
  </CardContent>
</Card>
                    {/* Notes Card */}
 <Card className="relative overflow-hidden">
  {theme === 'dark' && (
  <div
    aria-hidden
    className="absolute inset-0 pointer-events-none"
    style={{
      background: `
        linear-gradient(
          to bottom,
          rgba(148,187,163,0.10) 0%,
          rgba(148,187,163,0.04) 40%,
          rgba(0,0,0,0.0) 60%,
          #000 100%
        )
      `,
      zIndex: 0,
    }}
  />
  )}
   <CardHeader className="relative z-10">
    <CardTitle className="text-base">Notes</CardTitle>
  </CardHeader>
  <CardContent className="relative z-10 flex flex-col gap-4">
    {/* Render saved notes */}
      {notes.map((note, idx) =>
          pendingNote && pendingNote.editIdx === idx ? (
            // --- Edit mode for this note ---
            <Card key={idx} className="mb-4 relative border border-[#94bba3] bg-black/60">
              <CardHeader>
                <CardTitle className="text-[#94bba3]">{pendingNote.headline}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {pendingNote.points.map((point, pidx) => (
                    <div key={pidx} className="flex items-center gap-2">
                      <span className="text-[#94bba3] text-xl font-bold">•</span>
                      <Input
                        value={point}
                        autoFocus={pidx === pendingNote.points.length - 1}
                        onChange={e => {
                          const newPoints = [...pendingNote.points];
                          newPoints[pidx] = e.target.value;
                          setPendingNote({ ...pendingNote, points: newPoints });
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && pendingNote.points[pidx].trim() !== '') {
                            setPendingNote({ ...pendingNote, points: [...pendingNote.points, ''] });
                          }
                        }}
                        className="border-white/15 flex-1 !bg-transparent"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    className="px-4 py-2 rounded bg-[#94bba3] text-black font-semibold border border-[#94bba3] hover:bg-[#94bba3]/80 transition"
                    onClick={async () => {
                      const updatedNotes = [...notes];
                      updatedNotes[idx] = {
                        headline: pendingNote.headline,
                        points: pendingNote.points.filter(p => p.trim() !== ''),
                      };
                      setNotes(updatedNotes);
                      setPendingNote(null);
                      // --- Save edited notes to Firestore ---
                      if (selectedTrade && selectedTrade.id) {
                
                        
                        try {
                          await updateTrade(selectedTrade.id, { notes: updatedNotes });
                         
                          setSelectedTrade({ ...selectedTrade, notes: updatedNotes }); // <-- Add this line
                        } catch (error) {
                         
                        }
                      } else {
                       
                      }
                    }}
                    disabled={!pendingNote.points.some(p => p.trim() !== '')}
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // --- Normal display mode ---
           <Card key={idx} className="mb-4 relative !bg-transparent">
              <CardHeader>
                <CardTitle className="text-[#94bba3]">{note.headline}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5">
                  {note.points.map((point, i) => (
                    <li key={i} className="text-white">{point}</li>
                  ))}
                </ul>
                <div className="flex gap-2 mt-4">
                  {/* --- Delete note --- */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700"
                    onClick={async () => {
                      const updatedNotes = notes.filter((_, nidx) => nidx !== idx);
                      setNotes(updatedNotes);
                      // --- Save after delete ---
                      if (selectedTrade) {
                        await updateTrade(selectedTrade.id, { notes: updatedNotes });
                          setSelectedTrade({ ...selectedTrade, notes: updatedNotes }); // <-- Add this line
                      }
                    }}
                    title="Delete Note"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  {/* --- Edit note --- */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#94bba3] hover:bg-[#94bba3]/20"
                    onClick={() => setPendingNote({ headline: note.headline, points: [...note.points], editIdx: idx })}
                    title="Edit Note"
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {/* --- Pending note for adding a new note --- */}
        {pendingNote && pendingNote.editIdx === undefined && (
          <Card className={`mb-4 relative border ${theme === 'light' ? 'border-gray-300 bg-white' : 'border-[#94bba3] bg-black/60'}`}>
            <CardHeader>
              <CardTitle className={theme === 'light' ? 'text-black' : 'text-[#94bba3]'}>{pendingNote.headline}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {pendingNote.points.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${theme === 'light' ? 'text-gray-600' : 'text-[#94bba3]'}`}>•</span>
                    <Input
                      value={point}
                      autoFocus={idx === pendingNote.points.length - 1}
                      onChange={e => {
                        const newPoints = [...pendingNote.points];
                        newPoints[idx] = e.target.value;
                        setPendingNote({ ...pendingNote, points: newPoints });
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && pendingNote.points[idx].trim() !== '') {
                          setPendingNote({ ...pendingNote, points: [...pendingNote.points, ''] });
                        }
                      }}
                      className={`flex-1 !bg-transparent ${theme === 'light' ? 'border-gray-400 text-black' : 'border-white/15'}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  className="px-4 py-2 rounded bg-[#94bba3] text-black font-semibold border border-[#94bba3] hover:bg-[#94bba3]/80 transition"
                  onClick={async () => {
                    const newNotes = [...notes, { headline: pendingNote.headline, points: pendingNote.points.filter(p => p.trim() !== '') }];
                    setNotes(newNotes);
                    setPendingNote(null);
                    // --- Save new note to Firestore ---
                    if (selectedTrade) {
                      await updateTrade(selectedTrade.id, { notes: newNotes });
                       const updated = useTradeStore.getState().trades.find(t => t.id === selectedTrade.id);
setSelectedTrade(updated || selectedTrade);
                    }
                  }}
                  disabled={!pendingNote.points.some(p => p.trim() !== '')}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- Add Note button --- */}
 {!pendingNote && (
  <Card
    className="flex items-center gap-2 p-2 mb-2 cursor-pointer w-fit hover:bg-[#94bba3]/10 transition"
    onClick={() => {
      setShowNoteDialog(true); // <-- Show the headline dialog
      setNoteHeadline('');
      setNotePoints(['']);
      setIsAddingNote(true);
    }}
  >
    <div className="w-6 h-6 flex items-center justify-center rounded bg-[#94bba3] text-white mr-2">
      <Plus className="w-4 h-4" />
    </div>
    <span className="text-sm">Add Note</span>
  </Card>
)}


<Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Add Headline</DialogTitle>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <Input
        placeholder="Headline"
        value={noteHeadline}
        onChange={e => setNoteHeadline(e.target.value)}
        className="border-white/15"
      />
      <Button
        className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
        onClick={() => {
          if (noteHeadline.trim()) {
            setPendingNote({ headline: noteHeadline.trim(), points: [''] });
            setShowNoteDialog(false);
            setIsAddingNote(false);
          }
        }}
        disabled={!noteHeadline.trim()}
      >
        Continue
      </Button>
    </div>
    </DialogContent>
  </Dialog>
</CardContent>
</Card>
                  </Card>
                </div>
                {/* Right 25% */}
              <div className="md:basis-1/4 w-full flex flex-col gap-4">
                  {/* Asset Categorization Card */}
                <Card className="relative overflow-hidden">
                      {theme === 'dark' && (
                      <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `
                            linear-gradient(
                              to bottom,
                              rgba(148,187,163,0.10) 0%,
                              rgba(148,187,163,0.04) 40%,
                              rgba(0,0,0,0.0) 60%,
                              #000 100%
                            )
                          `,
                          zIndex: 0,
                        }}
                      />
                      )}
                      <CardHeader className="relative z-10">
                        <CardTitle className="text-base">Asset Categorization</CardTitle>
                      </CardHeader>
                      <CardContent className="relative z-10 flex flex-row gap-4 justify-between">
                        {assetCategories.map(cat => (
                          <button
                            key={cat.value}
                            className={
                              "flex-1 h-9 w-full px-2 border border-white/15 transition-transform " +
                              (selectedCategory === cat.value
                                ? "bg-[#94bba3]/20 hover:bg-[#94bba3]/20 scale-105"
                                : "bg-transparent hover:bg-[#94bba3]/20")
                            }
                            onClick={() => handleCategoryChange(cat.value)}
                            type="button"
                          >
                            {cat.label}
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                    {/* Account(s) Card */}
<Card className="relative overflow-hidden">
  {theme === 'dark' && (
  <div
    aria-hidden
    className="absolute inset-0 pointer-events-none"
    style={{
      background: `
        linear-gradient(
          to bottom,
          rgba(148,187,163,0.10) 0%,
          rgba(148,187,163,0.04) 40%,
          rgba(0,0,0,0.0) 60%,
          #000 100%
        )
      `,
      zIndex: 0,
    }}
  />
  )}
  <CardHeader className="relative z-10">
    <CardTitle className="text-base">
      {selectedTrade?.account && selectedTrade.account.split('&').length > 1 ? 'Accounts' : 'Account'}
    </CardTitle>
  </CardHeader>
  <CardContent className="relative z-10 flex flex-row gap-2 flex-wrap">
    {(selectedTrade?.account || '')
      .split('&')
      .map(acc => acc.trim())
      .filter(Boolean)
      .map((acc, idx) => (
        <Card
          key={idx}
          className="px-3 py-1 rounded border border-white/15 bg-[#94bba3]/10 text-white text-sm w-fit"
        >
          {acc}
        </Card>
      ))}
    {!selectedTrade?.account && (
      <div className="text-muted-foreground text-sm">\</div>
    )}
  </CardContent>
</Card>
                    {/* Strategy Card */}
                <Card className="relative overflow-hidden">
  {theme === 'dark' && (
  <div
    aria-hidden
    className="absolute inset-0 pointer-events-none"
    style={{
      background: `
        linear-gradient(
          to bottom,
          rgba(148,187,163,0.10) 0%,
          rgba(148,187,163,0.04) 40%,
          rgba(0,0,0,0.0) 60%,
          #000 100%
        )
      `,
      zIndex: 0,
    }}
  />
  )}
  <CardHeader className="relative z-10 flex flex-row items-center justify-between">
    <CardTitle className="text-base">Strategy</CardTitle>
    <Button
      variant="ghost"
      size="icon"
      className="ml-2 text-[#94bba3] hover:text-[#94bba3]/80 transition-colors"
      onClick={() => setShowStrategyModal(true)}
      title="Add Strategy"
    >
      <Plus className="h-5 w-5" />
    </Button>
  </CardHeader>
  <CardContent className="relative z-10">
    <Select value={selectedStrategy} onValueChange={handleStrategyChange}>
      <SelectTrigger className={`w-full ${theme === 'light' ? 'border-gray-300 bg-white text-black' : 'border-white/15 bg-black text-white'}`}>
        <SelectValue placeholder="Select Strategy" />
      </SelectTrigger>
      <SelectContent>
        {globalStrategies.map(s => (
          <SelectItem
            key={s}
            value={s}
            className="text-black dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 focus:bg-gray-300 dark:focus:bg-white/30 focus:text-black dark:focus:text-white"
          >
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
</Card>
{/* Strategy Modal */}
{showStrategyModal && (
  <Dialog open={showStrategyModal} onOpenChange={setShowStrategyModal}>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Add Strategy</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="strategy">Strategy Name</Label>
          <Input
            id="strategy"
            placeholder="Strategy name"
            value={newStrategy}
            onChange={e => setNewStrategy(e.target.value)}
            className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
          />
        </div>
        <Button
          className="flex items-center gap-2 px-3 py-1 bg-[#94bba3] text-black rounded hover:bg-[#94bba3]/80 transition mb-2"
          onClick={handleAddStrategy}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
        <div className="mt-2">
          {globalStrategies.length > 0 && (
            <div className="mb-1 text-xs text-muted-foreground">Current strategies:</div>
          )}
          {globalStrategies.map(strat => (
            <div key={strat} className="flex items-center justify-between bg-black/30 rounded px-2 py-1 mb-1">
              <span>{strat}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveStrategy(strat)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DialogContent>
  </Dialog>
)}
                    {/* Session Card */}
                    <Card className="relative overflow-hidden">
                      {theme === 'dark' && (
                      <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `
                            linear-gradient(
                              to bottom,
                              rgba(148,187,163,0.10) 0%,
                              rgba(148,187,163,0.04) 40%,
                              rgba(0,0,0,0.0) 60%,
                              #000 100%
                            )
                          `,
                          zIndex: 0,
                        }}
                      />
                      )}
                      <CardHeader className="relative z-10">
                        <CardTitle className="text-base">Session</CardTitle>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <Select
                          value={selectedSession}
                          onValueChange={handleSessionChange}
                        >
                          <SelectTrigger className={`w-full ${theme === 'light' ? 'border-gray-300 bg-white text-black' : 'border-white/15 bg-black text-white'}`}>
                            <SelectValue placeholder="Select Session" />
                          </SelectTrigger>
                          <SelectContent>
                            {sessionOptions.map(opt => (
                              <SelectItem
                                key={opt}
                                value={opt}
                                className="text-black dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 focus:bg-gray-300 dark:focus:bg-white/30 focus:text-black dark:focus:text-white"
                              >
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                    <Card className="relative overflow-hidden">
  {theme === 'dark' && (
  <div
    aria-hidden
    className="absolute inset-0 pointer-events-none"
    style={{
      background: `
        linear-gradient(
          to bottom,
          rgba(148,187,163,0.10) 0%,
          rgba(148,187,163,0.04) 40%,
          rgba(0,0,0,0.0) 60%,
          #000 100%
        )
      `,
      zIndex: 0,
    }}
  />
  )}
  <CardHeader className="relative z-10">
    <CardTitle className="text-base">Rating</CardTitle>
  </CardHeader>
  <CardContent className="relative z-10 flex gap-2">
{Array.from({ length: 5 }).map((_, i) => (
  <button
    key={i}
    type="button"
    onClick={() => handleSetRating(i + 1)}
    className="focus:outline-none"
    aria-label={`Rate ${i + 1} star${i === 0 ? '' : 's'}`}
  >
    <Star
      className={`w-8 h-8 transition ${
        i < rating ? "glow-star" : ""
      }`}
      fill={i < rating ? "#94bba3" : "transparent"}
      stroke="#94bba3"
    />
  </button>
))}
  </CardContent>
</Card>
                    {/* Setup Checklist Card */}
          <Card className="relative overflow-hidden">
  {theme === 'dark' && (
  <div
    aria-hidden
    className="absolute inset-0 pointer-events-none"
    style={{
      background: `
        linear-gradient(
          to bottom,
          rgba(148,187,163,0.10) 0%,
          rgba(148,187,163,0.04) 40%,
          rgba(0,0,0,0.0) 60%,
          #000 100%
        )
      `,
      zIndex: 0,
    }}
  />
  )}
  <CardHeader className="relative z-10 flex flex-row items-center justify-between">
    <CardTitle className="text-base">Confluence Checklist</CardTitle>
    <Button
      variant="ghost"
      size="icon"
      className="ml-2 text-[#94bba3] hover:text-[#94bba3]/80 transition-colors"
      onClick={() => setShowSetupDialog(true)}
      title="Add Checklist Item"
    >
      <Plus className="h-5 w-5" />
    </Button>
  </CardHeader>
  <CardContent className="relative z-10 flex flex-col gap-2">
    {globalChecklist.length === 0 && (
      <div className="text-muted-foreground text-sm">\</div>
    )}
    {globalChecklist.map((item, idx) => {
      const checked = setupChecklist.some(i => i.text === item && i.checked);
      return (
        <div
          key={item}
          className="flex items-center justify-between px-3 py-2 rounded bg-[#94bba3]/10 border border-white/10 transition"
        >
          <label className="flex items-center gap-2 cursor-pointer w-full">
            {/* Custom Checkbox */}
            <span className="relative flex items-center">
              <input
                type="checkbox"
                checked={checked}
          onChange={() => {
  // Ensure all items are present in setupChecklist
  let updated = globalChecklist.map(text => {
    const found = setupChecklist.find(i => i.text === text);
    if (found) {
      // Toggle the clicked one, keep others as is
      return text === item ? { ...found, checked: !found.checked } : found;
    } else {
      // Add missing items as unchecked, except the clicked one
      return text === item ? { text, checked: true } : { text, checked: false };
    }
  });
  setSetupChecklist(updated);
  if (selectedTrade && selectedTrade.id) {

    
    try {
      updateTrade(selectedTrade.id, { setupChecklist: updated });
    
    } catch (error) {
    
    }
  } else {
  
  }
}}
                className="peer appearance-none w-5 h-5 border border-[#94bba3] rounded bg-transparent cursor-pointer"
              />
              {/* Dot for checked state */}
              <span
                className={`
                  absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                  w-2 h-2 rounded-full
                  ${checked ? "bg-[#94bba3] shadow-[0_0_8px_2px_#94bba3]" : ""}
                  transition
                `}
              />
            </span>
            {/* Checklist text */}
            <span className="text-white">{item}</span>
          </label>
<Button
  variant="ghost"
  size="icon"
  onClick={() => removeChecklistItemFromAllTrades(item)}
  className="text-red-500 hover:text-red-700"
>
  <X className="h-4 w-4" />
</Button>
        </div>
      );
    })}
  </CardContent>
</Card>
{/* Setup Checklist Modal */}
{showSetupDialog && (
  <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Add Checklist Item</DialogTitle>
      </DialogHeader>
      <div>
        <Input
          placeholder="Checklist item"
          value={newChecklistItem}
          onChange={e => setNewChecklistItem(e.target.value)}
          className="mb-4 border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
        />
        <Button
          className="flex items-center gap-2 px-3 py-1 bg-[#94bba3] text-black rounded hover:bg-[#94bba3]/80 transition mb-2"
          onClick={handleAddChecklistItem}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

{selectedTrade && (
  <Dialog open={showScreenshotDialog} onOpenChange={setShowScreenshotDialog}>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>
          {isInitialScreenshot ? "Add/Edit Screenshot Text" : "Add/Edit 2nd Screenshot Text"}
        </DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <Input
          placeholder="Screenshot Description"
          value={screenshotHeadline}
          onChange={e => setScreenshotHeadline(e.target.value)}
          className="border-white/15"
        />
        <div className="flex gap-2">
   <Button
  className="h-9 w-auto px-2 bg-[#94bba3] text-black border border-[#94bba3] hover:bg-[#94bba3]/80 transition-transform"
  onClick={async () => {
    setShowScreenshotDialog(false);
    if (!selectedTrade) return;
    if (isInitialScreenshot) {
      await updateTrade(selectedTrade.id, {
        screenshotHeadline: screenshotHeadline,
      });
    } else {
      await updateTrade(selectedTrade.id, {
        screenshot2Headline: screenshotHeadline,
      });
    }
    // Always reload the trade from Zustand after update:
    const updated = useTradeStore.getState().trades.find(t => t.id === selectedTrade.id);
    setSelectedTrade(updated || selectedTrade);
  }}
  disabled={!screenshotHeadline.trim()}
>
  Save
</Button>
          <Button
            variant="outline"
            className="h-9 w-auto px-2 border border-red-400 text-red-400 hover:bg-red-100/10"
            onClick={async () => {
              setShowScreenshotDialog(false);
              if (!selectedTrade) return;
              if (isInitialScreenshot) {
                await updateTrade(selectedTrade.id, { screenshotHeadline: "" });
                setSelectedTrade({
                  ...selectedTrade,
                  screenshotHeadline: "",
                });
              } else {
                await updateTrade(selectedTrade.id, { screenshot2Headline: "" });
                setSelectedTrade({
                  ...selectedTrade,
                  screenshot2Headline: "",
                });
              }
            }}
          >
            Remove Text
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
)}

      {/* Screenshot Popup Dialog */}
      {popupImage && (
        <Dialog open={!!popupImage} onOpenChange={() => setPopupImage(null)}>
          <DialogContent className="flex flex-col items-center justify-center bg-black/95">
       <img
  src={popupImage}
  alt="Screenshot"
  className="w-auto h-auto max-w-[1800px] max-h-[180vh] rounded shadow-lg"
  onClick={() => setPopupImage(null)}
  style={{ cursor: 'zoom-out' }}
/>
          </DialogContent>
        </Dialog>
      )}
      {showNoteDialog && (
  <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>
          {isAddingNote && !noteHeadline ? 'Add Headline' : 'Add Note'}
        </DialogTitle>
      </DialogHeader>
      {isAddingNote && !noteHeadline ? (
        <div className="grid gap-4 py-4">
          <Input
            placeholder="Headline"
            value={noteHeadline}
            onChange={e => setNoteHeadline(e.target.value)}
            className="border-white/15"
          />
          <Button
            className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
           onClick={() => {
  if (noteHeadline.trim()) {
    setIsAddingNote(false);
  }
}}
            disabled={!noteHeadline}
          >
            Continue
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notePoints.map((point, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[#94bba3] text-xl font-bold">•</span>
              <Input
                value={point}
                onChange={e => {
                  const newPoints = [...notePoints];
                  newPoints[idx] = e.target.value;
                  setNotePoints(newPoints);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && point.trim() !== '') {
                    setNotePoints([...notePoints, '']);
                  }
                }}
                className="border-white/15 flex-1 !bg-transparent"
                placeholder={`Point ${idx + 1}`}
              />
            </div>
          ))}
          <div className="flex justify-end mt-4">
<Button
  className="px-4 py-2 rounded bg-[#94bba3] text-black font-semibold border border-[#94bba3] hover:bg-[#94bba3]/80 transition"
  onClick={async () => {
    const newNotes = [...notes, { headline: noteHeadline, points: notePoints.filter(p => p.trim() !== '') }];
    setNotes(newNotes);
    setShowNoteDialog(false);
    setIsAddingNote(false);
    setNoteHeadline('');
    setNotePoints(['']);
    if (selectedTrade) {
      await updateTrade(selectedTrade.id, { notes: newNotes });
     const updated = useTradeStore.getState().trades.find(t => t.id === selectedTrade.id);
setSelectedTrade(updated || selectedTrade);
    }
  }}
  disabled={!notePoints.some(p => p.trim() !== '')}
>
  Save
</Button>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>
)}

     </PageContainer>
    </>
  );
}