import { useEffect, useState, useMemo } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { useBusiness } from '@/context/BusinessContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calculator, TrendingUp, DollarSign, FileText, AlertCircle, Info, Globe } from 'lucide-react';

// Tax rates by country (simplified for demonstration)
const TAX_RATES = {
  'US': {
    income: {
      brackets: [
        { min: 0, max: 11000, rate: 0.10 },
        { min: 11001, max: 44725, rate: 0.12 },
        { min: 44726, max: 95375, rate: 0.22 },
        { min: 95376, max: 182050, rate: 0.24 },
        { min: 182051, max: 231250, rate: 0.32 },
        { min: 231251, max: 578125, rate: 0.35 },
        { min: 578126, max: Infinity, rate: 0.37 }
      ],
      selfEmployment: 0.153, // 15.3% for Social Security and Medicare
      standardDeduction: 13850
    },
    corporate: {
      rate: 0.21 // Flat 21% corporate tax
    }
  },
  'UK': {
    income: {
      brackets: [
        { min: 0, max: 12570, rate: 0.00 }, // Personal allowance
        { min: 12571, max: 50270, rate: 0.20 },
        { min: 50271, max: 125140, rate: 0.40 },
        { min: 125141, max: Infinity, rate: 0.45 }
      ],
      selfEmployment: 0.09, // Class 2 and 4 National Insurance
      standardDeduction: 12570
    },
    corporate: {
      rate: 0.19 // 19% corporate tax
    }
  },
  'DE': {
    income: {
      brackets: [
        { min: 0, max: 10347, rate: 0.00 },
        { min: 10348, max: 14793, rate: 0.14 },
        { min: 14794, max: 57918, rate: 0.24 },
        { min: 57919, max: 277825, rate: 0.42 },
        { min: 277826, max: Infinity, rate: 0.45 }
      ],
      selfEmployment: 0.145, // ~14.5% for health insurance and pension
      standardDeduction: 10347
    },
    corporate: {
      rate: 0.15 // 15% corporate tax
    }
  },
  'CA': {
    income: {
      brackets: [
        { min: 0, max: 15505, rate: 0.15 },
        { min: 15506, max: 22215, rate: 0.205 },
        { min: 22216, max: 33122, rate: 0.26 },
        { min: 33123, max: 43680, rate: 0.29 },
        { min: 43681, max: 67408, rate: 0.33 },
        { min: 67409, max: 235675, rate: 0.37 },
        { min: 235676, max: Infinity, rate: 0.45 }
      ],
      selfEmployment: 0.109, // ~10.9% for CPP and Employment Insurance
      standardDeduction: 15505
    },
    corporate: {
      rate: 0.15 // 15% corporate tax
    }
  }
};

interface TaxCalculation {
  totalIncome: number;
  totalExpenses: number;
  taxableIncome: number;
  estimatedTax: number;
  effectiveRate: number;
  afterTaxIncome: number;
  selfEmploymentTax: number;
  totalTax: number;
}

