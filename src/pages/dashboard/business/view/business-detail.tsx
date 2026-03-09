import React from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';

export default function BusinessDetailPage() {
  return (
    <PageContainer scrollable>
      <PageHead title="Business Details" />
      <div className="space-y-2 pb-8">
        <div className="flex items-center justify-between -mt-5 pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Business Details
          </h2>
        </div>
        
        {/* Empty page for now */}
        <div className="flex items-center justify-center h-96">
          <p className="text-[#666] text-lg">Business details page - Coming soon</p>
        </div>
      </div>
    </PageContainer>
  );
}
