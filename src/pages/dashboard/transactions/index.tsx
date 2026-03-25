import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Landmark, ArrowBigUp, ArrowBigDown, RefreshCw, Wallet } from 'lucide-react';
import { auth } from '@/config/firebase';
import { useAuth } from '@/context/FAuth';

interface Transaction {
  transaction_id: string;
  account_id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category: string[];
  pending: boolean;
  payment_channel: string;
  iso_currency_code: string;
}

interface Account {
  account_id: string;
  name: string;
  official_name: string;
  type: string;
  subtype: string;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string;
  };
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

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

  // Load transactions from Firestore
  const loadTransactions = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/plaid/get-transactions', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        setTransactions(data.transactions || []);
        setAccounts(data.accounts || []);
        setLastFetched(data.last_fetched);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh transactions from Plaid
  const refreshTransactions = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    setRefreshing(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/plaid/fetch-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setAccounts(data.accounts || []);
        setLastFetched(new Date().toISOString());
      }
    } catch (err) {
      console.error('Error refreshing transactions:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadTransactions();
    }
  }, [currentUser?.uid]);

  // Format currency
  const formatAmount = (amount: number) => {
    const isNegative = amount < 0;
    const formatted = Math.abs(amount).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    return { formatted, isNegative };
  };

  // Loading state
  if (loading) {
    return (
      <PageContainer scrollable>
        <PageHead title="PROPMAP - Transactions" />
        <div className="flex flex-col items-center justify-center pt-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      </PageContainer>
    );
  }

  // Not connected state
  if (!connected || transactions.length === 0) {
    return (
      <PageContainer scrollable>
        <PageHead title="PROPMAP - Transactions" />
        <div className="flex flex-col items-center justify-center pt-40 text-center">
          <Landmark className="h-12 w-12 text-[#333] mb-4" />
          <p className="text-sm text-[#666] max-w-md mb-6">
            {connected
              ? 'Your bank is connected but no transactions have been imported yet. Try refreshing.'
              : 'Connect your bank account to see your transaction history and get automated transaction updates in real time'}
          </p>
          {connected ? (
            <Button
              onClick={refreshTransactions}
              disabled={refreshing}
              style={{
                background: '#fff',
                color: '#000',
                fontSize: 13,
                fontWeight: 500,
                padding: '5px 14px',
                borderRadius: 6,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              {refreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Transactions
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/dashboard/BankConnection')}
              style={{
                background: '#fff',
                color: '#000',
                fontSize: 13,
                fontWeight: 500,
                padding: '5px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Connect Bank Account
            </Button>
          )}
        </div>
      </PageContainer>
    );
  }

  // Connected state with transactions
  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Transactions" />
      <div className="max-w-4xl mx-auto pt-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-xl font-semibold">Transactions</h1>
            <p className="text-[#666] text-xs mt-1">
              {transactions.length} transactions
              {lastFetched && ` · Last updated ${new Date(lastFetched).toLocaleString()}`}
            </p>
          </div>
          <Button
            onClick={refreshTransactions}
            disabled={refreshing}
            style={{
              background: '#1a1a1a',
              color: '#999',
              fontSize: 12,
              fontWeight: 500,
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid #333',
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw className={`w-3 h-3 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>

        {/* Account Balances */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {accounts.map((account) => (
              <Card key={account.account_id} className="border-[#1a1a1a] bg-[#111]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-[#555]" />
                    <span className="text-[#888] text-xs uppercase tracking-wide">{account.subtype || account.type}</span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{account.name}</p>
                  {account.balances.current !== null && (
                    <p className="text-white text-lg font-semibold mt-1">
                      {account.balances.current.toLocaleString('en-US', { style: 'currency', currency: account.balances.iso_currency_code || 'USD' })}
                    </p>
                  )}
                  {account.balances.available !== null && account.balances.available !== account.balances.current && (
                    <p className="text-[#666] text-xs mt-0.5">
                      Available: {account.balances.available.toLocaleString('en-US', { style: 'currency', currency: account.balances.iso_currency_code || 'USD' })}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Transaction List */}
        <div className="space-y-1">
          {transactions.map((tx) => {
            const { formatted, isNegative } = formatAmount(tx.amount);
            return (
              <div
                key={tx.transaction_id}
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-[#111] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {isNegative ? (
                      <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-[#6B8E7A]/50">
                        <ArrowBigUp className="w-5 h-5 text-[#6B8E7A]" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-transparent border border-white/20 shadow-lg shadow-[#8e6b6bff]/50">
                        <ArrowBigDown className="w-5 h-5 text-[#8e6b6bff]" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {tx.merchant_name || tx.name}
                    </p>
                    <p className="text-[#555] text-xs">
                      {tx.date}
                      {tx.category?.[0] && ` · ${tx.category[0]}`}
                      {tx.pending && ' · Pending'}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-medium flex-shrink-0 ml-4 ${
                  isNegative ? 'text-[#6B8E7A]' : 'text-[#8e6b6bff]'
                }`}>
                  {isNegative ? '+' : '-'}{formatted}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
