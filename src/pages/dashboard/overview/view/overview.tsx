import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { useAuth } from '@/context/FAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

export default function OverViewPage() {
  const { currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [businessInfo, setBusinessInfo] = useState({
    name: '',
    industry: '',
    location: '',
    description: '',
    website: '',
    email: '',
    phone: ''
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Business info submitted:', businessInfo);
    // Here you would typically save to database
    setIsDialogOpen(false);
    // Reset form
    setBusinessInfo({
      name: '',
      industry: '',
      location: '',
      description: '',
      website: '',
      email: '',
      phone: ''
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
        
        {/* Business Card */}
        <div className="flex items-center justify-center h-64">
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
                  <Label htmlFor="industry" className="text-[#888] text-sm">Industry</Label>
                  <Input
                    id="industry"
                    name="industry"
                    type="text"
                    value={businessInfo.industry}
                    onChange={handleInputChange}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                    placeholder="e.g., Technology, Retail, Services"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-[#888] text-sm">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    type="text"
                    value={businessInfo.location}
                    onChange={handleInputChange}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                    placeholder="City, State/Country"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[#888] text-sm">Description</Label>
                  <Input
                    id="description"
                    name="description"
                    type="text"
                    value={businessInfo.description}
                    onChange={handleInputChange}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                    placeholder="Brief description of your business"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-[#888] text-sm">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    value={businessInfo.website}
                    onChange={handleInputChange}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#888] text-sm">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={businessInfo.email}
                    onChange={handleInputChange}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                    placeholder="business@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-[#888] text-sm">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={businessInfo.phone}
                    onChange={handleInputChange}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#555]"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
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
                  >
                    Add Business
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
      </div>
    </PageContainer>
  );
}