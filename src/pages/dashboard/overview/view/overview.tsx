import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { useAuth } from '@/context/FAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

export default function OverViewPage() {
  const { currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [businessInfo, setBusinessInfo] = useState({
    businessSector: '',
    customSector: '',
    name: '',
    userName: '',
    country: '',
    currency: ''
  });
  const [addedBusinesses, setAddedBusinesses] = useState<Array<{
    businessSector: string;
    customSector: string;
    name: string;
    userName: string;
    country: string;
    currency: string;
  }>>([]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBusinessInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const countryCurrencyMap: { [key: string]: { flag: string; currency: string; symbol: string } } = {
    'US': { flag: '🇺🇸', currency: 'USD', symbol: '$' },
    'DE': { flag: '🇩🇪', currency: 'EUR', symbol: '€' },
    'GB': { flag: '🇬🇧', currency: 'GBP', symbol: '£' },
    'FR': { flag: '🇫🇷', currency: 'EUR', symbol: '€' },
    'IT': { flag: '🇮🇹', currency: 'EUR', symbol: '€' },
    'ES': { flag: '🇪🇸', currency: 'EUR', symbol: '€' },
    'NL': { flag: '🇳🇱', currency: 'EUR', symbol: '€' },
    'BE': { flag: '🇧🇪', currency: 'EUR', symbol: '€' },
    'AT': { flag: '🇦🇹', currency: 'EUR', symbol: '€' },
    'CA': { flag: '🇨🇦', currency: 'CAD', symbol: 'C$' },
    'AU': { flag: '🇦🇺', currency: 'AUD', symbol: 'A$' },
    'JP': { flag: '🇯🇵', currency: 'JPY', symbol: '¥' },
    'CH': { flag: '🇨🇭', currency: 'CHF', symbol: 'CHF' },
    'SE': { flag: '🇸🇪', currency: 'SEK', symbol: 'kr' },
    'NO': { flag: '🇳🇴', currency: 'NOK', symbol: 'kr' },
    'DK': { flag: '🇩🇰', currency: 'DKK', symbol: 'kr' },
    'PL': { flag: '🇵🇱', currency: 'PLN', symbol: 'zł' },
    'CZ': { flag: '🇨🇿', currency: 'CZK', symbol: 'Kč' },
    'HU': { flag: '🇭🇺', currency: 'HUF', symbol: 'Ft' },
    'RO': { flag: '🇷🇴', currency: 'RON', symbol: 'lei' },
    'BG': { flag: '🇧🇬', currency: 'BGN', symbol: 'лв' },
    'HR': { flag: '🇭🇷', currency: 'HRK', symbol: 'kn' },
    'GR': { flag: '🇬🇷', currency: 'EUR', symbol: '€' },
    'PT': { flag: '🇵🇹', currency: 'EUR', symbol: '€' },
    'FI': { flag: '🇫🇮', currency: 'EUR', symbol: '€' },
    'IE': { flag: '🇮🇪', currency: 'EUR', symbol: '€' },
    'LU': { flag: '🇱🇺', currency: 'EUR', symbol: '€' },
    'SK': { flag: '🇸🇰', currency: 'EUR', symbol: '€' },
    'SI': { flag: '🇸🇮', currency: 'EUR', symbol: '€' },
    'EE': { flag: '🇪🇪', currency: 'EUR', symbol: '€' },
    'LV': { flag: '🇱🇻', currency: 'EUR', symbol: '€' },
    'LT': { flag: '🇱🇹', currency: 'EUR', symbol: '€' },
    'CY': { flag: '🇨🇾', currency: 'EUR', symbol: '€' },
    'MT': { flag: '🇲🇹', currency: 'EUR', symbol: '€' }
  };

  const handleCountryChange = (country: string) => {
    setBusinessInfo(prev => ({
      ...prev,
      country,
      currency: countryCurrencyMap[country]?.currency || ''
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Business info submitted:', businessInfo);
    // Add to businesses array
    setAddedBusinesses(prev => [...prev, { ...businessInfo }]);
    // Here you would typically save to database
    setIsDialogOpen(false);
    // Reset form
    setBusinessInfo({
      businessSector: '',
      customSector: '',
      name: '',
      userName: '',
      country: '',
      currency: ''
    });
  };

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP" />
      <div className="space-y-2 pb-8">
        <div className="flex items-center justify-between -mt-5 pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-white">
           
          </h2>
        </div>
        
        {/* Business Cards Container */}
        <div className="flex items-start justify-start h-64 ml-8 mt-32 gap-4">
          {/* Add Business Card */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Card className="w-80 h-48 cursor-pointer hover:bg-[#1a1a1a] transition-colors border-[#2a2a2a] bg-[#0a0a0a]">
                <CardContent className="flex flex-col items-center justify-center h-full p-6">
                  <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center mb-4">
                    <Plus className="w-6 h-6 text-[#888]" />
                  </div>
                  <p className="text-[#666] text-sm">Add Business</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Add your business</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessSector" className="text-[#888] text-sm">Business Sector</Label>
                  <Select value={businessInfo.businessSector} onValueChange={(value) => setBusinessInfo(prev => ({ ...prev, businessSector: value }))}>
                    <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                      <SelectValue placeholder="Select business sector" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                      <SelectItem value="proptrading" className="text-white hover:bg-[#2a2a2a]">PropTrading</SelectItem>
                      <SelectItem value="other" className="text-white hover:bg-[#2a2a2a]">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {businessInfo.businessSector === 'other' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="customSector" className="text-[#888] text-sm">Type your Sector</Label>
                      <Input
                        id="customSector"
                        name="customSector"
                        type="text"
                        value={businessInfo.customSector}
                        onChange={handleInputChange}
                        className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                        placeholder="Enter your business sector"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[#888] text-sm">Business Name</Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        value={businessInfo.name}
                        onChange={handleInputChange}
                        className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                        placeholder="Enter business name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-[#888] text-sm">Country</Label>
                      <Select value={businessInfo.country} onValueChange={handleCountryChange}>
                        <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] max-h-60">
                          {Object.entries(countryCurrencyMap).map(([code, data]) => (
                            <SelectItem key={code} value={code} className="text-white hover:bg-[#2a2a2a]">
                              <span className="flex items-center gap-2">
                                <span>{data.flag}</span>
                                <span>{code}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency" className="text-[#888] text-sm">Currency</Label>
                      <Input
                        id="currency"
                        name="currency"
                        type="text"
                        value={businessInfo.currency ? `${countryCurrencyMap[businessInfo.country]?.symbol || ''} ${businessInfo.currency}` : ''}
                        className="bg-[#1a1a1a] border-[#2a2a2a] text-[#666] placeholder-[#555]"
                        placeholder="Currency auto-filled"
                        readOnly
                        disabled
                      />
                    </div>
                  </>
                )}

                {businessInfo.businessSector === 'proptrading' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="userName" className="text-[#888] text-sm">Your Name</Label>
                      <Input
                        id="userName"
                        name="userName"
                        type="text"
                        value={businessInfo.userName}
                        onChange={handleInputChange}
                        className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                        placeholder="Enter your name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-[#888] text-sm">Country</Label>
                      <Select value={businessInfo.country} onValueChange={handleCountryChange}>
                        <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] max-h-60">
                          {Object.entries(countryCurrencyMap).map(([code, data]) => (
                            <SelectItem key={code} value={code} className="text-white hover:bg-[#2a2a2a]">
                              <span className="flex items-center gap-2">
                                <span>{data.flag}</span>
                                <span>{code}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency" className="text-[#888] text-sm">Currency</Label>
                      <Input
                        id="currency"
                        name="currency"
                        type="text"
                        value={businessInfo.currency ? `${countryCurrencyMap[businessInfo.country]?.symbol || ''} ${businessInfo.currency}` : ''}
                        className="bg-[#1a1a1a] border-[#2a2a2a] text-[#666] placeholder-[#555]"
                        placeholder="Currency auto-filled"
                        readOnly
                        disabled
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1 border-[#2a2a2a] text-[#888] hover:bg-[#1a1a1a]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-white text-black hover:bg-gray-200"
                    disabled={!businessInfo.businessSector || 
                    (businessInfo.businessSector === 'other' && (!businessInfo.customSector || !businessInfo.name)) ||
                    (businessInfo.businessSector === 'proptrading' && !businessInfo.userName) ||
                    !businessInfo.country}
                  >
                    Add Business
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Added Business Cards */}
          {addedBusinesses.map((business, index) => (
            <Card key={index} className="w-80 h-48 border-[#2a2a2a] bg-[#0a0a0a]">
              <CardContent className="flex flex-col h-full p-6">
                <div className="flex items-start gap-4 mb-4">
                  {/* Circle with first letter */}
                  <div className="w-12 h-12 rounded-full bg-[#222] border border-[#333] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#888] font-medium" style={{ fontSize: '10px' }}>
                      {business.businessSector === 'proptrading' 
                        ? business.userName?.charAt(0)?.toUpperCase() || 'U'
                        : business.name?.charAt(0)?.toUpperCase() || 'B'
                      }
                    </span>
                  </div>
                  
                  {/* Business info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-lg truncate">
                      {business.businessSector === 'proptrading' 
                        ? business.userName 
                        : business.name
                      }
                    </h3>
                  </div>
                </div>
                
                {/* Sector below circle */}
                <div className="mt-auto">
                  <p className="text-[#888] text-xs truncate">
                    {business.businessSector === 'proptrading' ? 'PropTrading' : business.customSector}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-[#666] text-xs">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
      </div>
    </PageContainer>
  );
}