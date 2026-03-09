import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { useAuth } from '@/context/FAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MoreHorizontal, Trash2, Edit } from 'lucide-react';

export default function OverViewPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [businessInfo, setBusinessInfo] = useState({
    businessSector: '',
    customSector: '',
    name: '',
    userName: '',
    country: '',
    currency: '',
    propTradingType: '',
    businessType: '',
    customBusinessType: ''
  });
  const [addedBusinesses, setAddedBusinesses] = useState<Array<{
    businessSector: string;
    customSector: string;
    name: string;
    userName: string;
    country: string;
    currency: string;
    propTradingType: string;
    businessType: string;
    customBusinessType: string;
    isActive: boolean;
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

  // Firestore functions
  const saveBusinessToFirestore = async (business: any) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/business/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ business })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to save business');
      return result;
    } catch (error) {
      console.error('Error saving business:', error);
      throw error;
    }
  };

  const loadBusinessesFromFirestore = async () => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/business/load', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success && result.businesses) {
        setAddedBusinesses(result.businesses);
      }
    } catch (error) {
      console.error('Error loading businesses:', error);
    }
  };

  const updateBusinessInFirestore = async (index: number, business: any) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/business/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ index, business })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update business');
      return result;
    } catch (error) {
      console.error('Error updating business:', error);
      throw error;
    }
  };

  const deleteBusinessFromFirestore = async (index: number) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/business/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ index })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to delete business');
      return result;
    } catch (error) {
      console.error('Error deleting business:', error);
      throw error;
    }
  };

  // Load businesses on component mount
  useEffect(() => {
    if (currentUser) {
      loadBusinessesFromFirestore();
    }
  }, [currentUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBusinessInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const countryCurrencyMap: { [key: string]: { name: string; flag: string; currency: string; symbol: string } } = {
    'US': { name: 'United States', flag: 'US', currency: 'USD', symbol: '$' },
    'DE': { name: 'Germany', flag: 'DE', currency: 'EUR', symbol: '€' },
    'GB': { name: 'United Kingdom', flag: 'GB', currency: 'GBP', symbol: '£' },
    'FR': { name: 'France', flag: 'FR', currency: 'EUR', symbol: '€' },
    'IT': { name: 'Italy', flag: 'IT', currency: 'EUR', symbol: '€' },
    'ES': { name: 'Spain', flag: 'ES', currency: 'EUR', symbol: '€' },
    'NL': { name: 'Netherlands', flag: 'NL', currency: 'EUR', symbol: '€' },
    'BE': { name: 'Belgium', flag: 'BE', currency: 'EUR', symbol: '€' },
    'AT': { name: 'Austria', flag: 'AT', currency: 'EUR', symbol: '€' },
    'CA': { name: 'Canada', flag: 'CA', currency: 'CAD', symbol: 'C$' },
    'AU': { name: 'Australia', flag: 'AU', currency: 'AUD', symbol: 'A$' },
    'JP': { name: 'Japan', flag: 'JP', currency: 'JPY', symbol: '¥' },
    'CH': { name: 'Switzerland', flag: 'CH', currency: 'CHF', symbol: 'CHF' },
    'SE': { name: 'Sweden', flag: 'SE', currency: 'SEK', symbol: 'kr' },
    'NO': { name: 'Norway', flag: 'NO', currency: 'NOK', symbol: 'kr' },
    'DK': { name: 'Denmark', flag: 'DK', currency: 'DKK', symbol: 'kr' },
    'PL': { name: 'Poland', flag: 'PL', currency: 'PLN', symbol: 'zł' },
    'CZ': { name: 'Czech Republic', flag: 'CZ', currency: 'CZK', symbol: 'Kč' },
    'HU': { name: 'Hungary', flag: 'HU', currency: 'HUF', symbol: 'Ft' },
    'RO': { name: 'Romania', flag: 'RO', currency: 'RON', symbol: 'lei' },
    'BG': { name: 'Bulgaria', flag: 'BG', currency: 'BGN', symbol: 'лв' },
    'HR': { name: 'Croatia', flag: 'HR', currency: 'HRK', symbol: 'kn' },
    'GR': { name: 'Greece', flag: 'GR', currency: 'EUR', symbol: '€' },
    'PT': { name: 'Portugal', flag: 'PT', currency: 'EUR', symbol: '€' },
    'FI': { name: 'Finland', flag: 'FI', currency: 'EUR', symbol: '€' },
    'IE': { name: 'Ireland', flag: 'IE', currency: 'EUR', symbol: '€' },
    'LU': { name: 'Luxembourg', flag: 'LU', currency: 'EUR', symbol: '€' },
    'SK': { name: 'Slovakia', flag: 'SK', currency: 'EUR', symbol: '€' },
    'SI': { name: 'Slovenia', flag: 'SI', currency: 'EUR', symbol: '€' },
    'EE': { name: 'Estonia', flag: 'EE', currency: 'EUR', symbol: '€' },
    'LV': { name: 'Latvia', flag: 'LV', currency: 'EUR', symbol: '€' },
    'LT': { name: 'Lithuania', flag: 'LT', currency: 'EUR', symbol: '€' },
    'CY': { name: 'Cyprus', flag: 'CY', currency: 'EUR', symbol: '€' },
    'MT': { name: 'Malta', flag: 'MT', currency: 'EUR', symbol: '€' }
  };

  const handleCountryChange = (country: string) => {
    setBusinessInfo(prev => ({
      ...prev,
      country,
      currency: countryCurrencyMap[country]?.currency || ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Business info submitted:', businessInfo);
    
    if (editingIndex !== null) {
      // Update existing business - optimistic update
      const updatedBusiness = { ...businessInfo, isActive: addedBusinesses[editingIndex].isActive };
      setAddedBusinesses(prev => 
        prev.map((business, index) => 
          index === editingIndex ? updatedBusiness : business
        )
      );
      setEditingIndex(null);
      
      // Save to Firestore in background
      updateBusinessInFirestore(editingIndex, updatedBusiness).catch(error => {
        console.error('Error updating business:', error);
        // Optionally revert the optimistic update on error
      });
    } else {
      // Add new business - optimistic update
      const newBusiness = { ...businessInfo, isActive: true };
      setAddedBusinesses(prev => [...prev, newBusiness]);
      
      // Save to Firestore in background
      saveBusinessToFirestore(newBusiness).catch(error => {
        console.error('Error saving business:', error);
        // Optionally remove the optimistic addition on error
        setAddedBusinesses(prev => prev.slice(0, -1)); // Remove last added item
      });
    }
    
    setIsDialogOpen(false);
    // Reset form
    setBusinessInfo({
      businessSector: '',
      customSector: '',
      name: '',
      userName: '',
      country: '',
      currency: '',
      propTradingType: '',
      businessType: '',
      customBusinessType: ''
    });
  };

  const handleDelete = async (index: number) => {
    // Optimistic delete - remove immediately
    const deletedBusiness = addedBusinesses[index];
    setAddedBusinesses(prev => prev.filter((_, i) => i !== index));
    setActiveMenuIndex(null);
    
    // Delete from Firestore in background
    deleteBusinessFromFirestore(index).catch(error => {
      console.error('Error deleting business:', error);
      // Optionally restore the deleted business on error
      setAddedBusinesses(prev => {
        const newBusinesses = [...prev];
        newBusinesses.splice(index, 0, deletedBusiness);
        return newBusinesses;
      });
    });
  };

  const handleEdit = (index: number) => {
    const business = addedBusinesses[index];
    setBusinessInfo({
      businessSector: business.businessSector,
      customSector: business.customSector,
      name: business.name,
      userName: business.userName,
      country: business.country,
      currency: business.currency,
      propTradingType: business.propTradingType,
      businessType: business.businessType,
      customBusinessType: business.customBusinessType
    });
    setEditingIndex(index);
    setActiveMenuIndex(null);
    setIsDialogOpen(true);
  };

  const handleToggleActive = (index: number) => {
    setAddedBusinesses(prev => 
      prev.map((business, i) => 
        i === index ? { ...business, isActive: !business.isActive } : business
      )
    );
    setActiveMenuIndex(null);
  };

  const handleCardClick = (business: any, index: number) => {
    // Navigate to business detail page with business data
    navigate(`/dashboard/business/${index}`, { state: { business } });
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
              <Card className="bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#2a2a2a] transition-all duration-200 w-64 h-48 flex flex-col cursor-pointer">
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
                <DialogTitle className="text-white">{editingIndex !== null ? 'Edit your Business' : 'Add your Business'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessSector" className="text-[#888] text-sm">Business Sector</Label>
                  <Select value={businessInfo.businessSector} onValueChange={(value) => setBusinessInfo(prev => ({ ...prev, businessSector: value }))}>
                    <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                      <SelectValue placeholder="Select business sector" />
                    </SelectTrigger>
                    <SelectContent className="!bg-[#1a1a1a] border-[#2a2a2a]">
                      <SelectItem value="proptrading" className="text-white hover:!bg-white/10">PropTrading</SelectItem>
                      <SelectItem value="other" className="text-white hover:!bg-white/10">Other</SelectItem>
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
                        placeholder=""
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
                        placeholder=""
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessType" className="text-[#888] text-sm">Business Type</Label>
                      <Select value={businessInfo.businessType} onValueChange={(value) => setBusinessInfo(prev => ({ ...prev, businessType: value }))}>
                        <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent className="!bg-[#1a1a1a] border-[#2a2a2a]">
                          <SelectItem value="sole-proprietor" className="text-white hover:!bg-white/10">Sole Proprietor</SelectItem>
                          <SelectItem value="partnership" className="text-white hover:!bg-white/10">Partnership</SelectItem>
                          <SelectItem value="llc" className="text-white hover:!bg-white/10">LLC</SelectItem>
                          <SelectItem value="corporation" className="text-white hover:!bg-white/10">Corporation</SelectItem>
                          <SelectItem value="other" className="text-white hover:!bg-white/10">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {businessInfo.businessType === 'other' && (
                      <div className="space-y-2">
                        <Label htmlFor="customBusinessType" className="text-[#888] text-sm">Type Business Type</Label>
                        <Input
                          id="customBusinessType"
                          name="customBusinessType"
                          type="text"
                          value={businessInfo.customBusinessType || ''}
                          onChange={handleInputChange}
                          className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                          placeholder="Enter business type"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-[#888] text-sm">Country</Label>
                      <Select value={businessInfo.country} onValueChange={handleCountryChange}>
                        <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] max-h-60">
                          {Object.entries(countryCurrencyMap).map(([code, data]) => (
                            <SelectItem key={code} value={code} className="text-white hover:!bg-white/10">
                              <span className="flex items-center gap-2">
                                <span className="text-[#666] text-xs font-mono bg-[#2a2a2a] px-1 py-0.5 rounded">
                                  {data.flag}
                                </span>
                                <span>{data.name}</span>
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
                        placeholder=""
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="propTradingType" className="text-[#888] text-sm">As a</Label>
                      <Select value={businessInfo.propTradingType} onValueChange={(value) => setBusinessInfo(prev => ({ ...prev, propTradingType: value }))}>
                        <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent className="!bg-[#1a1a1a] border-[#2a2a2a]">
                          <SelectItem value="business" className="text-white hover:!bg-white/10">Business</SelectItem>
                          <SelectItem value="personal" className="text-white hover:!bg-white/10">Personal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {businessInfo.propTradingType === 'business' && (
                      <div className="space-y-2">
                        <Label htmlFor="businessType" className="text-[#888] text-sm">Business Type</Label>
                        <Select value={businessInfo.businessType} onValueChange={(value) => setBusinessInfo(prev => ({ ...prev, businessType: value }))}>
                          <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                          <SelectContent className="!bg-[#1a1a1a] border-[#2a2a2a]">
                            <SelectItem value="sole-proprietor" className="text-white hover:!bg-white/10">Sole Proprietor</SelectItem>
                            <SelectItem value="partnership" className="text-white hover:!bg-white/10">Partnership</SelectItem>
                            <SelectItem value="llc" className="text-white hover:!bg-white/10">LLC</SelectItem>
                            <SelectItem value="corporation" className="text-white hover:!bg-white/10">Corporation</SelectItem>
                            <SelectItem value="other" className="text-white hover:!bg-white/10">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {businessInfo.businessType === 'other' && (
                      <div className="space-y-2">
                        <Label htmlFor="customBusinessType" className="text-[#888] text-sm">Type Business Type</Label>
                        <Input
                          id="customBusinessType"
                          name="customBusinessType"
                          type="text"
                          value={businessInfo.customBusinessType || ''}
                          onChange={handleInputChange}
                          className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                          placeholder=""
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-[#888] text-sm">Country</Label>
                      <Select value={businessInfo.country} onValueChange={handleCountryChange}>
                        <SelectTrigger className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] max-h-60">
                          {Object.entries(countryCurrencyMap).map(([code, data]) => (
                            <SelectItem key={code} value={code} className="text-white hover:!bg-white/10">
                              <span className="flex items-center gap-2">
                                <span className="text-[#666] text-xs font-mono bg-[#2a2a2a] px-1 py-0.5 rounded">
                                  {data.flag}
                                </span>
                                <span>{data.name}</span>
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
            <Card key={index} className="w-80 h-48 border-[#2a2a2a] bg-[#0a0a0a] hover:border-white/35 hover:shadow-lg hover:shadow-white/20 transition-all duration-200 hover:scale-105 cursor-pointer" onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button')) {
                  handleCardClick(business, index);
                }
              }}>
              <CardContent className="flex flex-col h-full p-6">
                <div className="flex items-center gap-4 mb-4">
                  {/* Circle with first letter - styled like Add Business button */}
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
                      {business.businessSector === 'proptrading' 
                        ? business.userName 
                        : business.name
                      }
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
                
                {/* Active status + Three-dot menu on same row */}
                <div className="mt-auto flex items-center justify-between pt-4">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${business.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs ml-2 text-[#666]">
                      {business.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveMenuIndex(activeMenuIndex === index ? null : index)}
                      className="text-[#666] border-[#2a2a2a] hover:text-white hover:border-[#444] hover:bg-[#1a1a1a] p-1 h-8 w-8"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                    
                    {activeMenuIndex === index && (
                      <div className="absolute right-0 bottom-full mb-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md shadow-lg z-10 min-w-[120px]">
                        <button
                          type="button"
                          onClick={() => handleEdit(index)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-white hover:bg-[#2a2a2a] text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(index)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-white hover:bg-[#2a2a2a] text-sm"
                        >
                          <div className={`w-3 h-3 rounded-full border-2 ${business.isActive ? 'border-red-400' : 'border-green-400'}`}></div>
                          {business.isActive ? 'Make inactive' : 'Make active'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(index)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left text-red-400 hover:bg-[#2a2a2a] text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
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