export default function TaxPage() {
  const { payouts: allPayouts, expenses: allExpenses, business } = useBusiness();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');
  const [taxYear, setTaxYear] = useState<string>(new Date().getFullYear().toString());
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(false);

  // Get unique businesses from payouts and expenses
  const businesses = useMemo(() => {
    const businessMap = new Map<string, { name: string; country?: string; businessType?: string }>();
    
    allPayouts.forEach(payout => {
      if (payout.businessId && !businessMap.has(payout.businessId)) {
        businessMap.set(payout.businessId, {
          name: payout.businessName || 'Unknown Business',
          country: payout.businessCountry || payout.country, // Check for businessCountry first
          businessType: payout.businessType
        });
      }
    });
    
    allExpenses.forEach(expense => {
      if (expense.businessId && !businessMap.has(expense.businessId)) {
        businessMap.set(expense.businessId, {
          name: expense.businessName || 'Unknown Business',
          country: expense.businessCountry || expense.country, // Check for businessCountry first
          businessType: expense.businessType
        });
      }
    });
    
    return Array.from(businessMap.entries()).map(([id, info]) => ({ id, ...info }));
  }, [allPayouts, allExpenses]);

  // Filter data based on selected business and year
  const filteredPayouts = useMemo(() => {
    return allPayouts.filter(payout => {
      const matchesBusiness = selectedBusinessId === 'all' || payout.businessId === selectedBusinessId;
      const matchesYear = new Date(payout.date).getFullYear().toString() === taxYear;
      return matchesBusiness && matchesYear;
    });
  }, [allPayouts, selectedBusinessId, taxYear]);

  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(expense => {
      const matchesBusiness = selectedBusinessId === 'all' || expense.businessId === selectedBusinessId;
      const matchesYear = new Date(expense.date).getFullYear().toString() === taxYear;
      return matchesBusiness && matchesYear;
    });
  }, [allExpenses, selectedBusinessId, taxYear]);

  // Calculate taxes
  const taxCalculation = useMemo((): TaxCalculation | null => {
    if (filteredPayouts.length === 0 && filteredExpenses.length === 0) return null;

    const totalIncome = filteredPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const taxableIncome = Math.max(0, totalIncome - totalExpenses);

    // Get business info for tax calculation
    const business = selectedBusinessId === 'all' 
      ? businesses[0] // Use first business for combined view
      : businesses.find(b => b.id === selectedBusinessId);

    if (!business) return null;

    const country = business.country || 'US';
    const taxRates = TAX_RATES[country as keyof typeof TAX_RATES] || TAX_RATES.US;
    const isCorporate = business.businessType === 'corporation' || business.businessType === 'llc';

    let estimatedTax = 0;
    let selfEmploymentTax = 0;

    if (isCorporate) {
      // Corporate tax calculation
      estimatedTax = taxableIncome * taxRates.corporate.rate;
    } else {
      // Individual/Sole proprietor tax calculation
      const incomeTax = calculateIncomeTax(taxableIncome, taxRates.income);
      estimatedTax = incomeTax;
      
      // Add self-employment tax for sole proprietors
      if (business.businessType === 'sole-proprietor' || business.businessType === 'partnership') {
        selfEmploymentTax = taxableIncome * taxRates.income.selfEmployment;
      }
    }

    const totalTax = estimatedTax + selfEmploymentTax;
    const afterTaxIncome = taxableIncome - totalTax;
    const effectiveRate = taxableIncome > 0 ? totalTax / taxableIncome : 0;

    return {
      totalIncome,
      totalExpenses,
      taxableIncome,
      estimatedTax,
      effectiveRate,
      afterTaxIncome,
      selfEmploymentTax,
      totalTax
    };
  }, [filteredPayouts, filteredExpenses, selectedBusinessId, businesses]);

  // Helper function to calculate income tax
  function calculateIncomeTax(income: number, taxConfig: any): number {
    let tax = 0;
    let remainingIncome = Math.max(0, income - taxConfig.standardDeduction);

    for (const bracket of taxConfig.brackets) {
      if (remainingIncome <= 0) break;
      
      const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min + 1);
      tax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }

    return tax;
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Tax Overview" />
      
      {/* Legal Disclaimer Dialog */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Important Disclaimer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-[#666] leading-relaxed">
              <p className="mb-3">
                <strong>This is NOT tax advice.</strong> The tax calculator provided is for informational purposes only and should not be considered as professional tax advice.
              </p>
              <p className="mb-3">
                Tax laws are complex and vary significantly by jurisdiction, individual circumstances, and frequently change. The calculations provided are simplified estimates and may not reflect your actual tax liability.
              </p>
              <p>
                Always consult with a qualified tax professional or accountant for accurate tax advice, planning, and filing requirements specific to your situation.
              </p>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[#111] border border-[#2a2a2a]">
              <Checkbox 
                id="disclaimer" 
                checked={disclaimerAccepted}
                onCheckedChange={(checked) => setDisclaimerAccepted(checked as boolean)}
                className="mt-0.5"
              />
              <div className="text-xs text-[#666]">
                <label htmlFor="disclaimer" className="cursor-pointer">
                  I understand this is not tax advice and will consult a qualified tax professional for my tax planning and filing needs.
                </label>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setShowDisclaimer(false)}
                disabled={!disclaimerAccepted}
                className="bg-white hover:bg-gray-100 text-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                I Understand
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showDisclaimer === false && (
        <div className="space-y-6 pt-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Tax Calculator</h1>
              <p className="text-sm text-[#666] mt-1">Automatic tax calculations based on your financial data</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Year Selector */}
              <Select value={taxYear} onValueChange={setTaxYear}>
                <SelectTrigger className="w-[120px] bg-[#111] border-[#2a2a2a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#2a2a2a]">
                  <SelectItem value="2024" className="text-white hover:bg-white/5">2024</SelectItem>
                  <SelectItem value="2023" className="text-white hover:bg-white/5">2023</SelectItem>
                  <SelectItem value="2022" className="text-white hover:bg-white/5">2022</SelectItem>
                </SelectContent>
              </Select>

              {/* Business Selector */}
              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                <SelectTrigger className="w-[200px] bg-[#111] border-[#2a2a2a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#2a2a2a]">
                  <SelectItem value="all" className="text-white hover:bg-white/5">All Businesses</SelectItem>
                  {businesses.map(business => (
                    <SelectItem key={business.id} value={business.id} className="text-white hover:bg-white/5">
                      {business.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tax Calculation Results */}
          {taxCalculation ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              {/* Total Income Card */}
              <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Total Income</CardTitle>
                  <DollarSign className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{formatCurrency(taxCalculation.totalIncome)}</div>
                  <p className="text-xs text-[#666] mt-1">Gross revenue</p>
                </CardContent>
              </Card>

              {/* Total Expenses Card */}
              <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Total Expenses</CardTitle>
                  <DollarSign className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{formatCurrency(taxCalculation.totalExpenses)}</div>
                  <p className="text-xs text-[#666] mt-1">Business expenses</p>
                </CardContent>
              </Card>

              {/* Estimated Tax Card */}
              <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Estimated Tax</CardTitle>
                  <Calculator className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{formatCurrency(taxCalculation.totalTax)}</div>
                  <p className="text-xs text-[#666] mt-1">{formatPercentage(taxCalculation.effectiveRate)} effective rate</p>
                </CardContent>
              </Card>

              {/* After Tax Income Card */}
              <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">After Tax Income</CardTitle>
                  <FileText className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{formatCurrency(taxCalculation.afterTaxIncome)}</div>
                  <p className="text-xs text-[#666] mt-1">Net income after taxes</p>
                </CardContent>
              </Card>

              {/* Country Card */}
              <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Country</CardTitle>
                  <Globe className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {(() => {
                      // If business has multiple businesses, use the first one's country
                      if (business?.businesses && business?.businesses.length > 0) {
                        return business.businesses[0]?.country || 'US';
                      }
                      // Otherwise use the single business country
                      return business?.country || 'US';
                    })()}
                  </div>
                  <p className="text-xs text-[#666] mt-1">Tax jurisdiction</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-[#666] mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Financial Data Available</h3>
                <p className="text-sm text-[#666] text-center max-w-md">
                  Add some payouts and expenses to see your tax calculations. The tax calculator will automatically estimate your taxes based on your business country and type.
                </p>
              </CardContent>
            </Card>
          )}

        {/* Tax Breakdown Details */}
          {taxCalculation && (
            <Card className="border-[#2a2a2a] bg-[#0a0a0a]">
              <CardHeader>
                <CardTitle className="text-white">Tax Breakdown</CardTitle>
                <CardDescription className="text-[#666]">
                  Detailed calculation for {taxYear} • {selectedBusinessId === 'all' ? 'All Businesses' : businesses.find(b => b.id === selectedBusinessId)?.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Income Calculation */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">Income Calculation</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#666]">Total Income:</span>
                      <span className="text-white">{formatCurrency(taxCalculation.totalIncome)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#666]">Total Expenses:</span>
                      <span className="text-white">-{formatCurrency(taxCalculation.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium pt-2 border-t border-[#2a2a2a]">
                      <span className="text-white">Taxable Income:</span>
                      <span className="text-white">{formatCurrency(taxCalculation.taxableIncome)}</span>
                    </div>
                  </div>
                </div>

                {/* Tax Calculation */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">Tax Calculation</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#666]">Income Tax:</span>
                      <span className="text-white">{formatCurrency(taxCalculation.estimatedTax)}</span>
                    </div>
                    {taxCalculation.selfEmploymentTax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#666]">Self-Employment Tax:</span>
                        <span className="text-white">{formatCurrency(taxCalculation.selfEmploymentTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-medium pt-2 border-t border-[#2a2a2a]">
                      <span className="text-white">Total Tax:</span>
                      <span className="text-white">{formatCurrency(taxCalculation.totalTax)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-white">After Tax Income:</span>
                      <span className="text-green-500">{formatCurrency(taxCalculation.afterTaxIncome)}</span>
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-[#111] border border-[#2a2a2a]">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-[#666]">
                    <p className="font-medium text-white mb-1">Tax Disclaimer</p>
                    <p>This is a simplified tax estimation for informational purposes only. Tax laws are complex and vary by jurisdiction. Please consult with a qualified tax professional for accurate tax advice and filing.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
