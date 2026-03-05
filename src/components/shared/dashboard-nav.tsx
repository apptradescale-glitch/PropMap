'use client';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { NavItem } from '@/types';
import { Dispatch, SetStateAction } from 'react';
import { useSidebar } from '@/hooks/use-sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { usePathname } from '@/routes/hooks';
import { Link } from 'react-router-dom';
import React from 'react';

interface DashboardNavProps {
  items: NavItem[];
  setOpen?: Dispatch<SetStateAction<boolean>>;
  isMobileNav?: boolean;
}

export default function DashboardNav({
  items,
  setOpen,
  isMobileNav = false
}: DashboardNavProps) {
  const path = usePathname();
  const { isMinimized } = useSidebar();

  if (!items?.length) return null;

  return (
    <nav className="space-y-0.5">
      <TooltipProvider>
        {items.map((item, index) => {
          const Icon = Icons[item.icon as keyof typeof Icons || 'arrowRight'];
          return (
            item.href && (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.disabled ? '/' : item.href}
                    className={cn(
                      "flex items-center justify-start gap-2.5 w-full rounded-md px-2 py-1.5 text-[13px] transition-colors",
                      path === item.href
                        ? "bg-white/10 text-white"
                        : "bg-transparent text-[#888] hover:bg-white/5 hover:text-[#ccc]",
                      item.disabled && 'cursor-not-allowed opacity-80'
                    )}
                    onClick={() => {
                      if (setOpen) setOpen(false);
                    }}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        path === item.href ? "text-white" : "text-[#666]"
                      )}
                    />
                    {(isMobileNav || (!isMinimized && !isMobileNav)) && (
                      <>
                        <span>{item.title}</span>
                        {item.soon && (
                          <span
                            className="ml-auto px-1.5 py-0.5 rounded text-[10px] text-[#666] bg-[#1a1a1a] border border-[#2a2a2a] font-medium"
                            style={{ letterSpacing: 0.5, lineHeight: 1.2 }}
                          >
                            SOON
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  align="center"
                  side="right"
                  sideOffset={8}
                  className={!isMinimized ? 'hidden' : 'inline-block'}
                >
                  {item.title}
                </TooltipContent>
              </Tooltip>
            )
          );
        })}
      </TooltipProvider>
    </nav>
  );
}