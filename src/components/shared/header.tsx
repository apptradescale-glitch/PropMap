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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useBusiness } from '@/context/BusinessContext';
import { useAuth } from '@/context/FAuth';
import { db } from '@/config/firestore';
import { doc, getDoc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import '@/styles/date-input.css';
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
  const { business, addPayout, addExpense } = useBusiness();
  const { currentUser } = useAuth();
  const isBusinessDetail = pathname.startsWith('/dashboard/business/');
  const isPropTrading = business?.businessSector === 'proptrading';

  const [dateRangeText, setDateRangeText] = useState('All');
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  
  // Add Numbers state
  const [entryMode, setEntryMode] = useState<'manual' | 'automatic'>('manual');
  const [entryType, setEntryType] = useState<'payouts' | 'expenses'>('payouts');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [selectedFirm, setSelectedFirm] = useState('Topstep');
  const [customFirm, setCustomFirm] = useState('');
  const [isNotFromPropFirm, setIsNotFromPropFirm] = useState(false);

  const handleAddEntry = async () => {
    if (!currentUser || !business || business?.isCombinedView) {
      console.error('Cannot add financial data. Need to be on a business detail page with a valid business.');
      return;
    }

    // Get the firm name (either selected or custom) - only for prop trading and if not from prop firm is unchecked
    let fullDescription = entryDescription;
    
    if (isPropTrading && !isNotFromPropFirm) {
      const firmName = selectedFirm === 'Other' ? customFirm : selectedFirm;
      fullDescription += ` | ${firmName}`;
    }

    // Use business ID as primary identifier, fallback to name if no ID
    const businessId = business?.id || business?.name || 'default';
    const businessName = business?.businessSector === 'proptrading' ? business.userName : business.name;

    // Create the new item
    const newItem = {
      id: crypto.randomUUID(),
      type: entryType, // 'payouts' or 'expenses'
      businessId: businessId,
      businessName: businessName,
      businessSector: business?.businessSector,
      customSector: business?.customSector,
      amount: Number(entryAmount),
      description: fullDescription,
      fileName: null,
      timestamp: new Date(entryDate).toISOString(),
      date: entryDate, // Use selected date
    };

    // Optimistic update - update local state immediately
    if (entryType === 'payouts') {
      addPayout(newItem);
    } else {
      addExpense(newItem);
    }

    // Save to Firestore in the background
    try {
      const collectionRef = doc(db, entryType, currentUser.uid);
      const docSnap = await getDoc(collectionRef);

      if (docSnap.exists()) {
        await updateDoc(collectionRef, {
          items: arrayUnion(newItem)
        });
      } else {
        await setDoc(collectionRef, {
          items: [newItem]
        });
      }
    } catch (error) {
      console.error('Error saving financial data:', error);
      alert('Failed to save data. Please try again.');
      throw error;
    }

    // Reset form
    setEntryAmount('');
    setEntryDescription('');
    setEntryDate(new Date().toISOString().split('T')[0]); // Reset to today
    setSelectedFirm('Topstep');
    setCustomFirm('');
    setIsNotFromPropFirm(false);
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
    {/* Add Numbers button - only on business detail page with valid business */}
    {isBusinessDetail && business && (
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
                        entryType === 'payouts'
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent border-[#2a2a2a] text-[#666]'
                      }`}
                      onClick={() => setEntryType('payouts')}
                    >
                      Payout
                    </button>
                    <button
                      className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all cursor-pointer ${
                        entryType === 'expenses'
                          ? 'bg-white text-black border-white'
                          : 'bg-transparent border-[#2a2a2a] text-[#666]'
                      }`}
                      onClick={() => setEntryType('expenses')}
                    >
                      Expense
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-[#666] text-sm">
                    {entryType === 'payouts' ? 'Payout Amount' : 'Expense Amount'}
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

                {/* Date Input */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-[#666] text-sm">Date</Label>
                  <div className="relative">
                    <Input
                      id="date"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="dark-mode-date-input bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555] [&::-webkit-calendar-picker-indicator]:!invert [&::-webkit-calendar-picker-indicator]:!opacity-100"
                      max={new Date().toISOString().split('T')[0]} // Prevent future dates
                    />
                  </div>
                </div>

                {/* Firm Selection - Only show for prop trading businesses */}
                {isPropTrading && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="not-from-prop-firm"
                        checked={isNotFromPropFirm}
                        onCheckedChange={(checked) => setIsNotFromPropFirm(checked as boolean)}
                        className="border-[#2a2a2a] data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-black"
                      />
                      <Label htmlFor="not-from-prop-firm" className="text-[#666] text-sm cursor-pointer">
                        This {entryType.toLowerCase()} is not from a prop firm
                      </Label>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[#666] text-sm">Firm</Label>
                      <Select value={selectedFirm} onValueChange={setSelectedFirm} disabled={isNotFromPropFirm}>
                        <SelectTrigger className={`bg-[#1a1a1a] border-[#2a2a2a] text-white ${isNotFromPropFirm ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                          <SelectItem value="Topstep" className="text-white">Topstep</SelectItem>
                          <SelectItem value="Apex Funding Trader" className="text-white">Apex Funding Trader</SelectItem>
                          <SelectItem value="Other" className="text-white">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Firm Input - Only show when "Other" is selected */}
                    {selectedFirm === 'Other' && (
                      <div className="space-y-2">
                        <Label htmlFor="custom-firm" className="text-[#666] text-sm">Custom Firm Name</Label>
                        <Input
                          id="custom-firm"
                          type="text"
                          placeholder="Enter firm name..."
                          value={customFirm}
                          onChange={(e) => setCustomFirm(e.target.value)}
                          disabled={isNotFromPropFirm}
                          className={`bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555] ${isNotFromPropFirm ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Add Button */}
                <Button
                  onClick={handleAddEntry}
                  className="w-full bg-white text-black hover:bg-gray-200 font-medium"
                  disabled={!entryAmount || !entryDescription || (isPropTrading && !isNotFromPropFirm && selectedFirm === 'Other' && !customFirm)}
                >
                  Add {entryType === 'payouts' ? 'Payout' : 'Expense'}
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
