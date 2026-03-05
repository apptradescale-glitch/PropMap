import React, { useEffect } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { useAuth } from '@/context/FAuth';

export default function OverViewPage() {
  const { currentUser } = useAuth();

  // Ensure dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#0a0a0a';
    document.body.style.margin = '0';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
    };
  }, []);

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP" />
      <div className="space-y-2 pb-8">
        <div className="flex items-center justify-between -mt-5 pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">
           
          </h2>
        </div>
        
        {/* Empty dashboard content for now */}
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 text-lg"></p>
        </div>
        
      </div>
    </PageContainer>
  );
}