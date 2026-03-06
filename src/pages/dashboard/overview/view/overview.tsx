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
    name: ''
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
      businessSector: '',
      customSector: '',
      name: ''
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
        <div className="flex items-start justify-start h-64 ml-8 mt-32">
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
                    disabled={!businessInfo.businessSector || (businessInfo.businessSector === 'other' && !businessInfo.customSector)}
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