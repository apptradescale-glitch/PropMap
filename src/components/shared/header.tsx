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
          }}
          onClick={() => setIsDateDialogOpen(true)}
        >
          +Add Numbers
        </span>

        <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
          <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Add Numbers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="text-center text-[#666]">
                <p>Empty for now</p>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setIsDateDialogOpen(false)}
                className="text-[#666] hover:text-white hover:bg-[#1a1a1a]"
              >
                Close
              </Button>
            </div>
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
