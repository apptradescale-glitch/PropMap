import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BusinessContextType {
  business: any;
  setBusiness: (business: any) => void;
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

  return (
    <BusinessContext.Provider value={{ business, setBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
};
