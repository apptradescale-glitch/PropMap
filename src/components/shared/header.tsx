import { navItems } from '@/constants/data';
import { usePathname } from '@/routes/hooks';
import Heading from './heading';
import { ModeToggle } from './theme-toggle';
import React, { useState } from 'react';
import { UserNav } from './user-nav';
import MobileSidebar from './mobile-sidebar';
import { cn } from '@/lib/utils';
import { LogTrades } from './LogTrades';
import { Riskcalc } from './Riskcalc';
import { Filter } from './Filter';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Custom hook to find the matched path
const useMatchedPath = (pathname: string) => {
  const matchedPath =
    navItems.find((item) => item.href === pathname) ||
    navItems.find(
      (item) => pathname.startsWith(item.href + '/') && item.href !== '/'
    );
  return matchedPath?.title || '';
};

export default function Header() {
  const pathname = usePathname();
  const headingText = useMatchedPath(pathname);
  const navigate = useNavigate();
  const isBusinessDetail = pathname.startsWith('/dashboard/business/');

  const [dateRangeText, setDateRangeText] = useState('All');
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  
  // Add Numbers state
  const [entryMode, setEntryMode] = useState<'manual' | 'automatic'>('manual');
  const [entryType, setEntryType] = useState<'payout' | 'expense'>('payout');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDescription, setEntryDescription] = useState('');

  const handleAddEntry = async () => {
    // This would save to Firestore - for now just show an alert
    alert(`Adding ${entryType}: $${entryAmount} - ${entryDescription}`);
    // Reset form
    setEntryAmount('');
    setEntryDescription('');
    setIsDateDialogOpen(false);
  };

  return (
    <header className="sticky inset-x-0 top-0 w-full z-50">
<nav className="flex items-center justify-between px-4 py-2 md:justify-end relative">
  <div className={cn('block md:!hidden')}>
    <MobileSidebar />
  </div>

  {/* Back button - only on business detail page */}
  {isBusinessDetail && (
    <Button
      variant="outline"
      size="icon"
      onClick={() => navigate('/dashboard')}
      className="-mb-10 mt-6 relative z-50 pointer-events-auto"
    >
      <ArrowLeft className="w-4 h-4" />
    </Button>
  )}

  <div className="flex-1 flex justify-center relative" style={{ bottom: '-2rem' }}>
    {/* Add Numbers button - only on business detail page */}
    {isBusinessDetail && (
      <div className="pointer-events-auto">
        <span 
          style={{
            background: '#fff',
            color: '#000',
            fontSize: 13,
            fontWeight: 500,
            padding: '5px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onClick={() => setIsDateDialogOpen(true)}
        >
          +Add Numbers
        </span>

        <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
          <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white mb-4">Add Numbers</DialogTitle>
            </DialogHeader>
            
            {/* Manual/Automatic Toggle */}
            <div className="flex items-center justify-center mb-6">
              <div className="bg-[#1a1a1a] rounded-lg p-1 flex">
                <button
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    entryMode === 'manual' 
                      ? 'bg-white text-black' 
                      : 'text-[#666] hover:text-white'
                  }`}
                  onClick={() => setEntryMode('manual')}
                >
                  Manual
                </button>
                <button
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    entryMode === 'automatic' 
                      ? 'bg-white text-black' 
                      : 'text-[#666] hover:text-white'
                  }`}
                  onClick={() => setEntryMode('automatic')}
                >
                  Automatic
                </button>
              </div>
            </div>

            {/* Manual Entry Form */}
            {entryMode === 'manual' && (
              <div className="space-y-4">
                {/* Type Selection */}
                <div className="space-y-2">
                  <Label className="text-[#666] text-sm">Type</Label>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all cursor-pointer ${
                        entryType === 'payout'
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent border-[#2a2a2a] text-[#666]'
                      }`}
                      onClick={() => setEntryType('payout')}
                    >
                      Payout
                    </button>
                    <button
                      className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all cursor-pointer ${
                        entryType === 'expense'
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent border-[#2a2a2a] text-[#666]'
                      }`}
                      onClick={() => setEntryType('expense')}
                    >
                      Expense
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-[#666] text-sm">
                    {entryType === 'payout' ? 'Payout Amount' : 'Expense Amount'}
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder=""
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                  />
                </div>

                {/* Description Input */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[#666] text-sm">Description</Label>
                  <Input
                    id="description"
                    type="text"
                    placeholder=""
                    value={entryDescription}
                    onChange={(e) => setEntryDescription(e.target.value)}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                  />
                </div>

                {/* Add Button */}
                <Button
                  onClick={handleAddEntry}
                  className="w-full bg-white text-black hover:bg-gray-200 font-medium"
                  disabled={!entryAmount || !entryDescription}
                >
                  Add {entryType === 'payout' ? 'Payout' : 'Expense'}
                </Button>
              </div>
            )}

            {/* Automatic Entry */}
            {entryMode === 'automatic' && (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <p className="text-[#666] mb-6">
                    Connect your bank account to automatically import your transactions
                  </p>
                  <span 
                    style={{
                      background: '#fff',
                      color: '#000',
                      fontSize: 13,
                      fontWeight: 500,
                      padding: '5px 14px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    onClick={() => navigate('/dashboard/BankConnection')}
                  >
                    Connect Your Bank
                  </span>
                </div>
              </div>
            )}

                      </DialogContent>
        </Dialog>
      </div>
    )}
  </div>
  <div className="flex items-center gap-2 -mb-10 mt-6 relative z-50 pointer-events-auto">

    <ModeToggle />
    <UserNav />
  </div>
</nav>
    </header>
  );
}
