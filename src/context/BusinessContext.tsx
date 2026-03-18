import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/FAuth';
import { db } from '@/config/firestore';
import { getDoc, doc } from 'firebase/firestore';

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
  const { currentUser } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const addPayout = (payout: any) => {
    setPayouts(prev => [...prev, payout]);
  };

  const addExpense = (expense: any) => {
    setExpenses(prev => [...prev, expense]);
  };

  // Load financial data from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const loadFinancialData = async () => {
      try {
        // Load payouts
        const payoutsDoc = await getDoc(doc(db, 'payouts', currentUser.uid));
        const payoutsData = payoutsDoc.exists() ? payoutsDoc.data().items || [] : [];
        setPayouts(payoutsData);

        // Load expenses
        const expensesDoc = await getDoc(doc(db, 'expenses', currentUser.uid));
        const expensesData = expensesDoc.exists() ? expensesDoc.data().items || [] : [];
        setExpenses(expensesData);
      } catch (error) {
        console.error('Error loading financial data:', error);
      }
    };

    loadFinancialData();
  }, [currentUser]);

  return (
    <BusinessContext.Provider value={{ business, setBusiness, addPayout, addExpense, payouts, expenses }}>
      {children}
    </BusinessContext.Provider>
  );
};
