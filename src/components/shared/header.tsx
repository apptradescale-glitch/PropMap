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

  return (
    <header className="sticky inset-x-0 top-0 w-full z-50">
<nav className="flex items-center justify-between px-4 py-2 md:justify-end relative">
  <div className={cn('block md:!hidden')}>
    <MobileSidebar />
  </div>

  {/* Back button - only on business detail page */}
  {isBusinessDetail && (
    <div className="flex items-center gap-2 -mb-10 mt-6 relative z-50 pointer-events-auto">
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate('/dashboard')}
        className="bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white h-8 w-8"
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>

      {/* Date Range button - only on business detail page */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsDateDialogOpen(true)}
        className="bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white min-w-[120px]"
      >
        {dateRangeText}
        <Calendar className="w-4 h-4 ml-2" />
      </Button>

      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Select Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="header-start-date" className="text-[#666]">Start Date</Label>
              <Input
                id="header-start-date"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="header-end-date" className="text-[#666]">End Date</Label>
              <Input
                id="header-end-date"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setDateRange({ startDate: '', endDate: '' });
                  setDateRangeText('All');
                  setIsDateDialogOpen(false);
                }}
                className="text-[#666] hover:text-white hover:bg-[#1a1a1a]"
              >
                Clear
              </Button>
              <Button
                onClick={() => {
                  if (dateRange.startDate && dateRange.endDate) {
                    const start = new Date(dateRange.startDate).toLocaleDateString();
                    const end = new Date(dateRange.endDate).toLocaleDateString();
                    setDateRangeText(`${start} - ${end}`);
                  }
                  setIsDateDialogOpen(false);
                }}
                className="bg-[#94bba3] hover:bg-[#7da392] text-white"
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )}

  <div className="flex-1 flex justify-center relative" style={{ bottom: '-2rem' }}>
  </div>
  <div className="flex items-center gap-2 -mb-10 mt-6 relative z-50 pointer-events-auto">

    <ModeToggle />
    <UserNav />
  </div>
</nav>
    </header>
  );
}
