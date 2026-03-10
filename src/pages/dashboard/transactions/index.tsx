import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Button } from '@/components/ui/button';
import { Landmark } from 'lucide-react';

export default function TransactionsPage() {
  const navigate = useNavigate();

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

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Transactions" />
      <div className="flex flex-col items-center justify-center pt-40 text-center">
        <Landmark className="h-12 w-12 text-[#333] mb-4" />
        <p className="text-sm text-[#666] max-w-md mb-6">
          Connect your bank account to see your transaction history and get automated transaction updates in real time
        </p>
        <Button
          onClick={() => navigate('/dashboard/BankConnection')}
          className="bg-[#e0ac69] hover:bg-[#c9964f] text-black font-medium"
        >
          Connect Bank Account
        </Button>
      </div>
    </PageContainer>
  );
}
