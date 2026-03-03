import React from 'react';
import { useState, useEffect } from "react";
import { loadTradesFromFirestore, useTradeStore } from './datastore';
import { useAuth } from '@/context/FAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FilterCriteria {
  account: string;
}

export function Filter() {
  const { currentUser } = useAuth();
  const trades = useTradeStore(state => state.trades);
  const setFilterCriteria = useTradeStore(state => state.setFilterCriteria);
  const [localFilterCriteria, setLocalFilterCriteria] = useState<FilterCriteria>({
    account: "all"
  });

  // Fetch accounts from trades
  const [accounts, setAccounts] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    loadTradesFromFirestore();
  }, [currentUser]);

  useEffect(() => {
    const uniqueAccounts = [...new Set(
      (trades || [])
        .map((trade: any) => trade?.account || trade?.accountId)
        .filter(Boolean)
        .map((v: any) => String(v))
    )];

    setAccounts(uniqueAccounts);
  }, [trades]);

  // Apply filter immediately when dropdown changes
  useEffect(() => {
    // Convert "all" back to empty string for the filter criteria
    const filterValue = localFilterCriteria.account === "all" ? "" : localFilterCriteria.account;
    setFilterCriteria({ 
      account: filterValue,
      symbol: "" // Include required symbol field
    });
  }, [localFilterCriteria, setFilterCriteria]);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={localFilterCriteria.account}
        onValueChange={val => setLocalFilterCriteria({ account: val })}
      >
        <SelectTrigger className="min-w-[180px] w-full text-white border border-white/20 focus:ring-0 focus:border-white/20 hover:border-white/20">
          <SelectValue placeholder="All Accounts" className="text-white" />
        </SelectTrigger>
        <SelectContent className="bg-black">
          <SelectItem value="all" className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white">All Accounts</SelectItem>
          {accounts.map((accountName, index) => (
            <SelectItem
              key={`${accountName}-${index}`}
              value={accountName}
              className="text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"
            >
              {accountName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}