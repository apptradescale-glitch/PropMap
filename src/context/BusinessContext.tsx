import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BusinessContextType {
  business: any;
  setBusiness: (business: any) => void;
  addPayout: (payout: any) => void;
  addExpense: (expense: any) => void;
  payouts: any[];
  expenses: any[];
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const [business, setBusiness] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const addPayout = (payout: any) => {
    setPayouts(prev => [...prev, payout]);
  };

  const addExpense = (expense: any) => {
    setExpenses(prev => [...prev, expense]);
  };

  return (
    <BusinessContext.Provider value={{ business, setBusiness, addPayout, addExpense, payouts, expenses }}>
      {children}
    </BusinessContext.Provider>
  );
};
