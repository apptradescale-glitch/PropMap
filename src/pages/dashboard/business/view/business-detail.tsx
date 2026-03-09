import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function BusinessDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const business = location.state?.business;

  if (!business) {
    return (
      <PageContainer scrollable>
        <PageHead title="Business Not Found" />
        <div className="space-y-2 pb-8">
          <div className="flex items-center justify-between -mt-5 pb-4">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Business Not Found
            </h2>
          </div>
          
          <div className="flex items-center justify-center h-96">
            <p className="text-[#666] text-lg">Business not found</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const businessName = business.businessSector === 'proptrading' ? business.userName : business.name;

  return (
    <PageContainer scrollable>
      <PageHead title={businessName || 'Business'} />
      <div className="space-y-2 pb-8">
        <div className="flex items-center justify-between -mt-5 pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">
           
          </h2>
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-[#666] hover:text-white hover:bg-[#1a1a1a]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        
        {/* Business Card - styled like overview cards */}
        <div className="flex items-start justify-start h-64 ml-8 mt-32 gap-4">
          <Card className="w-80 h-48 border-[#2a2a2a] bg-[#0a0a0a]">
            <CardContent className="flex flex-col h-full p-6">
              <div className="flex items-center gap-4 mb-4">
                {/* Circle with first letter */}
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#888] font-medium" style={{ fontSize: '10px' }}>
                    {business.businessSector === 'proptrading' 
                      ? business.userName?.charAt(0)?.toUpperCase() || 'U'
                      : business.name?.charAt(0)?.toUpperCase() || 'B'
                    }
                  </span>
                </div>
                
                {/* Name next to circle */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-lg truncate">
                    {businessName}
                  </h3>
                </div>
              </div>
              
              {/* Sector centered in card */}
              <div className="flex items-center justify-center">
                <p className="text-[#888] text-sm font-medium">
                  {business.businessSector === 'proptrading' ? 'PropTrading' : business.customSector}
                </p>
              </div>
              
              {/* Business type below sector */}
              {(business.businessType || business.customBusinessType) && (
                <div className="flex items-center justify-center mt-1">
                  <p className="text-[#666] text-xs">
                    {business.businessType === 'sole-proprietor' && 'Sole Proprietor'}
                    {business.businessType === 'partnership' && 'Partnership'}
                    {business.businessType === 'llc' && 'LLC'}
                    {business.businessType === 'corporation' && 'Corporation'}
                    {business.businessType === 'other' && business.customBusinessType}
                  </p>
                </div>
              )}
              
              {/* Active status at bottom */}
              <div className="mt-auto flex items-center justify-between pt-4">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${business.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs ml-2 text-[#666]">
                    {business.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Additional content area for future development */}
        <div className="ml-8 mt-8">
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-6">
            <h3 className="text-white text-lg font-semibold mb-4">Business Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[#666] text-sm">Country:</span>
                <span className="text-white text-sm">{business.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666] text-sm">Currency:</span>
                <span className="text-white text-sm">{business.currency}</span>
              </div>
              {business.propTradingType && (
                <div className="flex justify-between">
                  <span className="text-[#666] text-sm">Type:</span>
                  <span className="text-white text-sm capitalize">{business.propTradingType}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
