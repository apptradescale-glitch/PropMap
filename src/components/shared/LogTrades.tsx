import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { ImagePlus, X, Plus } from "lucide-react";
import { useTradeStore } from './datastore'
import { useAuth } from '@/context/FAuth';

export function LogTrades() {
  const { currentUser } = useAuth();
  const [symbol, setSymbol] = useState("");
  // Store date as string in YYYY-MM-DD format, no timezone logic
  const [date, setDate] = useState(() => {
    const now = new Date();
    // Always use local date, zero-padded
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const addTrade = useTradeStore(state => state.addTrade);

  // Multi-account P&L state with multiplier
  const [entries, setEntries] = useState([{ account: "", pnl: "", multiplier: 1 }]);
  const [open, setOpen] = useState(false);

  const handleAddEntry = () => {
    setEntries([...entries, { account: "", pnl: "", multiplier: 1 }]);
  };

  const handleRemoveEntry = (idx: number) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const handleEntryChange = (idx: number, field: "account" | "pnl", value: string) => {
    setEntries(entries.map((entry, i) =>
      i === idx ? { ...entry, [field]: value } : entry
    ));
  };

  const handleMultiplierChange = (idx: number, newMultiplier: number) => {
    setEntries(entries.map((entry, i) =>
      i === idx ? { ...entry, multiplier: Math.max(1, newMultiplier) } : entry
    ));
  };

  const handleSubmit = async () => {
    if (!currentUser) {
    
      return;
    }
    setOpen(false);

    let screenshotString: string | null = null;
    if (screenshot instanceof File) {
      screenshotString = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(screenshot);
      });
    }

    // Combine all entries into one trade
    const filteredEntries = entries.filter(e => e.account && e.pnl);
    if (filteredEntries.length === 0) return;

    const cumulativePnl = filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.pnl) * entry.multiplier,
      0
    );
    const accountsString = filteredEntries
      .map(entry => entry.account)
      .join(" & ");

    // Store date as plain string, no Date object
    await addTrade({
      symbol,
      pnl: cumulativePnl,
      account: accountsString,
      date, // plain string, e.g. "2025-07-01"
      screenshot: screenshotString,
    });

    // Reset form
    setSymbol('');
    setEntries([{ account: "", pnl: "", multiplier: 1 }]);
    // Reset to today's local date
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
    setScreenshot(null);
  };

  const handleCalendarClick = () => {
    const dateInput = document.getElementById('date');
    if (dateInput) {
      // @ts-ignore
      dateInput.showPicker();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-9 w-auto px-2 bg-[#94bba3]/20 border border-white/15 hover:bg-[#94bba3]/20 transition-transform hover:scale-105"
        >
          Log Trade manually
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Trade</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder=""
              className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
            />
          </div>
          {/* Multi-account P&L/Account pairs */}
          {entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex gap-2 items-end bg-transparent rounded-md p-2"
            >
              {/* P&L input - 50% width */}
              <div className="flex-1">
                <Label>P&L</Label>
                <Input
                  value={entry.pnl}
                  onChange={e => handleEntryChange(idx, "pnl", e.target.value)}
                  type="number"
                  placeholder=""
                  className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
                />
              </div>
              {/* Account input - 50% width */}
              <div className="flex-1">
                <Label className="flex items-center gap-1">
                  Account
                  <span className="mx-2 text-muted-foreground">|</span>
                  <span className="text-xs text-[#94bba3]">x{entry.multiplier}</span>
                  <button
                    type="button"
                    onClick={() => handleMultiplierChange(idx, entry.multiplier + 1)}
                    className="ml-1 px-1 text-xs border border-white/15 rounded hover:bg-[#94bba3]/20"
                    title="Increase multiplier"
                  >+</button>
                  <button
                    type="button"
                    onClick={() => handleMultiplierChange(idx, entry.multiplier - 1)}
                    className="ml-1 px-1 text-xs border border-white/15 rounded hover:bg-[#94bba3]/20"
                    title="Decrease multiplier"
                    disabled={entry.multiplier <= 1}
                  >-</button>
                </Label>
                <div className="flex items-center mt-1">
                  <Input
                    value={entry.account}
                    onChange={e => handleEntryChange(idx, "account", e.target.value)}
                    placeholder=""
                    className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              {entries.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveEntry(idx)}
                  className="mb-2 ml-1"
                  title="Remove"
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            onClick={handleAddEntry}
            className="h-9 w-9 px-0 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform text-2xl flex items-center justify-center"
            title="Add another account"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <div className="relative">
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 pl-10"
              />
              <button
                type="button"
                onClick={handleCalendarClick}
                className="absolute left-2 top-1.5 p-1 hover:text-[#94bba3]"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="screenshot">Screenshot</Label>
            <div className="relative">
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setScreenshot(file);
                }}
                className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 pl-10
                file:hidden file:border-0 text-transparent placeholder:text-transparent cursor-pointer"
              />
              <div className="absolute left-2 top-1.5 p-1">
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="absolute left-10 top-[7px] text-sm text-muted-foreground pointer-events-none">
                {screenshot ? screenshot.name : "Upload here"}
              </span>
              {screenshot && (
                <button
                  onClick={() => setScreenshot(null)}
                  className="absolute right-2 top-1.5 p-1 hover:text-red-400"
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-center px-4 pb-4">
            <Button
              onClick={handleSubmit}
              className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
            >
              Submit 
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}