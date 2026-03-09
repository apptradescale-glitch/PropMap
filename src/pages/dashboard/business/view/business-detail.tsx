import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, Globe, DollarSign, Briefcase, LineChart } from 'lucide-react';

const getCurrencySymbol = (currency: string) => {
  const symbols: { [key: string]: string } = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'RUB': '₽',
    'BRL': 'R$',
    'MXN': '$',
    'ZAR': 'R',
    'KRW': '₩',
    'SGD': 'S$',
    'HKD': 'HK$',
    'NZD': 'NZ$',
    'TRY': '₺',
    'ILS': '₪'
  };
  return symbols[currency] || '$';
};

export default function BusinessDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const business = location.state?.business;

  // Ensure dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#0a0a0a';
    document.body.style.margin = '0';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
    };
  }, []);

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
        
        {/* Top 4 Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Business Information Card */}
          <Card className="h-auto border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white">
                Business Information
              </CardTitle>
              <Building2 className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {/* Circle with first letter */}
                  <div className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#888] font-medium" style={{ fontSize: '8px' }}>
                      {business.businessSector === 'proptrading' 
                        ? business.userName?.charAt(0)?.toUpperCase() || 'U'
                        : business.name?.charAt(0)?.toUpperCase() || 'B'
                      }
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-semibold text-sm truncate">
                        {businessName}
                      </h4>
                      <div className={`w-1 h-1 rounded-full ${business.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                    <p className="text-[#888] text-xs">
                      {business.businessSector === 'proptrading' ? 'PropTrading' : business.customSector}
                      {(business.businessType || business.customBusinessType) && (
                        <span className="ml-1">
                          {' | '}
                          {business.businessType === 'sole-proprietor' && 'Sole Proprietor'}
                          {business.businessType === 'partnership' && 'Partnership'}
                          {business.businessType === 'llc' && 'LLC'}
                          {business.businessType === 'corporation' && 'Corporation'}
                          {business.businessType === 'other' && business.customBusinessType}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Empty Card 2 */}
          <Card className="h-auto border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white">
                Revenue
              </CardTitle>
              <LineChart className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="text-2xl font-bold text-white">{business.currency ? getCurrencySymbol(business.currency) + '0' : '$0'}</div>
              <p className="text-xs text-[#666] mt-1">Total Revenue</p>
            </CardContent>
          </Card>

          {/* Empty Card 3 */}
          <Card className="h-auto border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white">
                Payouts / Income
              </CardTitle>
              <DollarSign className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="text-lg font-semibold text-white">{business.currency ? getCurrencySymbol(business.currency) + '0' : '$0'}</div>
              <p className="text-xs text-[#666] mt-1">Total Payouts</p>
            </CardContent>
          </Card>

          {/* Empty Card 4 */}
          <Card className="h-auto border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white">
                Expenses
              </CardTitle>
              <DollarSign className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="text-lg font-semibold text-white">{business.currency ? getCurrencySymbol(business.currency) + '0' : '$0'}</div>
              <p className="text-xs text-[#666] mt-1">Total Expenses</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance + Location/Analytics row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Performance Card - Left */}
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader>
              <CardTitle className="text-white">Performance</CardTitle>
              <CardDescription className="text-[#666]">
                Business performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32">
                <p className="text-[#666] text-lg">Performance data coming soon</p>
              </div>
            </CardContent>
          </Card>

          {/* Right side - Analytics + Location stacked */}
          <div className="grid grid-cols-2 gap-4">
            {/* Analytics Card - Left */}
            <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="text-sm font-medium text-white">
                  Analytics
                </CardTitle>
                <LineChart className="h-4 w-4 text-[#666]" />
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <div className="flex items-center justify-center h-32">
                  <p className="text-[#666] text-sm">Analytics data coming soon</p>
                </div>
              </CardContent>
            </Card>

            {/* Right - Location + Coming Soon stacked */}
            <div className="grid grid-rows-2 gap-2">
              {/* Location Card - Top */}
              <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                  <CardTitle className="text-sm font-medium text-white">
                    Location
                  </CardTitle>
                  <Globe className="h-4 w-4 text-[#666]" />
                </CardHeader>
                <CardContent className="pt-1 pb-3">
                  <div className="text-sm font-semibold text-white mt-1">{business.country || 'N/A'}</div>
                  <div className="text-xs text-[#666]">
                    Currency: {business.currency || 'N/A'}
                  </div>
                </CardContent>
              </Card>

              {/* Coming Soon Card - Bottom */}
              <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3">
                  <CardTitle className="text-sm font-medium text-white">
                    Coming Soon
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 pb-3">
                  <div className="flex items-center justify-center">
                    <p className="text-[#666] text-xs">Coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Additional 2 Cards (2 in a row, bigger) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Empty Card 7 */}
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader>
              <CardTitle className="text-white">Performance</CardTitle>
              <CardDescription className="text-[#666]">
                Business performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32">
                <p className="text-[#666] text-lg">Performance data coming soon</p>
              </div>
            </CardContent>
          </Card>

          {/* Empty Card 8 */}
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader>
              <CardTitle className="text-white">Analytics</CardTitle>
              <CardDescription className="text-[#666]">
                Business analytics and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32">
                <p className="text-[#666] text-lg">Analytics data coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
