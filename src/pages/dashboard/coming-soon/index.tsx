import { useLocation } from 'react-router-dom';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function ComingSoonPage() {
  const location = useLocation();
  // Derive page title from URL path
  const segment = location.pathname.split('/').pop() || '';
  const title = segment
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s/, '')
    .trim() || 'Page';

  return (
    <PageContainer scrollable>
      <PageHead title={`PROPMAP - ${title}`} />
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-[#2a2a2a] bg-[#0a0a0a] w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-10 pb-10">
            <Construction className="h-12 w-12 text-[#e0ac69]" />
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="text-[#666] text-center text-sm">
              This feature is coming soon. Stay tuned!
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
