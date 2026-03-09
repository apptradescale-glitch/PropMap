import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Calendar, LineChart, Globe, DollarSign, Upload, X, Building2, Pen, Timer, TrendingUp, ArrowBigUp, ArrowBigDown, FileText, PieChart as PieChartIcon } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from '@/config/firestore';
import { useAuth } from '@/context/FAuth';

interface Business {
  id?: string;
  name?: string;
  userName?: string;
  businessSector?: string;
  businessType?: string;
  country?: string;
  currency?: string;
  status?: string;
  isActive?: boolean;
  customSector?: string;
  customBusinessType?: string;
  isCombinedView?: boolean;
  businesses?: any[];
}

interface FormData {
  amount: string;
  description: string;
  file: File | null;
}

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
  const { state } = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const business = state?.business as Business;

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'payouts' | 'expenses'>('payouts');
  const [dialogMode, setDialogMode] = useState<'manual' | 'automatic'>('manual');
  const [formData, setFormData] = useState<FormData>({ amount: '', description: '', file: null });

  // Financial data state
  const [payouts, setPayouts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Load financial data from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const loadFinancialData = async () => {
      try {
        // Load payouts for this business or all businesses
        const payoutsQuery = await getDoc(doc(db, 'payouts', currentUser.uid));
        if (payoutsQuery.exists()) {
          const allPayouts = payoutsQuery.data().items || [];
          
          if (business?.isCombinedView) {
            // Combined view: load all payouts from all businesses
            const allBusinessIds = business?.businesses?.map((b: any) => b.id || b.name) || [];
            const combinedPayouts = allPayouts
              .filter((item: any) => allBusinessIds.includes(item.businessId))
              .map((item: any) => {
                // Enrich with sector data from business list if not already set
                if (!item.businessSector || !item.customSector) {
                  const matchedBiz = business?.businesses?.find((b: any) => 
                    (b.id && b.id === item.businessId) || (b.name === item.businessId) || (b.name === item.businessName) || (b.userName === item.businessName)
                  );
                  if (matchedBiz) {
                    return { ...item, businessSector: matchedBiz.businessSector, customSector: matchedBiz.customSector };
                  }
                }
                return item;
              });
            setPayouts(combinedPayouts);
          } else {
            // Single business view - handle both new ID system and legacy name system
            const businessId = business?.id || 'default';
            const businessName = business?.name || business?.userName || 'default';
            
            // Filter by ID (new system) OR by businessName (legacy system)
            const businessPayouts = allPayouts.filter((item: any) => {
              // Check if payout's businessId matches the current business's ID
              const matchesById = item.businessId === businessId;
              // Check if payout's businessId matches the current business's name (legacy)
              const matchesByName = item.businessId === businessName;
              // Also check if payout's businessName field matches current business name
              const matchesByBusinessName = item.businessName === businessName;
              
              return matchesById || matchesByName || matchesByBusinessName;
            });
            
            setPayouts(businessPayouts);
          }
        }

        // Load expenses for this business or all businesses
        const expensesQuery = await getDoc(doc(db, 'expenses', currentUser.uid));
        if (expensesQuery.exists()) {
          const allExpenses = expensesQuery.data().items || [];
          
          if (business?.isCombinedView) {
            // Combined view: load all expenses from all businesses
            const allBusinessIds = business?.businesses?.map((b: any) => b.id || b.name) || [];
            const combinedExpenses = allExpenses
              .filter((item: any) => allBusinessIds.includes(item.businessId))
              .map((item: any) => {
                // Enrich with sector data from business list if not already set
                if (!item.businessSector || !item.customSector) {
                  const matchedBiz = business?.businesses?.find((b: any) => 
                    (b.id && b.id === item.businessId) || (b.name === item.businessId) || (b.name === item.businessName) || (b.userName === item.businessName)
                  );
                  if (matchedBiz) {
                    return { ...item, businessSector: matchedBiz.businessSector, customSector: matchedBiz.customSector };
                  }
                }
                return item;
              });
            setExpenses(combinedExpenses);
          } else {
            // Single business view - handle both new ID system and legacy name system
            const businessId = business?.id || 'default';
            const businessName = business?.name || business?.userName || 'default';
            
            // Filter by ID (new system) OR by businessName (legacy system)
            const businessExpenses = allExpenses.filter((item: any) => {
              // Check if expense's businessId matches the current business's ID
              const matchesById = item.businessId === businessId;
              // Check if expense's businessId matches the current business's name (legacy)
              const matchesByName = item.businessId === businessName;
              // Also check if expense's businessName field matches current business name
              const matchesByBusinessName = item.businessName === businessName;
              
              return matchesById || matchesByName || matchesByBusinessName;
            });
            
            setExpenses(businessExpenses);
          }
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      }
    };

    loadFinancialData();
  }, [currentUser, business?.id, business?.name, business?.isCombinedView, business?.businesses]);

  // Calculate total payouts and expenses
  const totalPayouts = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalRevenue = totalPayouts - totalExpenses;

  // Calculate individual business totals for Business Overview card
  const [businessDataWithTotals, setBusinessDataWithTotals] = useState<any[]>([]);
  const [showPieAsMoney, setShowPieAsMoney] = useState(false);

  useEffect(() => {
    const calculateBusinessTotals = async () => {
      if (business?.isCombinedView && business?.businesses && currentUser) {
        try {
          // Load all payouts and expenses once (same structure as main data loading)
          const payoutsDoc = await getDoc(doc(db, 'payouts', currentUser.uid));
          const expensesDoc = await getDoc(doc(db, 'expenses', currentUser.uid));
          const allPayouts = payoutsDoc.exists() ? (payoutsDoc.data().items || []) : [];
          const allExpenses = expensesDoc.exists() ? (expensesDoc.data().items || []) : [];

          const businessesWithTotals = business.businesses.map((biz: any) => {
            const bizId = biz.id || '';
            const bizName = biz.businessSector === 'proptrading' ? biz.userName : biz.name;

            // Filter payouts for this business by ID or name
            const bizPayouts = allPayouts.filter((item: any) => 
              item.businessId === bizId || item.businessId === bizName || item.businessName === bizName
            );

            // Filter expenses for this business by ID or name
            const bizExpenses = allExpenses.filter((item: any) => 
              item.businessId === bizId || item.businessId === bizName || item.businessName === bizName
            );

            const bizTotalPayouts = bizPayouts.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
            const bizTotalExpenses = bizExpenses.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
            const bizTotalRevenue = bizTotalPayouts - bizTotalExpenses;

            return {
              ...biz,
              totalRevenue: bizTotalRevenue,
              totalExpenses: bizTotalExpenses,
              totalPayouts: bizTotalPayouts,
              currency: biz.currency || 'USD'
            };
          });

          setBusinessDataWithTotals(businessesWithTotals);
        } catch (error) {
          console.error('Error loading business totals:', error);
        }
      }
    };

    calculateBusinessTotals();
  }, [business, currentUser]);

  // Combine and sort financial data for Revenue History
  const combinedFinancialData = [...payouts, ...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Prepare chart data from financial data
  const chartData = React.useMemo(() => {
    if (combinedFinancialData.length === 0) {
      return [{ date: '', pnl: 0 }];
    }

    // Group financial data by date and calculate daily P&L
    const dailyData = combinedFinancialData.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = 0;
      }
      // Payouts are positive, expenses are negative for P&L calculation
      acc[date] += item.type === 'payouts' ? Number(item.amount) : -Number(item.amount);
      return acc;
    }, {} as Record<string, number>);

    // Convert to chart format and sort by date
    let cumulativeSum = 0;
    const sortedData = Object.entries(dailyData)
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
      .map(([date, pnl]) => {
        cumulativeSum += pnl;
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
          pnl: Number(cumulativeSum.toFixed(2))
        };
      });

    return [{ date: '', pnl: 0 }, ...sortedData];
  }, [combinedFinancialData]);

  // Save financial data to Firestore with optimistic updates
  const saveFinancialData = async (type: 'payouts' | 'expenses', data: any) => {
    if (!currentUser || business?.isCombinedView) {
      alert('Cannot add financial data in combined view. Please select a specific business.');
      return;
    }

    // Use business ID as primary identifier, fallback to name if no ID
    const businessId = business?.id || business?.name || 'default';

    // Create the new item immediately
    const newItem = {
      id: crypto.randomUUID(),
      type: type, // 'payouts' or 'expenses'
      businessId: businessId,
      businessName: businessName,
      businessSector: business?.businessSector,
      customSector: business?.customSector,
      amount: Number(data.amount),
      description: data.description,
      fileName: data.file?.name || null,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    };

    // Optimistic update - update local state immediately
    if (type === 'payouts') {
      setPayouts(prev => [...prev, newItem]);
    } else {
      setExpenses(prev => [...prev, newItem]);
    }

    // Save to Firestore in the background
    try {
      const collectionRef = doc(db, type, currentUser.uid);
      const docSnap = await getDoc(collectionRef);

      if (docSnap.exists()) {
        await updateDoc(collectionRef, {
          items: arrayUnion(newItem)
        });
      } else {
        await setDoc(collectionRef, {
          items: [newItem]
        });
      }
    } catch (error) {
      // If Firestore save fails, revert the optimistic update
      console.error('Error saving financial data:', error);
      
      // Remove the item from local state
      if (type === 'payouts') {
        setPayouts(prev => prev.filter(item => item.id !== newItem.id));
      } else {
        setExpenses(prev => prev.filter(item => item.id !== newItem.id));
      }
      
      // Show error to user
      alert('Failed to save data. Please try again.');
      throw error;
    }
  };

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

  const handleOpenDialog = (type: 'payouts' | 'expenses', mode: 'manual' | 'automatic') => {
    setDialogType(type);
    setDialogMode(mode);
    setIsDialogOpen(true);
    setFormData({ amount: '', description: '', file: null });
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setFormData({ amount: '', description: '', file: null });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, file: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await saveFinancialData(dialogType, formData);
      handleCloseDialog();
    } catch (error) {
      alert('Error saving data. Please try again.');
      console.error('Submit error:', error);
    }
  };

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
      <div className="space-y-2 pb-8 pt-5">
        <div className="flex items-center justify-between -mt-5 pb-4">
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
                    <div className="flex flex-col">
                      <div className="text-lg font-bold text-white">
                        {business.businessSector === 'proptrading' ? business.userName : business.name}
                      </div>
                      <div className="text-sm text-[#888]">
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
                      </div>
                    </div>
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
              <div className="text-2xl font-bold text-white">{business.currency ? getCurrencySymbol(business.currency) + totalRevenue.toFixed(2) : '$' + totalRevenue.toFixed(2)}</div>
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
              <div className="text-2xl font-bold text-white">{business.currency ? getCurrencySymbol(business.currency) + totalPayouts.toFixed(2) : '$' + totalPayouts.toFixed(2)}</div>
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
              <div className="text-2xl font-bold text-white">{business.currency ? getCurrencySymbol(business.currency) + totalExpenses.toFixed(2) : '$' + totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-[#666] mt-1">Total Expenses</p>
            </CardContent>
          </Card>
        </div>

        
        {/* Performance + Location/Analytics row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Performance Chart Card - Left */}
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white">
                  Performance
                </CardTitle>
                <CardDescription className="text-[#666]">
                  Business performance metrics
                </CardDescription>
              </div>
              <TrendingUp className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div style={{ width: '100%', height: 350, marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 30,
                      left: 10,
                      bottom: 10
                    }}
                  >
                    <defs>
                      <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e0ac69" stopOpacity={0.3}/>
                        <stop offset="40%" stopColor="#e0ac69" stopOpacity={0.2}/>
                        <stop offset="100%" stopColor="#e0ac69" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3"
                      vertical={!business?.isCombinedView}
                      stroke="#6b7280"
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={true}
                      axisLine={true}
                      tickMargin={8}
                      minTickGap={32}
                      tick={{ fontSize: 12, fill: 'white' }}
                    />
                    <YAxis
                      tickLine={true}
                      axisLine={true}
                      tick={{ fontSize: 12, fill: 'white' }}
                      tickFormatter={(value) => {
                        const formattedNumber = Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                        const currencySymbol = business ? getCurrencySymbol(business.currency || 'USD') : '$';
                        return value < 0 ? `-${currencySymbol}${formattedNumber}` : `${currencySymbol}${formattedNumber}`;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke="#e0ac69"
                      strokeWidth={2}
                      fill="url(#performanceGradient)"
                      connectNulls={true}
                      isAnimationActive={true}
                      animationDuration={750}
                    />
                    <Tooltip
                      cursor={{ stroke: '#e0ac6933' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const value = Number(payload[0].value);
                        const formattedValue = Math.abs(value).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        });
                        const currencySymbol = business ? getCurrencySymbol(business.currency || 'USD') : '$';
                        return (
                          <div className="rounded-lg bg-white/5 backdrop-blur-sm px-4 py-2 shadow-md">
                            <div className="text-sm text-stone-400">
                              {payload[0].payload.date || 'Start'}
                            </div>
                            <div className={`text-lg font-semibold ${value >= 0 ? 'text-[#e0ac69]' : 'text-red-500'}`}>
                              {value < 0 ? `-${currencySymbol}${formattedValue}` : `${currencySymbol}${formattedValue}`}
                            </div>
                          </div>
                        );
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Right side - Analytics + Location stacked */}
          <div className="grid grid-cols-2 gap-4">
            {/* Business Overview Card - Only in combined view */}
            {business?.isCombinedView && (
            <Card className="border-[#2a2a2a] bg-[#0a0a0a] col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-sm font-medium text-white">
                    Business Overview
                  </CardTitle>
                  <CardDescription className="text-[#666]">
                    View all your businesses
                  </CardDescription>
                </div>
                <Building2 className="h-4 w-4 text-[#666]" />
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <div className="h-full min-h-[280px] overflow-y-auto">
                  {/* Business List */}
                  {businessDataWithTotals && businessDataWithTotals.length > 0 ? (
                    <div className="space-y-3">
                      {businessDataWithTotals.map((biz: any, index: number) => (
                        <div key={biz.id || index} className="p-4 rounded-lg bg-transparent border border-[#2a2a2a] hover:border-[#e0ac69]/50 transition-all duration-200">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center flex-shrink-0">
                              <span className="text-[#888] font-medium" style={{ fontSize: '10px' }}>
                                {biz.businessSector === 'proptrading' 
                                  ? biz.userName?.charAt(0)?.toUpperCase() || 'U'
                                  : biz.name?.charAt(0)?.toUpperCase() || 'B'
                                }
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-white font-semibold text-sm truncate">
                                  {biz.businessSector === 'proptrading' ? biz.userName : biz.name}
                                </h4>
                                <div className={`w-2 h-2 rounded-full ${biz.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              </div>
                              <div className="text-xs mt-1">
                                <span>{biz.businessSector === 'proptrading' ? 'PropTrading' : biz.customSector}</span>
                              </div>
                            </div>
                            
                            {/* Financial Numbers - Right Side */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-sm font-bold text-white">
                                  {getCurrencySymbol(biz.currency)}{biz.totalRevenue.toFixed(2)}
                                </div>
                                <p className="text-xs text-[#666]">Revenue</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-white">
                                  {getCurrencySymbol(biz.currency)}{biz.totalPayouts.toFixed(2)}
                                </div>
                                <p className="text-xs text-[#666]">Payouts</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-white">
                                  {getCurrencySymbol(biz.currency)}{biz.totalExpenses.toFixed(2)}
                                </div>
                                <p className="text-xs text-[#666]">Expenses</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[200px]">
                      <p className="text-[#666] text-sm">No businesses found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Add Your Numbers Card - Hidden in combined view */}
            {!business?.isCombinedView && (
            <Card className="border-[#2a2a2a] bg-[#0a0a0a] shadow-lg shadow-white/20 transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <div className="relative inline-block">
                  <div 
                    className="absolute inset-0 bg-[#e0ac69]/50 transform -rotate-1 rounded"
                    style={{
                      filter: 'blur(0.5px)',
                      clipPath: 'polygon(0 5%, 95% 0%, 100% 95%, 5% 100%)'
                    }}
                  ></div>
                  <div 
                    className="relative bg-[#e0ac69]/50 px-2 py-1 rounded"
                    style={{
                      transform: 'rotate(0.5deg)',
                      filter: 'blur(0.3px)'
                    }}
                  >
                    <CardTitle className="text-sm font-medium text-white">
                      Add your numbers
                    </CardTitle>
                  </div>
                </div>
                <Pen className="h-4 w-4 text-[#666]" />
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <div className="space-y-4">
                  {/* Payouts/Income Section */}
                  <div className="space-y-2">
                    <p className="text-white text-sm font-medium">Payouts / Income</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog('payouts', 'manual')}
                        className="flex-1 bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white text-xs"
                      >
                        Add Manually
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog('payouts', 'automatic')}
                        className="flex-1 bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white text-xs"
                      >
                        Add Automatically
                      </Button>
                    </div>
                  </div>
                  
                  {/* Separator Line */}
                  <div className="h-px bg-[#333]"></div>
                  
                  {/* Expenses Section */}
                  <div className="space-y-2">
                    <p className="text-white text-sm font-medium">Add Expenses</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog('expenses', 'manual')}
                        className="flex-1 bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white text-xs"
                      >
                        Add Manually
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog('expenses', 'automatic')}
                        className="flex-1 bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white text-xs"
                      >
                        Add Automatically
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {/* PropFirm Breakdown / Income Expenses Flow Card - Hidden in combined view */}
            {!business?.isCombinedView && (
            <Card className="border-[#2a2a2a] bg-[#0a0a0a] row-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="text-sm font-medium text-white">
                  {business?.businessSector === 'proptrading' ? 'PropFirm Breakdown' : 'Income / Expenses Flow'}
                </CardTitle>
                <LineChart className="h-4 w-4 text-[#666]" />
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <div className="flex items-center justify-center h-full min-h-[280px]">
                  <p className="text-[#666] text-sm">
                    {business?.businessSector === 'proptrading' ? 'PropFirm breakdown coming soon' : 'Income / Expenses flow coming soon'}
                  </p>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Right - Location + Coming Soon + Coming Soon stacked - Hidden in combined view */}
            {!business?.isCombinedView && (
            <div className="grid grid-rows-3 gap-2">
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

              {/* Coming Soon Card - Middle */}
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

              {/* Coming Soon Card 2 - Bottom */}
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
            )}
          </div>
        </div>

        {/* Bottom Row - Revenue History */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Cashflow Allocation Pie Chart - Only in combined view */}
          {business?.isCombinedView ? (
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white">
                  Cashflow Allocation
                </CardTitle>
                <CardDescription className="text-[#666]">
                  See how your businesses compare in revenue
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPieAsMoney(!showPieAsMoney)}
                className="bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white text-xs h-7 px-2"
              >
                {showPieAsMoney ? 'Show %' : `Show Revenue in ${getCurrencySymbol(business?.businesses?.[0]?.currency || business?.currency || 'USD')}`}
              </Button>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div style={{ width: '100%', height: 350, marginTop: '10px' }}>
                {(() => {
                  const PIE_COLORS = ['#e0ac69', '#6366f1', '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6'];
                  const pieData = (businessDataWithTotals || []).map((biz: any) => ({
                    name: biz.businessSector === 'proptrading' ? biz.userName : biz.name,
                    value: Math.max(biz.totalPayouts || 0, 0),
                    revenue: biz.totalRevenue || 0,
                    currency: biz.currency || 'USD',
                    sector: biz.businessSector === 'proptrading' ? 'PropTrading' : biz.customSector || 'Business'
                  }));
                  const totalValue = pieData.reduce((sum: number, d: any) => sum + d.value, 0);
                  
                  return totalValue > 0 ? (
                    <div className="flex flex-col items-center gap-4 h-full">
                      <ResponsiveContainer width="100%" height={250}>
                        <RechartsPieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={pieData.length > 1 ? 3 : 0}
                            dataKey="value"
                            animationDuration={750}
                          >
                            {pieData.map((_: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const data = payload[0].payload;
                              const percentage = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : '0';
                              const currencySymbol = business ? getCurrencySymbol(business.currency || 'USD') : '$';
                              return (
                                <div className="rounded-lg bg-white/5 backdrop-blur-sm px-4 py-2 shadow-md">
                                  <div className="text-sm text-white font-medium">{data.name}</div>
                                  <div className="text-xs text-[#666]">{data.sector}</div>
                                  <div className="text-sm font-semibold text-[#e0ac69] mt-1">
                                    {currencySymbol}{data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({percentage}%)
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      {/* Legend */}
                      <div className="flex flex-wrap justify-center gap-4">
                        {pieData.map((entry: any, index: number) => {
                          const percentage = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : '0';
                          return (
                            <div key={index} className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                <span className="text-white text-xs">{entry.name}</span>
                                <span className="text-white text-xs font-semibold">
                                  {showPieAsMoney 
                                    ? `${entry.revenue < 0 ? '-' : ''}${getCurrencySymbol(entry.currency)}${Math.abs(entry.revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : `${percentage}%`
                                  }
                                </span>
                              </div>
                              <span className="text-[#666] text-xs">{entry.sector}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-[#666] text-sm">No revenue data yet</p>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
          ) : (
          /* Cashflow Allocation Pie Chart - Individual business: Income vs Expenses */
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white">
                  Cashflow Allocation
                </CardTitle>
                <CardDescription className="text-[#666]">
                  Income vs Expenses breakdown
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPieAsMoney(!showPieAsMoney)}
                className="bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white text-xs h-7 px-2"
              >
                {showPieAsMoney ? 'Show %' : `Show in ${getCurrencySymbol(business?.currency || 'USD')}`}
              </Button>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div style={{ width: '100%', height: 350, marginTop: '10px' }}>
                {(() => {
                  const PIE_COLORS_SINGLE = ['#e0ac69', '#ef4444'];
                  const singlePieData = [
                    { name: 'Income / Payouts', value: Math.max(totalPayouts, 0), label: 'Income' },
                    { name: 'Expenses', value: Math.max(totalExpenses, 0), label: 'Expenses' }
                  ];
                  const singleTotal = singlePieData.reduce((sum, d) => sum + d.value, 0);
                  const currencySymbol = business ? getCurrencySymbol(business.currency || 'USD') : '$';
                  
                  return singleTotal > 0 ? (
                    <div className="flex flex-col items-center gap-4 h-full">
                      <ResponsiveContainer width="100%" height={250}>
                        <RechartsPieChart>
                          <Pie
                            data={singlePieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={singlePieData.filter(d => d.value > 0).length > 1 ? 3 : 0}
                            dataKey="value"
                            animationDuration={750}
                          >
                            {singlePieData.map((_: any, index: number) => (
                              <Cell key={`cell-single-${index}`} fill={PIE_COLORS_SINGLE[index]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const data = payload[0].payload;
                              const percentage = singleTotal > 0 ? ((data.value / singleTotal) * 100).toFixed(1) : '0';
                              return (
                                <div className="rounded-lg bg-white/5 backdrop-blur-sm px-4 py-2 shadow-md">
                                  <div className="text-sm text-white font-medium">{data.name}</div>
                                  <div className="text-sm font-semibold text-[#e0ac69] mt-1">
                                    {currencySymbol}{data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({percentage}%)
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      {/* Legend */}
                      <div className="flex flex-wrap justify-center gap-6">
                        {singlePieData.map((entry, index) => {
                          const percentage = singleTotal > 0 ? ((entry.value / singleTotal) * 100).toFixed(1) : '0';
                          return (
                            <div key={index} className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS_SINGLE[index] }}></div>
                                <span className="text-white text-xs">{entry.label}</span>
                                <span className="text-white text-xs font-semibold">
                                  {showPieAsMoney 
                                    ? `${currencySymbol}${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : `${percentage}%`
                                  }
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-[#666] text-sm">No financial data yet</p>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Revenue History Card */}
          <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white">
                  Revenue History
                </CardTitle>
                <CardDescription className="text-[#666]">
                  Payouts & Expenses History
                </CardDescription>
              </div>
              <Timer className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="h-full min-h-[350px] overflow-y-auto">
                {combinedFinancialData.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#666] text-sm">No payouts or expenses yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {combinedFinancialData.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-transparent border border-[#2a2a2a]">
                        {/* Arrow Icon */}
                        <div className="flex-shrink-0">
                          {item.type === 'payouts' ? (
                            <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-green-500/50">
                              <ArrowBigUp className="w-5 h-5 text-green-400" />
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-red-500/50">
                              <ArrowBigDown className="w-5 h-5 text-red-400" />
                            </div>
                          )}
                        </div>

                        {/* Description and File */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {item.description}
                          </p>
                          {business?.isCombinedView && item.businessName && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-white text-xs truncate">
                                {item.businessName}
                              </span>
                              <span className="text-[#666] text-xs">|</span>
                              <span className="text-[#666] text-xs truncate">
                                {item.businessSector === 'proptrading' ? 'PropTrading' : item.businessSector === 'trade-copier-software' ? 'Trade Copier Software' : item.customSector || 'Business'}
                              </span>
                            </div>
                          )}
                          {item.fileName && (
                            <div className="flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3 text-[#666]" />
                              <p className="text-[#666] text-xs truncate">{item.fileName}</p>
                            </div>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="flex-shrink-0 text-right">
                          <p className={`text-sm font-bold ${
                            item.type === 'payouts' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {business.currency ? getCurrencySymbol(business.currency || 'USD') : '$'}
                            {Math.abs(item.amount).toFixed(2)}
                          </p>
                          <p className="text-[#666] text-xs">
                            {new Date(item.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        {/* Add Numbers Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">
                Add {dialogType === 'payouts' ? 'Payouts/Income' : 'Expenses'} {dialogMode === 'manual' ? 'Manually' : 'Automatically'}
              </DialogTitle>
            </DialogHeader>
            
            {dialogMode === 'manual' ? (
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-[#666]">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                    required
                  />
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[#666]">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-[#1a1a1a] border-[#2a2a2a] text-white min-h-[100px] resize-none"
                    rows={4}
                  />
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-[#666]">Upload File</Label>
                  <div className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-4 text-center">
                    <input
                      id="file"
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                    />
                    <label htmlFor="file" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-[#666]" />
                      <p className="text-[#666] text-sm">
                        {formData.file ? formData.file.name : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-[#666] text-xs mt-1">
                        PDF, DOC, DOCX, TXT, JPG, PNG (MAX. 10MB)
                      </p>
                    </label>
                  </div>
                </div>

                {/* Dialog Actions */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCloseDialog}
                    className="text-[#666] hover:text-white hover:bg-[#1a1a1a]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-white hover:bg-gray-100 text-black"
                  >
                    Save
                  </Button>
                </div>
              </form>
            ) : (
              <div className="py-8 text-center">
                <p className="text-[#666]">Automatic integration coming soon</p>
                <Button
                  onClick={handleCloseDialog}
                  className="mt-4 bg-[#94bba3] hover:bg-[#7da392] text-white"
                >
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </PageContainer>
  );
}
