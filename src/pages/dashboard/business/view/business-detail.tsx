import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { ArrowLeft, Calendar, LineChart, Globe, DollarSign, Upload, X, Building2, Pen, Timer, TrendingUp, ArrowBigUp, ArrowBigDown, FileText, PieChart as PieChartIcon, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Derive correct currency: for combined view, use first business's currency
  const effectiveCurrency = business?.isCombinedView
    ? (business?.businesses?.[0]?.currency || business?.currency || 'USD')
    : (business?.currency || 'USD');
  const currencySymbol = getCurrencySymbol(effectiveCurrency);

  const fmtMoney = (val: number, decimals = 2) =>
    Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'payouts' | 'expenses'>('payouts');
  const [dialogMode, setDialogMode] = useState<'manual' | 'automatic'>('manual');
  const [formData, setFormData] = useState<FormData>({ amount: '', description: '', file: null });

  // Financial data state
  const [payouts, setPayouts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

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

  // Calendar data for individual business view
  const calendarDays = useMemo(() => {
    if (business?.isCombinedView) return [];
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const lastDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const firstDayOffset = (firstDay.getDay() + 6) % 7;
    const days: any[] = [];
    for (let i = 0; i < firstDayOffset; i++) {
      days.push({ isEmpty: true });
    }
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const yyyy = firstDay.getFullYear();
      const mm = String(firstDay.getMonth() + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = (new Date(yyyy, parseInt(mm) - 1, day).getDay() + 6) % 7;
      const dayPayouts = payouts.filter(p => p.date === dateString);
      const dayExpenses = expenses.filter(e => e.date === dateString);
      const totalIn = dayPayouts.reduce((sum: number, p: any) => sum + p.amount, 0);
      const totalOut = dayExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
      const net = totalIn - totalOut;
      const items = [
        ...dayPayouts.map((p: any) => ({ ...p, itemType: 'payout' })),
        ...dayExpenses.map((e: any) => ({ ...e, itemType: 'expense' }))
      ];
      days.push({ day, date: dateString, dayOfWeek, net, totalIn, totalOut, items, hasData: items.length > 0 });
    }
    return days;
  }, [calendarMonth, payouts, expenses, business?.isCombinedView]);

  const calendarNumRows = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const lastDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const firstDayOffset = (firstDay.getDay() + 6) % 7;
    return Math.ceil((firstDayOffset + lastDay.getDate()) / 7);
  }, [calendarMonth]);

  // Selected day items for calendar dialog
  const selectedDayItems = useMemo(() => {
    if (!selectedCalendarDay) return [];
    const dayPayouts = payouts.filter(p => p.date === selectedCalendarDay).map((p: any) => ({ ...p, itemType: 'payout' }));
    const dayExpenses = expenses.filter(e => e.date === selectedCalendarDay).map((e: any) => ({ ...e, itemType: 'expense' }));
    return [...dayPayouts, ...dayExpenses];
  }, [selectedCalendarDay, payouts, expenses]);

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
        cumulativeSum += Number(pnl);
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
          pnl: Number(cumulativeSum.toFixed(2))
        };
      });

    return [{ date: '', pnl: 0 }, ...sortedData];
  }, [combinedFinancialData]);

  const lastPnl = chartData.length > 0 ? Number(chartData[chartData.length - 1].pnl) : 0;
  const isPositivePerf = lastPnl >= 0;

  // Canvas refs for nn-style charts
  const subscriptionCanvasRef = useRef<HTMLCanvasElement>(null);
  const perfCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Tooltip state for bar chart
  const [hoveredBar, setHoveredBar] = useState<{ month: string; value: number; isPositive: boolean } | null>(null);

  // Monthly history data for current month (payouts + expenses grouped by day)
  const monthlyHistoryData = useMemo(() => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayPayouts = combinedFinancialData
        .filter(item => item.type === 'payouts')
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() === new Date().getMonth() && 
                 itemDate.getFullYear() === new Date().getFullYear() &&
                 itemDate.getDate() === day;
        })
        .reduce((sum, item) => sum + item.amount, 0);
      const dayExpenses = combinedFinancialData
        .filter(item => item.type === 'expenses')
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() === new Date().getMonth() && 
                 itemDate.getFullYear() === new Date().getFullYear() &&
                 itemDate.getDate() === day;
        })
        .reduce((sum, item) => sum + item.amount, 0);
      return { day, payout: dayPayouts, expense: dayExpenses };
    });
  }, [combinedFinancialData]);

  const yearlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, index) => {
      const monthPayouts = combinedFinancialData
        .filter(item => item.type === 'payouts')
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() === index && 
                 itemDate.getFullYear() === new Date().getFullYear();
        })
        .reduce((sum, item) => sum + item.amount, 0);
      const monthExpenses = combinedFinancialData
        .filter(item => item.type === 'expenses')
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate.getMonth() === index && 
                 itemDate.getFullYear() === new Date().getFullYear();
        })
        .reduce((sum, item) => sum + item.amount, 0);
      const netValue = monthPayouts - monthExpenses;
      return { month, value: netValue, isPositive: netValue >= 0 };
    });
  }, [combinedFinancialData]);

  const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Performance line data - fake data matching nn/dashboard.ts Revenue chart
  const perfDataPrimary = [
    80, 95, 110, 90, 130, 160, 140, 200, 180, 250,
    310, 280, 350, 390, 340, 420, 460, 500, 480, 440,
    410, 380, 350, 320, 360, 400, 450, 420, 380, 350
  ];
  const perfDataSecondary = [
    60, 70, 85, 75, 100, 120, 110, 150, 135, 180,
    200, 220, 190, 210, 230, 250, 240, 260, 280, 300,
    290, 310, 330, 350, 340, 320, 300, 280, 260, 240
  ];

  // Calculate dynamic dates for Revenue chart
  const revenueDateRange = useMemo(() => {
    const allDates = combinedFinancialData.map(item => new Date(item.date));
    const now = new Date();
    
    if (allDates.length === 0) {
      // Default to current month if no data
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: firstDay,
        endDate: now
      };
    }
    
    const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
    return {
      startDate: sortedDates[0],
      endDate: now // Always show current date
    };
  }, [combinedFinancialData]);

  // Calendar helper
  const calendarNumRows2 = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const lastDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const firstDayOffset = (firstDay.getDay() + 6) % 7;
    return Math.ceil((firstDayOffset + lastDay.getDate()) / 7);
  }, [calendarMonth]);

  // Canvas bar chart drawing for yearly data
  const drawBarChart = useCallback((canvas: HTMLCanvasElement, data: { month: string; value: number; isPositive: boolean }[]) => {
    if (!canvas || data.length < 1) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    
    const padLeft = 25, padRight = 5, padTop = 5, padBottom = 25;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    
    // Calculate bar width and spacing to center bars above month labels
    const totalBars = data.length;
    const barWidth = Math.min(chartW / totalBars * 0.5, 20); // Max width of 20px
    const totalBarWidth = barWidth * totalBars;
    const totalGapWidth = chartW - totalBarWidth;
    const gap = totalGapWidth / (totalBars + 1); // Extra gap at both ends
    
    const allVals = data.map(d => d.value);
    const max = allVals.length > 0 ? Math.max(...allVals.map(Math.abs)) : 500;
    const niceMax = Math.ceil(max * 1.1 / 100) * 100 || 500;
    const range = niceMax || 1;
    
    // Draw zero line
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zeroY = padTop + chartH;
    ctx.moveTo(padLeft, zeroY);
    ctx.lineTo(padLeft + chartW, zeroY);
    ctx.stroke();
    
    function drawBar(x: number, val: number, isPositive: boolean) {
      ctx.fillStyle = isPositive ? '#D1D5DB' : '#555555';
      const barH = (Math.abs(val) / range) * chartH;
      const barY = isPositive 
        ? zeroY - barH 
        : zeroY;
      ctx.fillRect(x, barY, barWidth, barH);
    }
    
    // Store bar positions for hover detection
    const barPositions: { x: number; y: number; width: number; height: number; data: typeof data[0] }[] = [];
    
    data.forEach((d, i) => {
      // Position each bar centered above its month label with adjustment
      const monthPosition = padLeft + (i + 0.5) * (chartW / totalBars);
      const x = monthPosition - barWidth / 2 - 2; // Move 2px to the left for better alignment
      
      const barH = (Math.abs(d.value) / range) * chartH;
      const barY = d.isPositive ? zeroY - barH : zeroY;
      
      drawBar(x, d.value, d.isPositive);
      
      // Store position for hover
      barPositions.push({
        x: x,
        y: barY,
        width: barWidth,
        height: barH,
        data: d
      });
    });
    
    // Add mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      let hovered: typeof data[0] | null = null;
      
      for (const bar of barPositions) {
        if (mouseX >= bar.x && mouseX <= bar.x + bar.width &&
            mouseY >= bar.y && mouseY <= bar.y + bar.height) {
          hovered = bar.data;
          break;
        }
      }
      
      setHoveredBar(hovered);
    };
    
    const handleMouseLeave = () => {
      setHoveredBar(null);
    };
    
    canvas.onmousemove = handleMouseMove;
    canvas.onmouseleave = handleMouseLeave;
  }, [setHoveredBar]);

  // Canvas line chart drawing (matches nn/src/dashboard.ts drawLineChart) - supports two lines
  const drawLineChart = useCallback((canvas: HTMLCanvasElement, dataPrimary: number[], dataSecondary?: number[]) => {
    if (!canvas || dataPrimary.length < 2) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const padLeft = 30, padRight = 10, padTop = 5, padBottom = 5;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const allValues = [...dataPrimary, ...(dataSecondary || [])];
    const maxVal = Math.max(...allValues) * 1.1;
    const minVal = 0;
    const range = maxVal - minVal || 1;
    function drawLine(data: number[], color: string, lw: number) {
      ctx!.beginPath();
      ctx!.strokeStyle = color;
      ctx!.lineWidth = lw;
      ctx!.lineJoin = 'round';
      ctx!.lineCap = 'round';
      data.forEach((val, i) => {
        const x = padLeft + (i / (data.length - 1)) * chartW;
        const y = padTop + chartH - ((val - minVal) / range) * chartH;
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      });
      ctx!.stroke();
    }
    if (dataSecondary && dataSecondary.length >= 2) {
      drawLine(dataSecondary, '#6B7280', 1);
    }
    drawLine(dataPrimary, '#D1D5DB', 1.5);
  }, []);

  // Draw canvas charts on mount and data change
  useEffect(() => {
    if (subscriptionCanvasRef.current && yearlyData.length > 0) {
      drawBarChart(subscriptionCanvasRef.current, yearlyData);
    }
    if (perfCanvasRef.current) {
      drawLineChart(perfCanvasRef.current, perfDataPrimary, perfDataSecondary);
    }
  }, [yearlyData, drawBarChart, drawLineChart]);

  // Resize handler for canvas charts
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (subscriptionCanvasRef.current && yearlyData.length > 0) {
          drawBarChart(subscriptionCanvasRef.current, yearlyData);
        }
        if (perfCanvasRef.current) {
          drawLineChart(perfCanvasRef.current, perfDataPrimary, perfDataSecondary);
        }
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timer); };
  }, [yearlyData, drawBarChart, drawLineChart]);

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
          <Card className="h-auto border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
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
          <Card className="h-auto border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                Revenue
              </CardTitle>
              <LineChart className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono' }}>{currencySymbol}{fmtMoney(totalRevenue)}</div>
              <p className="text-xs text-[#888] mt-1" style={{ fontFamily: 'Inter' }}>Total Revenue</p>
            </CardContent>
          </Card>

          {/* Empty Card 3 */}
          <Card className="h-auto border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                Payouts / Income
              </CardTitle>
              <DollarSign className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono' }}>{currencySymbol}{fmtMoney(totalPayouts)}</div>
              <p className="text-xs text-[#888] mt-1" style={{ fontFamily: 'Inter' }}>Total Payouts</p>
            </CardContent>
          </Card>

          {/* Empty Card 4 */}
          <Card className="h-auto border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                Expenses
              </CardTitle>
              <DollarSign className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono' }}>{currencySymbol}{fmtMoney(totalExpenses)}</div>
              <p className="text-xs text-[#888] mt-1" style={{ fontFamily: 'Inter' }}>Total Expenses</p>
            </CardContent>
          </Card>
        </div>

        
        {/* Combined view: Performance + Analytics row */}
        {business?.isCombinedView && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Performance Chart (combined) */}
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                  Performance
                </CardTitle>
                <CardDescription className="text-[#666]" style={{ fontFamily: 'Inter' }}>
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
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.25}/>
                        <stop offset="40%" stopColor="#ffffff" stopOpacity={0.15}/>
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#6b7280" opacity={0.4} />
                    <XAxis dataKey="date" tickLine={true} axisLine={true} tickMargin={8} minTickGap={32} tick={{ fontSize: 12, fill: 'white' }} />
                    <YAxis tickLine={true} axisLine={true} tick={{ fontSize: 12, fill: 'white' }}
                      tickFormatter={(value) => {
                        const formattedNumber = Math.abs(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                        return value < 0 ? `-${currencySymbol}${formattedNumber}` : `${currencySymbol}${formattedNumber}`;
                      }}
                    />
                    <Area type="monotone" dataKey="pnl" stroke="#ffffff" strokeWidth={2} fill="url(#performanceGradient)" connectNulls={true} isAnimationActive={true} animationDuration={750} />
                    <Tooltip
                      cursor={{ stroke: '#ffffff33' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const value = Number(payload[0].value);
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        return (
                          <div className="rounded-lg bg-white/5 backdrop-blur-sm px-4 py-2 shadow-md">
                            <div className="text-sm text-stone-400">{payload[0].payload.date || 'Start'}</div>
                            <div className={`text-lg font-semibold ${value >= 0 ? 'text-white' : 'text-red-500'}`}>
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

          {/* Right side - Business Overview (combined only) */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-[#1a1a1a] bg-[#0a0a0a] col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                    Business Overview
                  </CardTitle>
                  <CardDescription className="text-[#666]" style={{ fontFamily: 'Inter' }}>
                    View all your businesses
                  </CardDescription>
                </div>
                <Building2 className="h-4 w-4 text-[#666]" />
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <div className="h-full min-h-[280px] overflow-y-auto">
                  {businessDataWithTotals && businessDataWithTotals.length > 0 ? (
                    <div className="space-y-3">
                      {businessDataWithTotals.map((biz: any, index: number) => (
                        <div key={biz.id || index} className="p-4 rounded-lg bg-transparent border border-[#1a1a1a] hover:border-[#e0ac69]/50 transition-all duration-200">
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
                                <h4 className="text-white font-semibold text-sm truncate" style={{ fontFamily: 'Inter' }}>
                                  {biz.businessSector === 'proptrading' ? biz.userName : biz.name}
                                </h4>
                                <div className={`w-2 h-2 rounded-full ${biz.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              </div>
                              <div className="text-xs mt-1" style={{ fontFamily: 'Inter' }}>
                                <span>{biz.businessSector === 'proptrading' ? 'PropTrading' : biz.customSector}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono' }}>
                                  {getCurrencySymbol(biz.currency)}{fmtMoney(biz.totalRevenue)}
                                </div>
                                <p className="text-xs text-[#666]" style={{ fontFamily: 'Inter' }}>Revenue</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono' }}>
                                  {getCurrencySymbol(biz.currency)}{fmtMoney(biz.totalPayouts)}
                                </div>
                                <p className="text-xs text-[#666]" style={{ fontFamily: 'Inter' }}>Payouts</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-white" style={{ fontFamily: 'JetBrains Mono' }}>
                                  {getCurrencySymbol(biz.currency)}{fmtMoney(biz.totalExpenses)}
                                </div>
                                <p className="text-xs text-[#666]" style={{ fontFamily: 'Inter' }}>Expenses</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[200px]">
                      <p className="text-[#666] text-sm" style={{ fontFamily: 'Inter' }}>No businesses found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

          {/* Calendar Day Detail Dialog */}
          <Dialog open={!!selectedCalendarDay} onOpenChange={() => setSelectedCalendarDay(null)}>
            <DialogContent className="bg-[#0a0a0a] border-[#1a1a1a] text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {selectedCalendarDay ? new Date(selectedCalendarDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {selectedDayItems.length === 0 ? (
                  <p className="text-[#666] text-sm text-center py-4" style={{ fontFamily: 'Inter' }}>No transactions on this day</p>
                ) : (
                  selectedDayItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-[#1a1a1a]">
                      <div className="flex-shrink-0">
                        {item.itemType === 'payout' ? (
                          <div className="p-2 rounded-lg border border-white/20 shadow-lg shadow-[rgba(21, 128, 61, 0.7)]/50">
                            <ArrowBigUp className="w-4 h-4 text-[rgba(21, 128, 61, 0.7)]" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg border border-white/20 shadow-lg shadow-[rgba(185, 28, 28, 0.7)]/50">
                            <ArrowBigDown className="w-4 h-4 text-[rgba(185, 28, 28, 0.7)]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Inter' }}>{item.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold" style={{ 
                            color: item.itemType === 'payout' ? 'rgba(21, 128, 61, 0.7)' : 'rgba(185, 28, 28, 0.7)',
                            fontFamily: 'JetBrains Mono' 
                          }}>
                          {currencySymbol}{fmtMoney(item.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

        {/* Individual business: Row 1 - Revenue History + PropFirm Breakdown */}
        {!business?.isCombinedView && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Revenue History Card */}
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
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
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-transparent border border-[#1a1a1a]">
                        <div className="flex-shrink-0">
                          {item.type === 'payouts' ? (
                            <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-[rgba(21, 128, 61, 0.7)]/50">
                              <ArrowBigUp className="w-5 h-5 text-[rgba(21, 128, 61, 0.7)]" />
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-[rgba(185, 28, 28, 0.7)]/50">
                              <ArrowBigDown className="w-5 h-5 text-[rgba(185, 28, 28, 0.7)]" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Inter' }}>
                            {item.description}
                          </p>
                          {item.fileName && (
                            <div className="flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3 text-[#666]" />
                              <p className="text-[#666] text-xs truncate" style={{ fontFamily: 'Inter' }}>{item.fileName}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold" style={{ 
                            color: item.type === 'payouts' ? 'rgba(21, 128, 61, 0.7)' : 'rgba(185, 28, 28, 0.7)',
                            fontFamily: 'JetBrains Mono' 
                          }}>
                            {currencySymbol}{fmtMoney(item.amount)}
                          </p>
                          <p className="text-[#666] text-xs" style={{ fontFamily: 'Inter' }}>
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

          {/* PropFirm Breakdown / Income Expenses Flow Card */}
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                {business?.businessSector === 'proptrading' ? 'PropFirm Breakdown' : 'Income / Expenses Flow'}
              </CardTitle>
              <PieChartIcon className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4 h-full">
              <div className="flex items-center justify-center h-full min-h-[350px]">
                <p className="text-[#666] text-sm" style={{ fontFamily: 'Inter' }}>
                  {business?.businessSector === 'proptrading' ? 'PropFirm breakdown coming soon' : 'Income / Expenses flow coming soon'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Individual business: Row 2 - Revenue graph + Monthly History */}
        {!business?.isCombinedView && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Revenue graph - nn style canvas line chart */}
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                  Revenue
                </CardTitle>
                <CardDescription className="text-[#666]" style={{ fontFamily: 'Inter' }}>
                  Business performance metrics
                </CardDescription>
              </div>
              <LineChart className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 400, color: '#E7E9EA', lineHeight: 1.2, fontFamily: 'JetBrains Mono' }}>$19.3K</span>
                <span style={{ fontSize: 12, lineHeight: 1.3, fontFamily: 'Inter' }}>
                  <span style={{ color: 'rgba(21, 128, 61, 0.7)' }}>+15%</span>
                  <br />
                  <span style={{ color: '#8B949E' }}>($17,840)</span>
                </span>
              </div>
              <div style={{ position: 'relative', minHeight: 160, marginTop: 8 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 1 }}>
                  {[500, 400, 300, 200, 100].map((v) => (
                    <span key={v} style={{ fontSize: 10, color: '#666', fontFamily: 'JetBrains Mono' }}>{v}</span>
                  ))}
                </div>
                <canvas ref={perfCanvasRef} style={{ display: 'block', width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#666', fontFamily: 'JetBrains Mono' }}>
                    {revenueDateRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 11, color: '#666', fontFamily: 'JetBrains Mono' }}>
                    {revenueDateRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly History Bar Chart */}
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                  Monthly History
                </CardTitle>
                <CardDescription className="text-[#666]" style={{ fontFamily: 'Inter' }}>
                  {new Date().getFullYear()} Overview
                </CardDescription>
              </div>
              <BarChart3 className="h-4 w-4 text-[#666]" />
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div style={{ position: 'relative', minHeight: 160, marginTop: 8 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 1 }}>
                  {(() => {
                    const allVals = yearlyData.map(d => d.value);
                    const max = allVals.length > 0 ? Math.max(...allVals) : 500;
                    const niceMax = Math.ceil(max * 1.1 / 100) * 100 || 500;
                    return [niceMax, Math.round(niceMax * 0.75), Math.round(niceMax * 0.5), Math.round(niceMax * 0.25), 0].map((v, idx) => (
                      <span key={idx} style={{ fontSize: 10, color: '#666', fontFamily: 'JetBrains Mono' }}>{currencySymbol}{fmtMoney(v, 0)}</span>
                    ));
                  })()}
                </div>
                <canvas ref={subscriptionCanvasRef} style={{ display: 'block', width: '100%' }} />
                {/* Tooltip */}
                {hoveredBar && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0, 0, 0, 0.9)',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'Inter',
                      zIndex: 10,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{hoveredBar.month}</div>
                    <div style={{ color: hoveredBar.isPositive ? 'rgba(21, 128, 61, 0.7)' : 'rgba(185, 28, 28, 0.7)' }}>
                      {hoveredBar.isPositive ? 'Profit' : 'Loss'}: {currencySymbol}{fmtMoney(Math.abs(hoveredBar.value))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingLeft: '25px', paddingRight: '5px' }}>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Jan</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Feb</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Mar</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Apr</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>May</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Jun</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Jul</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Aug</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Sep</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Oct</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Nov</span>
                  <span className="text-[11px] text-[#666]" style={{ fontFamily: 'JetBrains Mono' }}>Dec</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Combined view: Bottom Row - Cashflow + Revenue History */}
        {business?.isCombinedView && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Cashflow Allocation Pie Chart */}
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-white" style={{ fontFamily: 'Inter' }}>
                  Cashflow Allocation
                </CardTitle>
                <CardDescription className="text-[#666]" style={{ fontFamily: 'Inter' }}>
                  See how your businesses compare in revenue
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPieAsMoney(!showPieAsMoney)}
                className="bg-transparent border-[#1a1a1a] hover:bg-[#1a1a1a] hover:border-[#444] text-[#666] hover:text-white text-xs h-7 px-2" style={{ fontFamily: 'Inter' }}
              >
                {showPieAsMoney ? 'Show in %' : `Show Revenue in ${currencySymbol}`}
              </Button>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div style={{ width: '100%', height: 350, marginTop: '10px' }}>
                {(() => {
                  const PIE_COLORS = ['#d0d0d0', '#999999', '#666666', '#444444', '#888888', '#555555', '#777777', '#aaaaaa'];
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
                              return (
                                <div className="rounded-lg bg-white/5 backdrop-blur-sm px-4 py-2 shadow-md">
                                  <div className="text-sm text-white font-medium" style={{ fontFamily: 'Inter' }}>{data.name}</div>
                                  <div className="text-xs text-[#666]" style={{ fontFamily: 'Inter' }}>{data.sector}</div>
                                  <div className="text-sm font-semibold text-[#e0ac69] mt-1" style={{ fontFamily: 'JetBrains Mono' }}>
                                    {currencySymbol}{data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({percentage}%)
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-4">
                        {pieData.map((entry: any, index: number) => {
                          const percentage = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : '0';
                          return (
                            <div key={index} className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                <span className="text-white text-xs" style={{ fontFamily: 'Inter' }}>{entry.name}</span>
                                <span className="text-white text-xs font-semibold" style={{ fontFamily: 'JetBrains Mono' }}>
                                  {showPieAsMoney 
                                    ? `${entry.revenue < 0 ? '-' : ''}${getCurrencySymbol(entry.currency)}${Math.abs(entry.revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : `${percentage}%`
                                  }
                                </span>
                              </div>
                              <span className="text-[#666] text-xs" style={{ fontFamily: 'Inter' }}>{entry.sector}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-[#666] text-sm" style={{ fontFamily: 'Inter' }}>No revenue data yet</p>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Revenue History Card */}
          <Card className="border-[#1a1a1a] bg-[#0a0a0a]">
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
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-transparent border border-[#1a1a1a]">
                        <div className="flex-shrink-0">
                          {item.type === 'payouts' ? (
                            <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-[rgba(21, 128, 61, 0.7)]/50">
                              <ArrowBigUp className="w-5 h-5 text-[rgba(21, 128, 61, 0.7)]" />
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-[rgba(185, 28, 28, 0.7)]/50">
                              <ArrowBigDown className="w-5 h-5 text-[rgba(185, 28, 28, 0.7)]" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'Inter' }}>
                            {item.description}
                          </p>
                          {business?.isCombinedView && item.businessName && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-white text-xs truncate" style={{ fontFamily: 'Inter' }}>
                                {item.businessName}
                              </span>
                              <span className="text-[#666] text-xs" style={{ fontFamily: 'Inter' }}>|</span>
                              <span className="text-[#666] text-xs truncate" style={{ fontFamily: 'Inter' }}>
                                {item.businessSector === 'proptrading' ? 'PropTrading' : item.businessSector === 'trade-copier-software' ? 'Trade Copier Software' : item.customSector || 'Business'}
                              </span>
                            </div>
                          )}
                          {item.fileName && (
                            <div className="flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3 text-[#666]" />
                              <p className="text-[#666] text-xs truncate" style={{ fontFamily: 'Inter' }}>{item.fileName}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold" style={{ 
                            color: item.type === 'payouts' ? 'rgba(21, 128, 61, 0.7)' : 'rgba(185, 28, 28, 0.7)',
                            fontFamily: 'JetBrains Mono' 
                          }}>
                            {currencySymbol}{fmtMoney(item.amount)}
                          </p>
                          <p className="text-[#666] text-xs" style={{ fontFamily: 'Inter' }}>
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
        )}
      </div>

        {/* Add Numbers Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-[#0a0a0a] border-[#1a1a1a] text-white max-w-md">
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
                    placeholder=""
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="bg-[#1a1a1a] border-[#1a1a1a] text-white"
                    required
                  />
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[#666]">Description</Label>
                  <Textarea
                    id="description"
                    placeholder=""
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-[#1a1a1a] border-[#1a1a1a] text-white min-h-[100px] resize-none"
                    rows={4}
                  />
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-[#666]">Upload File</Label>
                  <div className="border-2 border-dashed border-[#1a1a1a] rounded-lg p-4 text-center">
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
