'use client';
import DashboardNav from '@/components/shared/dashboard-nav';
import { navItems } from '@/constants/data';
import { useSidebar } from '@/hooks/use-sidebar';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import React from 'react';
import Logo from '../../assets/images/lg34.png';

type SidebarProps = {
  className?: string;
};

export default function Sidebar({ className }: SidebarProps) {
  const { isMinimized, toggle } = useSidebar();
  const [status, setStatus] = useState(false);

  const handleToggle = () => {
    setStatus(true);
    toggle();
    setTimeout(() => setStatus(false), 500);
  };

  return (
    <aside
      className={cn(
        `relative hidden h-screen flex-none border-r bg-card transition-[width] duration-500 md:block`,
        !isMinimized ? 'w-72' : 'w-[60px]',
        className
      )}
    >
      <div className="px-6">
        <div
          className={cn(
            "mb-4 mt-4 pb-4",
            !isMinimized && "border-b border-stone-300 dark:border-stone-700"
          )}
        >
          <button className="flex p-2 hover:bg-stone-200 dark:hover:bg-white/5 rounded transition-colors relative gap-2 w-full items-center">
            <div
              className={cn(
                "flex items-center justify-center",
                isMinimized ? "w-12 h-12" : "w-16 h-12"
              )}
            >
              <img
                src={Logo}
                alt="Logo"
                className={cn(
                  "object-contain max-w-full max-h-full",
                  isMinimized ? "p-1" : ""
                )}
              />
            </div>
            {!isMinimized && (
              <div className="text-start">
                <span className="text-sm font-bold block text-black dark:text-white">Tradescale</span>
                <span className="text-xs block text-stone-500 dark:text-stone-400">.@KK</span>
              </div>
            )}
            {!isMinimized && (
              <>
                <ChevronDown className="absolute right-2 top-1/2 translate-y-[calc(-50%+4px)] h-4 w-4 text-stone-500 dark:text-stone-400" />
                <ChevronUp className="absolute right-2 top-1/2 translate-y-[calc(-50%-4px)] h-4 w-4 text-stone-500 dark:text-stone-400" />
              </>
            )}
          </button>
        </div>
      </div>

      <ChevronLeft
        className={cn(
          'absolute -right-3 top-[84px] z-50 cursor-pointer rounded-full border bg-background text-3xl text-foreground duration-200 hover:text-foreground/80 p-1',
          isMinimized && 'rotate-180'
        )}
        onClick={handleToggle}
      />

      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
  <div className="mt-3">
  {navItems.map((item, idx) =>
    item.divider ? (
      <div
        key={`divider-${idx}`}
        className="mt-1.5 mb-1.5 border-b border-stone-300 dark:border-stone-700"
      />
    ) : (
      <div className="mb-1">
        <DashboardNav key={item.title || idx} items={[item]} />
      </div>
    )
  )}
</div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-48 h-48 overflow-hidden">
        <div className="absolute -left-24 -bottom-24 w-48 h-48 bg-[#94bba3]/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-[#94bba3]/30 rounded-full blur-xl animate-pulse delay-75" />
        <div className="absolute -left-8 -bottom-8 w-16 h-16 bg-[#94bba3]/40 rounded-full blur-lg animate-pulse delay-150" />
      </div>
    </aside>
  );
}