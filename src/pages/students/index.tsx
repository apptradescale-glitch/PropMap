import PageHead from '@/components/shared/page-head';
import { useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFinanceStore } from '@/components/shared/datastore';
import { useAuth } from '@/context/FAuth';

interface Finance {
  id: string;
  userId: string;
  type: 'earning' | 'expense';
  firm?: string;
  description?: string;
  amount: number;
  date: string;
}

// Fetch finances from Firestore
async function getAllFinancesFromFirestore(userId: string, token: string) {
  const response = await fetch(`/api/firestore-get-finances?userId=${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const result = await response.json();
  return result.finances || [];
}

export default function StudentPage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || 1);
  const pageLimit = Number(searchParams.get('limit') || 10);
  const country = searchParams.get('search') || null;
  const offset = (page - 1) * pageLimit;

  const finances = useFinanceStore(state => state.finances);
  const addFinance = useFinanceStore(state => state.addFinance);
  const removeFinance = useFinanceStore(state => state.removeFinance);

  // Filter finances by current user first
  const userFinances = finances.filter(f => f.userId === currentUser?.uid);

  // Then filter by type
  const earningRows = userFinances.filter(f => f.type === 'earning');
  const expenseRows = userFinances.filter(f => f.type === 'expense');

  const totalRows = Math.max(
    earningRows.length, 
    expenseRows.length, 
    20,
    Math.max(earningRows.length, expenseRows.length) + 1
  );

  // --- Load finances from Firestore on mount ---
  React.useEffect(() => {
    const loadInitialData = async () => {
      if (!currentUser) return;

      try {
        const token = await currentUser.getIdToken();
        const finances = await getAllFinancesFromFirestore(currentUser.uid, token);
        useFinanceStore.setState({ finances });
       
      } catch (error) {
     
      }
    };

    loadInitialData();
  }, [currentUser]);

  const formatCurrency = (value: number) => {
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absValue);

    return isNegative ? `-${formatted}` : formatted;
  };

  const handleFinanceChange = (
    id: string,
    field: keyof Finance,
    value: string
  ) => {
    if (!currentUser) return;

    const existingFinance = finances.find(f => f.id === id);

    if (existingFinance) {
      addFinance({
        ...existingFinance,
        [field]: field === 'amount' ? Number(value.replace(/[^0-9.-]/g, '')) : value,
        userId: currentUser.uid
      });
    } else {
      addFinance({
        type: field === 'firm' ? 'earning' : 'expense',
        [field]: field === 'amount' ? Number(value.replace(/[^0-9.-]/g, '')) : value,
        amount: field === 'amount' ? Number(value.replace(/[^0-9.-]/g, '')) : 0,
        firm: field === 'firm' ? value : undefined,
        description: field === 'description' ? value : undefined,
        date: new Date().toISOString().split('T')[0],
        userId: currentUser.uid
      });
    }
  };

  const handleFinanceDelete = (id: string) => {
    if (!currentUser) return;

    const finance = finances.find(f => f.id === id);
    if (finance?.userId !== currentUser.uid) return;

    // Optimistically update UI
    useFinanceStore.setState(state => ({
      finances: state.finances.filter(f => f.id !== id)
    }));

    // Then call the API (no await)
    removeFinance(id).catch(() => {
      // Optionally: revert the change or show an error if the API fails
      // (You could reload finances from Firestore here)
    });
  };

  const maxRows = Math.max(9, earningRows.length, expenseRows.length);

  // Payout state
  const [broker, setBroker] = React.useState("");
  const [payoutAmount, setPayoutAmount] = React.useState("");
  const [payoutDate, setPayoutDate] = React.useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Expense state
  const [expenseDesc, setExpenseDesc] = React.useState("");
  const [expenseAmount, setExpenseAmount] = React.useState("");
  const [expenseDate, setExpenseDate] = React.useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const handleCalendarClick = (inputId: string) => {
    const input = document.getElementById(inputId);
    if (input) {
      // @ts-ignore
      input.showPicker && input.showPicker();
    }
  };

  async function addFinanceToFirestore(userId: string, finance: Omit<Finance, 'id'> & { id?: string }) {
    const financeWithId: Finance = { ...finance, id: finance.id || crypto.randomUUID(), userId };
    const token = await currentUser!.getIdToken();
    const response = await fetch('/api/firestore-add-finance', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId, finance: financeWithId }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to add finance');
    return result.finance;
  }

  const handlePayoutSubmit = () => {
    if (!currentUser) return;
    if (!broker || !payoutAmount || !payoutDate) return;

    const amount = Number(payoutAmount);

    const optimisticFinance = {
      id: crypto.randomUUID(),
      type: 'earning' as const,
      firm: broker,
      amount: amount,
      userId: currentUser.uid,
      date: payoutDate,
    };

    useFinanceStore.setState(state => ({
      finances: [...state.finances, optimisticFinance]
    }));

    setBroker("");
    setPayoutAmount("");
    setPayoutDate(() => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });

    addFinanceToFirestore(currentUser.uid, optimisticFinance)
      .then(() => {})
      .catch(() => {});
  };

  const handleExpenseSubmit = () => {
    if (!currentUser) return;
    if (!expenseDesc || !expenseAmount || !expenseDate) return;

    const negativeAmount = -Number(expenseAmount);

    const optimisticFinance = {
      id: crypto.randomUUID(),
      type: 'expense' as const,
      description: expenseDesc,
      amount: negativeAmount,
      userId: currentUser.uid,
      date: expenseDate,
    };

    useFinanceStore.setState(state => ({
      finances: [...state.finances, optimisticFinance]
    }));

    setExpenseDesc("");
    setExpenseAmount("");
    setExpenseDate(() => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });

    addFinanceToFirestore(currentUser.uid, optimisticFinance)
      .then(() => {})
      .catch(() => {});
  };

  return (
    <div className="p-4 md:p-8">
      <PageHead title="Tradescale" />
      {!currentUser ? (
        <div className="text-center text-muted-foreground py-8">
          Please sign in to view your finances
        </div>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { title: 'Dashboard', link: '/' },
              { title: 'Operational', link: '/operational' }
            ]}
          />
          <div className="mt-6 grid grid-cols-2 gap-6">
            {/* Earnings Card */}
            <Card className="h-[880px]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Earnings</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Trading Income
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
                    >
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add Payouts / Withdrawals</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="broker">Firm / Broker</Label>
                        <Input
                          id="broker"
                          value={broker}
                          onChange={(e) => setBroker(e.target.value)}
                          className="border-white/15"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="payoutAmount">$ Amount</Label>
                        <Input
                          id="payoutAmount"
                          type="number"
                          value={payoutAmount}
                          onChange={(e) => setPayoutAmount(e.target.value)}
                          className="border-white/15"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="payoutDate">Date</Label>
                        <div className="relative">
                          <Input
                            id="payoutDate"
                            type="date"
                            value={payoutDate}
                            onChange={e => setPayoutDate(e.target.value)}
                            className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 pl-10"
                          />
                          <button
                            type="button"
                            onClick={() => handleCalendarClick('payoutDate')}
                            className="absolute left-2 top-1.5 p-1 hover:text-[#94bba3]"
                            tabIndex={-1}
                          >
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-center">
                      <Button
                        onClick={handlePayoutSubmit}
                        className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
                      >
                        Submit
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[770px] w-full rounded-md">
                  {/* Header row */}
                  <div className="flex font-semibold text-xs text-muted-foreground px-4 pb-2">
                    <div className="w-full">
                      <div className="flex border border-white/20 rounded-lg bg-transparent px-4 py-2"
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)"
                        }}
                      >
                        <div className="flex-1">Description</div>
                        <div className="w-28 text-right mr-0">$Amount</div>
                        <div className="w-32 text-right mr-10">Date</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 px-2">
                    {earningRows.map((earning) => (
                      <div
                        key={earning.id}
                        className="group relative transition-all duration-200 bg-card rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(16,185,129,0.3)]"
                      >
                        <div className="flex items-center p-3">
                          <div className="flex-1 truncate font-medium">{earning.firm}</div>
                          <div className="w-28 text-right text-emerald-500 font-semibold">
                            {formatCurrency(earning.amount)}
                          </div>
                          <div className="w-32 text-right text-sm text-muted-foreground">
                            {new Date(earning.date + "T00:00:00").toLocaleDateString()}
                          </div>
                          <button
                            onClick={() => handleFinanceDelete(earning.id)}
                            className="ml-2 text-red-500 hover:text-red-600 transition-transform opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-4 w-4 transform hover:scale-150" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Repeat the same for Expenses, just swap the values as needed */}
            <Card className="h-[880px]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Expenses</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Trading Costs
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
                    >
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add Business Expense</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="expenseDesc">Description</Label>
                        <Input
                          id="expenseDesc"
                          value={expenseDesc}
                          onChange={(e) => setExpenseDesc(e.target.value)}
                          className="border-white/15"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="expenseAmount">$ Amount</Label>
                        <Input
                          id="expenseAmount"
                          type="number"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          className="border-white/15"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="expenseDate">Date</Label>
                        <div className="relative">
                          <Input
                            id="expenseDate"
                            type="date"
                            value={expenseDate}
                            onChange={e => setExpenseDate(e.target.value)}
                            className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0 pl-10"
                          />
                          <button
                            type="button"
                            onClick={() => handleCalendarClick('expenseDate')}
                            className="absolute left-2 top-1.5 p-1 hover:text-[#94bba3]"
                            tabIndex={-1}
                          >
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-center">
                      <Button
                        onClick={handleExpenseSubmit}
                        className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
                      >
                        Submit
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[770px] w-full rounded-md">
                  {/* Header row */}
                  <div className="flex font-semibold text-xs text-muted-foreground px-4 pb-2">
                    <div className="w-full">
                      <div className="flex border border-white/20 rounded-lg bg-transparent px-4 py-2"
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)"
                        }}
                      >
                        <div className="flex-1">Description</div>
                        <div className="w-28 text-right mr-0">$Amount</div>
                        <div className="w-32 text-right mr-10">Date</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 px-2">
                    {expenseRows.map((expense) => (
                      <div
                        key={expense.id}
                        className="group relative transition-all duration-200 bg-card rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.0),inset_0_0_12px_0px_rgba(239,68,68,0.3)]"
                      >
                        <div className="flex items-center p-3">
                          <div className="flex-1 truncate font-medium">{expense.description}</div>
                          <div className="w-28 text-right text-red-500 font-semibold">
                            {formatCurrency(expense.amount)}
                          </div>
                          <div className="w-32 text-right text-sm text-muted-foreground">
                            {new Date(expense.date + "T00:00:00").toLocaleDateString()}
                          </div>
                          <button
                            onClick={() => handleFinanceDelete(expense.id)}
                            className="ml-2 text-red-500 hover:text-red-600 transition-transform opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-4 w-4 transform hover:scale-150" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}