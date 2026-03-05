'use client';
import DashboardNav from '@/components/shared/dashboard-nav';
import { navItems } from '@/constants/data';
import { useSidebar } from '@/hooks/use-sidebar';
import { cn } from '@/lib/utils';
import { ChevronLeft, Search } from 'lucide-react';
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
        `relative hidden h-screen flex-none border-r border-[#1a1a1a] transition-[width] duration-500 md:block`,
        !isMinimized ? 'w-56' : 'w-[60px]',
        className
      )}
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* Logo / Brand area */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors">
          <img
            src={Logo}
            alt="Logo"
            className="w-6 h-6 object-contain"
            style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
          />
          {!isMinimized && (
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: '#fff',
              position: 'relative',
              top: 2
            }}>
              PROP<span style={{ fontSize: 9, fontWeight: 400, verticalAlign: 'sub', marginLeft: 1, opacity: 0.7, position: 'relative' as const, top: -2 }}>MAP</span>
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      {!isMinimized && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[#222] bg-[#111] text-[#555] text-xs cursor-pointer hover:border-[#333] transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <ChevronLeft
        className={cn(
          'absolute -right-3 top-[12px] z-50 cursor-pointer rounded-full border border-[#333] bg-[#0a0a0a] text-3xl text-[#888] duration-200 hover:text-white p-1',
          isMinimized && 'rotate-180'
        )}
        onClick={handleToggle}
      />

      {/* Nav items */}
      <div className="px-3 py-1 flex-1 overflow-y-auto">
        {navItems.map((item, idx) =>
          item.divider ? (
            <div
              key={`divider-${idx}`}
              className="my-2 border-b border-[#1a1a1a]"
            />
          ) : (
            <div key={item.title || idx}>
              <DashboardNav items={[item]} />
            </div>
          )
        )}
      </div>

      {/* Bottom user section */}
      {!isMinimized && (
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors">
            <div className="w-6 h-6 rounded-full bg-[#222] border border-[#333] flex items-center justify-center">
              <span className="text-[10px] text-[#888] font-medium">P</span>
            </div>
            <span className="text-xs text-[#888]">PropMap</span>
          </div>
        </div>
      )}
    </aside>
  );
}