'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pen } from 'lucide-react';
import { useTradeStore } from '@/components/shared/datastore';
import { useAuth } from '@/context/FAuth';
import { useTheme } from "@/providers/theme-provider";
import lg34 from '@/assets/images/lg34.png';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Stat {
  day: number;
  value: string;
  trend: 'up' | 'down';
  date: string;
  trades?: any[];
  dayOfWeek?: number; // 0 = Mon, 1 = Tue, ..., 5 = Sat, 6 = Sun
}

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Weekly P&L', 'Monthly P&L'];

function generateCalendarDays(date: Date, trades: any[]) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const firstDayOffset = (firstDay.getDay() + 6) % 7;

  const days: (Stat | { isEmpty: true })[] = [];

  // Add empty cells for days before the first of the month
  for (let i = 0; i < firstDayOffset; i++) {
    days.push({ isEmpty: true });
  }

  // Add actual days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const yyyy = firstDay.getFullYear();
    const mm = String(firstDay.getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;

    // Calculate day of week (0 = Monday, 6 = Sunday)
    const currentDate = new Date(yyyy, parseInt(mm) - 1, day);
    const dayOfWeek = (currentDate.getDay() + 6) % 7;

    // Find all trades for this date
    const dayTrades = trades.filter(trade => trade.date === dateString);

    if (dayTrades.length > 0) {
      // Calculate total P&L for the day
      const totalPnL = dayTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
      days.push({
        day,
        value: formatCurrency(totalPnL),
        trend: totalPnL >= 0 ? 'up' : 'down',
        date: dateString,
        trades: dayTrades,
        dayOfWeek,
      });
    } else {
      days.push({
        day,
        value: '',
        trend: 'up',
        date: dateString,
        trades: [],
        dayOfWeek,
      });
    }
  }

  return days;
}

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

// Format date as "16th June 2025"
function formatFullDate(dateString: string) {
  if (!dateString) return '';
  const [yyyy, mm, dd] = dateString.split('-');
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const suffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  return `${day}${suffix(day)} ${month} ${year}`;
}

const WeekdayCard = ({ day }: { day: string }) => {
  const { theme } = useTheme();
  return (
   <div className={`p-1.5 rounded-md border ${theme === 'light' ? 'border-gray-400' : 'border-border'} bg-card`}>
      <div className="flex items-center justify-center h-[20px]">
        <span className="text-xs font-medium text-muted-foreground">
          {day}
        </span>
      </div>
    </div>
  );
};

