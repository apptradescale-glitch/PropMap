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
    <nav className="space-y-1">
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
                      "flex items-center justify-start gap-2 w-full rounded px-2 py-1.5 text-sm transition-[box-shadow,_background-color,_color]",
                      path === item.href
                        ? "text-stone-950 dark:text-white shadow outline outline-1 outline-stone-400 dark:outline-stone-700"
                        : "hover:bg-white/10 dark:hover:bg-white/10 bg-transparent text-stone-500 dark:text-stone-400 shadow-none",
                      item.disabled && 'cursor-not-allowed opacity-80'
                    )}
                    onClick={() => {
                      if (setOpen) setOpen(false);
                    }}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        path === item.href ? "text-[#94b0a3] dark:text-[#94b0a3]" : ""
                      )}
                    />
                    {(isMobileNav || (!isMinimized && !isMobileNav)) && (
                      <>
                        <span>{item.title}</span>
                        {item.soon && (
                    <span
  className="ml-2 px-1 py-0.5 rounded bg-white/10 text-[10px] text-white border border-white/30 font-semibold"
  style={{ letterSpacing: 1, lineHeight: 1.2 }}
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