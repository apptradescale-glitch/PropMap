import { useEffect } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';

export default function TransactionsPage() {
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
    </PageContainer>
  );
}