const DayCard = ({ stat, allTrades = [], currentMonth, numRowsInMonth = 6 }: { stat: Stat | { isEmpty: true }; allTrades?: any[]; currentMonth: Date; numRowsInMonth?: number }) => {
  const [open, setOpen] = useState(false);
  const [journalNotes, setJournalNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [fullscreenScreenshot, setFullscreenScreenshot] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();

  const handleScreenshotUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          if (e.target?.result) {
            const newScreenshots = [...screenshots, e.target.result as string];
            setScreenshots(newScreenshots);
            
            // Save to Firestore via API
            if (currentUser && 'date' in stat) {
              try {
                const token = await currentUser.getIdToken();
                await fetch('/api/firestore-save-journal', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    userId: currentUser.uid,
                    date: stat.date,
                    notes: savedNotes,
                    screenshots: newScreenshots
                  })
                });
              } catch (error) {
              
              }
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Load journal data from Firestore via API
  const loadJournalFromFirestore = async () => {
    if (!currentUser || !('date' in stat)) return;
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/firestore-get-journal?userId=${currentUser.uid}&date=${stat.date}`, {
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.exists) {
        setSavedNotes(data.notes || []);
        setScreenshots(data.screenshots || []);
      }
    } catch (error) {
    
    }
  };

  // Load journal data when dialog opens
  useEffect(() => {
    if (open) {
      loadJournalFromFirestore();
    }
  }, [open]);


  if ('isEmpty' in stat) {
    return (
      <div className="p-1.5 h-[58px] rounded-md border border-border bg-card" />
    );
  }

  // Check if this is a Saturday - if so, show weekly P&L instead
  if (stat.dayOfWeek === 5) {
    // This is Saturday - show weekly P&L for Mon-Fri of this week
    // Parse date parts manually to avoid UTC timezone shift
    const [yyyy, mm, dd] = stat.date.split('-').map(Number);
    const currentDate = new Date(yyyy, mm - 1, dd);
    const weekStart = new Date(yyyy, mm - 1, dd - 5); // Go back to Monday
    const weekStartString = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    
    const fridayDate = new Date(yyyy, mm - 1, dd - 1); // Go back to Friday
    const fridayString = `${fridayDate.getFullYear()}-${String(fridayDate.getMonth() + 1).padStart(2, '0')}-${String(fridayDate.getDate()).padStart(2, '0')}`;

    const weekTrades = allTrades.filter(trade => {
      return trade.date >= weekStartString && trade.date <= fridayString;
    });

    const weeklyPnL = weekTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
    const weeklyValue = formatCurrency(weeklyPnL);
    const value = weeklyPnL;
    const isPositive = value > 0;
    const isNegative = value < 0;
    const isZero = value === 0;
    const hasTrades = weekTrades.length > 0;

    const shadowClass = isNegative
      ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(239,68,68,0.3)]"
      : isPositive
        ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(16,185,129,0.3)]"
        : isZero
          ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(148,163,184,0.3)]"
          : "";

    const borderClass = isNegative
      ? "border-red-500/15"
      : isPositive
        ? "border-emerald-500/15"
        : isZero
          ? "border-slate-500/15"
          : "border-border";

    const textClass = isNegative
      ? "text-red-500"
      : isPositive
        ? "text-emerald-500"
        : "text-muted-foreground";

    return (
      <>
        <div
          className={`relative p-1.5 rounded-md border ${borderClass} bg-card 
            hover:shadow-md transition-all duration-300
            hover:border-white/30 ${shadowClass} h-[58px]`}
          onClick={() => hasTrades && setOpen(true)}
          title={hasTrades ? "View trades for this week" : "No trades this week"}
          style={{ cursor: hasTrades ? 'pointer' : 'default' }}
        >
          <div className="flex flex-col h-full">
            <span className="text-xs text-muted-foreground text-center">Week</span>
            <div className="flex-1 flex items-center justify-center mb-1">
              <span className={`text-sm font-medium ${textClass}`}>
                {weeklyValue || ' '}
              </span>
            </div>
          </div>
        </div>
        {hasTrades && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Trades for week of {weekStartString} to {fridayString}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {weekTrades.map((trade, idx) => (
                  <div key={idx} className="border-b border-white/10 pb-2">
                    <div className="flex flex-row items-center min-h-[64px]">
                      {/* Left: Symbol and Account */}
                      <div className="flex flex-col justify-between flex-1 h-full">
                        <span className="font-semibold text-base">{trade.symbol}</span>
                        <span className="text-xs text-muted-foreground">{trade.account}</span>
                      </div>
                      {/* Right: P&L */}
                      <div className="flex items-center h-full ml-4">
                        <span
                          className={`font-semibold text-2xl ${
                            trade.pnl > 0
                              ? 'text-emerald-500'
                              : trade.pnl < 0
                              ? 'text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {formatCurrency(trade.pnl)}
                        </span>
                      </div>
                    </div>
                    {trade.description && (
                      <div className="text-xs mt-1">{trade.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // Check if this is a Sunday - if so, show monthly P&L instead (only on first Sunday)
  if (stat.dayOfWeek === 6) {
    // This is Sunday - show monthly P&L, but only render once (on the first Sunday)
    if (stat.day <= 7) {
      // This is the first Sunday of the month
      const monthlyTrades = allTrades.filter(trade => {
        const [ty, tm] = trade.date.split('-').map(Number);
        return ty === currentMonth.getFullYear() && 
               (tm - 1) === currentMonth.getMonth();
      });

      const monthlyPnL = monthlyTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
      const monthName = currentMonth.toLocaleString('en-US', { month: 'long' });
      const monthlyValue = formatCurrency(monthlyPnL);
      const value = monthlyPnL;
      const isPositive = value > 0;
      const isNegative = value < 0;
      const isZero = value === 0;
      const hasTrades = monthlyTrades.length > 0;

      const shadowClass = isNegative
        ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(239,68,68,0.3)]"
        : isPositive
          ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(16,185,129,0.3)]"
          : isZero
            ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(148,163,184,0.3)]"
            : "";

      const borderClass = isNegative
        ? "border-red-500/15"
        : isPositive
          ? "border-emerald-500/15"
          : isZero
            ? "border-slate-500/15"
            : "border-border";

      const textClass = isNegative
        ? "text-red-500"
        : isPositive
          ? "text-emerald-500"
          : "text-muted-foreground";

      return (
        <>
          <div
            className={`relative p-2 rounded-md border ${borderClass} bg-card 
              hover:shadow-md transition-all duration-300
              hover:border-white/30 ${shadowClass}`}
            onClick={() => hasTrades && setOpen(true)}
            title={hasTrades ? "View trades for this month" : "No trades this month"}
            style={{ 
              cursor: hasTrades ? 'pointer' : 'default',
              gridRow: `span ${numRowsInMonth}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '58px'
            }}
          >
            <div className="flex flex-col h-full justify-center items-center space-y-2">
              <div className="text-center">
                <span className="text-sm font-semibold text-muted-foreground block">{monthName}</span>
                <span className="text-xs text-muted-foreground block">Monthly P&L</span>
              </div>
              <div className="text-center">
                <span className={`text-lg font-bold ${textClass}`}>
                  {monthlyValue}
                </span>
              </div>
            </div>
          </div>
          {hasTrades && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    All trades for {monthName}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {monthlyTrades.map((trade, idx) => (
                    <div key={idx} className="border-b border-white/10 pb-2">
                      <div className="flex flex-row items-center min-h-[64px]">
                        {/* Left: Symbol and Account */}
                        <div className="flex flex-col justify-between flex-1 h-full">
                          <span className="font-semibold text-base">{trade.symbol}</span>
                          <span className="text-xs text-muted-foreground">{trade.account}</span>
                        </div>
                        {/* Right: P&L */}
                        <div className="flex items-center h-full ml-4">
                          <span
                            className={`font-semibold text-2xl ${
                              trade.pnl > 0
                                ? 'text-emerald-500'
                                : trade.pnl < 0
                                ? 'text-red-500'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {formatCurrency(trade.pnl)}
                          </span>
                        </div>
                      </div>
                      {trade.description && (
                        <div className="text-xs mt-1">{trade.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      );
    } else {
      // Not the first Sunday - don't render anything (it's covered by the first Sunday's span)
      return null;
    }
  }

  const value = stat.value ? Number(stat.value.replace(/[^0-9.-]/g, '')) : null;
  const isPositive = (value ?? 0) > 0;
  const isNegative = (value ?? 0) < 0;
  const isZero = value === 0;
  const hasTrades = stat.trades && stat.trades.length > 0;

  const shadowClass = isNegative
    ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(239,68,68,0.3)]"
    : isPositive
      ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(16,185,129,0.3)]"
      : isZero
        ? "shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(148,163,184,0.3)]"
        : "";

  const borderClass = isNegative
    ? "border-red-500/15"
    : isPositive
      ? "border-emerald-500/15"
      : isZero
        ? "border-slate-500/15"
        : "border-border";

  const textClass = isNegative
    ? "text-red-500"
    : isPositive
      ? "text-emerald-500"
      : "text-muted-foreground";

  return (
    <>
      <div
        className={`relative p-1.5 rounded-md border ${borderClass} bg-card 
          hover:shadow-md transition-all duration-300
          hover:border-white/30 ${shadowClass} h-[58px]`}
        onClick={() => hasTrades && setOpen(true)}
        title={hasTrades ? "View trades for this day" : undefined}
        style={{ cursor: hasTrades ? 'pointer' : 'default' }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{stat.day}</span>
            {hasTrades && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
                className="p-0.5 rounded border border-white/20 bg-transparent hover:scale-110 transition-transform"
              >
                {savedNotes.length > 0 || screenshots.length > 0 ? (
                  <Pen 
                    className="h-3 w-3"
                    color="#94bba3"
                  />
                ) : (
                  <Pen
                    className="h-3 w-3"
                    color="#94bba3"
                  />
                )}
              </button>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center mb-1">
            <span className={`text-sm font-medium ${textClass}`}>
              {stat.value || ' '}
            </span>
          </div>
        </div>
      </div>
      {hasTrades && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="!w-[1400px] !h-[700px] !max-w-none !max-h-none p-0 flex flex-col">
            <div className="flex h-full">
              {/* Left side - 3/4 width - Journal */}
              <div className="w-3/4 flex flex-col overflow-hidden p-4">
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <img src={lg34} alt="logo" className="h-6 w-7" />
                    <span className="text-sm font-semibold">Daily Journal, {formatFullDate(stat.date)}</span>
                  </div>
                  <div className="h-px bg-white/20"></div>
                </div>
                
                {/* Top 75% - Notes section */}
                <div className="h-3/4 flex flex-col overflow-hidden pb-4 pr-2">
                  <div className="flex flex-col">
                    <textarea
                      value={journalNotes}
                      onChange={(e) => setJournalNotes(e.target.value)}
                      placeholder="♔ Trading Notes..."
                      className="w-full h-[100px] bg-background border border-white/20 rounded text-sm p-3 text-white placeholder-muted-foreground resize-none !outline-none !ring-0 focus:border-[#94bba3] focus:ring-2 focus:ring-[#94bba3]/50"
                      style={{
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={async () => {
                          if (journalNotes.trim()) {
                            const newNotes = [...savedNotes, journalNotes];
                            setSavedNotes(newNotes);
                            setJournalNotes('');
                            
                            // Save to Firestore via API
                            if (currentUser && 'date' in stat) {
                              try {
                                const token = await currentUser.getIdToken();
                                await fetch('/api/firestore-save-journal', {
                                  method: 'POST',
                                  headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    userId: currentUser.uid,
                                    date: stat.date,
                                    notes: newNotes,
                                    screenshots: screenshots
                                  })
                                });
                              } catch (error) {
                            
                              }
                            }
                          }
                        }}
                        className="h-7 w-auto px-2 bg-[#94bba3]/20 border border-white/15 hover:bg-[#94bba3]/20 transition-transform hover:scale-105 rounded text-xs font-semibold text-white"
                      >
                        Save Point
                      </button>
                    </div>
                  </div>

                  {/* Display saved notes */}
                  <div className="mt-4 space-y-2 flex-1 overflow-y-auto w-full overflow-x-hidden scrollbar-thin">
                    {savedNotes.map((note, idx) => (
                      <div key={idx} className="flex gap-2 group hover:bg-white/5 p-1 rounded transition-colors">
                        <svg width="16" height="16" viewBox="0 0 16 16" className="flex-shrink-0 mt-0.5">
                          <polygon
                            points="8,2 14,14 2,14"
                            fill="transparent"
                            stroke="#94bba3"
                            strokeWidth="1.5"
                          />
                        </svg>
                        <span className="text-sm text-white break-words whitespace-normal flex-1">{note}</span>
                        <button
                          onClick={async () => {
                            const newNotes = savedNotes.filter((_, i) => i !== idx);
                            setSavedNotes(newNotes);
                            
                            // Remove from Firestore via API
                            if (currentUser && 'date' in stat) {
                              try {
                                const token = await currentUser.getIdToken();
                                await fetch('/api/firestore-save-journal', {
                                  method: 'POST',
                                  headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    userId: currentUser.uid,
                                    date: stat.date,
                                    notes: newNotes,
                                    screenshots: screenshots
                                  })
                                });
                              } catch (error) {
                             
                              }
                            }
                          }}
                          className="flex-shrink-0 ml-1 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Separator line */}
                <div className="h-px bg-white/20 my-2"></div>

                {/* Bottom 25% - Screenshots section */}
                <div className="h-1/4 flex flex-col overflow-hidden">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-fit flex items-center gap-2 h-8 px-3 bg-[#94bba3]/20 border border-white/15 hover:bg-[#94bba3]/30 transition-transform hover:scale-105 rounded text-xs font-semibold text-white mb-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Screenshot
                  </button>

                  {/* Display screenshots */}
                  <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin flex gap-2">
                    {screenshots.map((screenshot, idx) => (
                      <div key={idx} className="flex-shrink-0 relative group">
                        <img
                          src={screenshot}
                          alt={`Screenshot ${idx + 1}`}
                          className="h-full max-h-[110px] rounded border border-white/20 cursor-pointer hover:border-[#94bba3] transition-colors"
                          onClick={() => setFullscreenScreenshot(screenshot)}
                        />
                        <button
                          onClick={async () => {
                            const newScreenshots = screenshots.filter((_, i) => i !== idx);
                            setScreenshots(newScreenshots);
                            
                            // Save to Firestore via API
                            if (currentUser && 'date' in stat) {
                              try {
                                const token = await currentUser.getIdToken();
                                await fetch('/api/firestore-save-journal', {
                                  method: 'POST',
                                  headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    userId: currentUser.uid,
                                    date: stat.date,
                                    notes: savedNotes,
                                    screenshots: newScreenshots
                                  })
                                });
                              } catch (error) {
                             
                              }
                            }
                          }}
                          className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Fullscreen screenshot modal */}
                  {fullscreenScreenshot && (
                    <Dialog open={!!fullscreenScreenshot} onOpenChange={() => setFullscreenScreenshot(null)}>
                      <DialogContent className="!w-[90vw] !h-[90vh] !max-w-none !max-h-none p-0 flex items-center justify-center bg-black/80 backdrop-blur">
                        <img
                          src={fullscreenScreenshot}
                          alt="Fullscreen screenshot"
                          className="max-w-full max-h-full object-contain rounded"
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Vertical separator */}
              <div className="border-l border-white/20"></div>

              {/* Right side - 1/4 width - Trades info */}
              <div className="w-1/4 flex flex-col overflow-hidden p-4 pt-0">
                <div className="mb-3 pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2 mt-1">
                    <span className="text-sm font-semibold">Logs</span>
                  </div>
                  <div className="h-px bg-white/20"></div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent space-y-3">
                  {stat.trades!.map((trade, idx) => (
                    <div key={idx} className="pb-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{trade.symbol}</span>
                        <span className="text-xs text-muted-foreground">{trade.account}</span>
                        <span
                          className={`font-semibold text-lg mt-1 ${
                            trade.pnl > 0
                              ? 'text-emerald-500'
                              : trade.pnl < 0
                              ? 'text-red-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {formatCurrency(trade.pnl)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-white/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Daily Trade History</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground"></span>
                      <span className="text-xs font-semibold text-muted-foreground">Day P&L</span>
                      <span className={`text-xs font-bold ${
                        stat.trades && stat.trades.reduce((sum, trade) => sum + Number(trade.pnl), 0) > 0
                          ? 'text-emerald-500'
                          : stat.trades && stat.trades.reduce((sum, trade) => sum + Number(trade.pnl), 0) < 0
                          ? 'text-red-500'
                          : 'text-muted-foreground'
                      }`}>
                        {formatCurrency(stat.trades?.reduce((sum, trade) => sum + Number(trade.pnl), 0) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export function TradingCalendar() {
  const { currentUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const trades = useTradeStore(state => state.trades);
  const filterCriteria = useTradeStore(state => state.filterCriteria);

  // Myfxbook trades state
  const [myfxbookTrades, setMyfxbookTrades] = useState<any[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);

  // Fetch connected accounts
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
            data.history.map((trade: any) => ({
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

  // Merge manual and Myfxbook trades, then filter
  const filteredTrades = useMemo(() => {
    if (!currentUser) return [];

    // Manual trades (add source for clarity)
    const manualTrades = trades
      .filter(trade => trade.userId === currentUser.uid)
      .map(trade => ({ ...trade, source: 'manual' }));

    // Merge both sources
    const allTrades = [...manualTrades, ...myfxbookTrades];

    // Apply filters
    return allTrades.filter(trade => {
      const matchesSymbol = !filterCriteria.symbol ||
        trade.symbol?.toLowerCase().includes(filterCriteria.symbol.toLowerCase());
      const matchesAccount = !filterCriteria.account ||
        trade.account?.toLowerCase().includes(filterCriteria.account.toLowerCase());
      return matchesSymbol && matchesAccount;
    });
  }, [trades, myfxbookTrades, filterCriteria, currentUser]);

  // Use filtered trades for calendar generation
  const calendarDays = generateCalendarDays(currentMonth, filteredTrades);

  return (
    <Card className="col-span-7 lg:col-span-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div>
          <CardTitle>Calendar</CardTitle>
          <CardDescription className="text-muted-foreground mb-4">
            {currentUser ? 'Trade Execution Logbook' : 'Please sign in to view your trades'}
          </CardDescription>
        </div>
        {currentUser && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setMonth(newDate.getMonth() - 1);
                setCurrentMonth(newDate);
              }}
              className="p-2 hover:bg-white/5 rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {currentMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => {
                const newDate = new Date(currentMonth);
                newDate.setMonth(newDate.getMonth() + 1);
                setCurrentMonth(newDate);
              }}
               className="p-2 hover:bg-white/5 rounded-md"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!currentUser ? (
          <div className="text-center text-muted-foreground py-4">
            Sign in to view your trading calendar
          </div>
        ) : (
          <>
            {(() => {
              // Calculate number of rows in the calendar
              const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
              const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
              const firstDayOffset = (firstDay.getDay() + 6) % 7;
              const numRowsInMonth = Math.ceil((firstDayOffset + lastDay.getDate()) / 7);
              
              return (
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => (
                    <WeekdayCard key={day} day={day} />
                  ))}
                  {calendarDays.map((day, index) => (
                    <DayCard key={`day-${index}`} stat={day} allTrades={filteredTrades} currentMonth={currentMonth} numRowsInMonth={numRowsInMonth} />
                  ))}
                </div>
              );
            })()}
          </>
        )}
      </CardContent>
    </Card>
  );
}