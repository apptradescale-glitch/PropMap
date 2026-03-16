import { useEffect, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

const revenueData = [
  { date: 'Jan 1', value1: 120, value2: 100 },
  { date: 'Jan 4', value1: 150, value2: 130 },
  { date: 'Jan 7', value1: 200, value2: 180 },
  { date: 'Jan 9', value1: 280, value2: 210 },
  { date: 'Jan 11', value1: 350, value2: 250 },
  { date: 'Jan 13', value1: 250, value2: 300 },
  { date: 'Jan 15', value1: 300, value2: 280 },
  { date: 'Jan 17', value1: 420, value2: 350 },
  { date: 'Jan 19', value1: 380, value2: 320 },
  { date: 'Jan 21', value1: 320, value2: 290 },
  { date: 'Jan 23', value1: 450, value2: 400 },
  { date: 'Jan 25', value1: 500, value2: 420 },
  { date: 'Jan 27', value1: 480, value2: 450 },
  { date: 'Jan 30', value1: 520, value2: 470 },
];

const subscriptionData = [
  { date: 'Aug 1', value: 180 },
  { date: 'Aug 3', value: 220 },
  { date: 'Aug 5', value: 150 },
  { date: 'Aug 7', value: 280 },
  { date: 'Aug 9', value: 350 },
  { date: 'Aug 11', value: 320 },
  { date: 'Aug 13', value: 400 },
  { date: 'Aug 15', value: 280 },
  { date: 'Aug 17', value: 450 },
  { date: 'Aug 19', value: 380 },
  { date: 'Aug 21', value: 500 },
  { date: 'Aug 23', value: 420 },
  { date: 'Aug 25', value: 350 },
  { date: 'Aug 27', value: 300 },
  { date: 'Aug 29', value: 480 },
];

const cohortData = [
  { cohort: 1, values: [248, 200, 140, 108, 94, 78, 72, null, null, null] },
  { cohort: 2, values: [112, 104, 58, 36, 21, null, null, null, null, null] },
  { cohort: 3, values: [168, 124, 94, 76, 42, 28, 22, null, null, null] },
];

export default function TaxPage() {
  const [timeRange] = useState<'30d' | 'daily'>('30d');

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

  const getCellColor = (value: number | null) => {
    if (value === null) return 'bg-[#1a1a1a]';
    if (value >= 200) return 'bg-[#4a3a2a]';
    if (value >= 100) return 'bg-[#3a3a2a]';
    if (value >= 50) return 'bg-[#2a2a2a]';
    return 'bg-[#1f1f1f]';
  };

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Tax Overview" />
      <div className="space-y-4 pt-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">Main KPIs</span>
            <span className="text-[#666] text-sm">···</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#666]">Last</span>
              <span className={`px-2 py-0.5 rounded text-xs ${timeRange === '30d' ? 'bg-[#2a2a2a] text-white' : 'text-[#666]'}`}>30d</span>
              <span className={`px-2 py-0.5 rounded text-xs ${timeRange === 'daily' ? 'bg-[#2a2a2a] text-white' : 'text-[#666]'}`}>Daily</span>
            </div>
            <span className="text-[#666] text-sm">Share</span>
          </div>
        </div>

        {/* Main KPIs Title */}
        <h1 className="text-2xl font-bold text-white">Main KPIs</h1>

        {/* Revenue + New Subscriptions row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Revenue Card - takes 3 cols */}
          <Card className="md:col-span-3 border-[#2a2a2a] bg-[#111111]">
            <CardContent className="p-4">
              <p className="text-xs text-[#999] mb-1">Revenue</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-white">$19.3K</span>
                <span className="text-xs text-green-500">+15%</span>
                <span className="text-xs text-[#666]">($17,840)</span>
              </div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#222" strokeDasharray="none" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#666' }}
                      axisLine={{ stroke: '#333' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#666' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[100, 500]}
                      ticks={[100, 200, 300, 400, 500]}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#999' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="value1" stroke="#ffffff" strokeWidth={1.5} fill="url(#revenueGrad1)" />
                    <Area type="monotone" dataKey="value2" stroke="#666666" strokeWidth={1} fill="none" strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-[#666]">Jan 1, 2024</span>
                <span className="text-[10px] text-[#666]">Jan 18, 2024</span>
              </div>
            </CardContent>
          </Card>

          {/* New Subscriptions Card - takes 2 cols */}
          <Card className="md:col-span-2 border-[#2a2a2a] bg-[#111111]">
            <CardContent className="p-4">
              <p className="text-xs text-[#999] mb-1">New Subscriptions</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-white">1.2K</span>
                <span className="text-xs text-green-500">+183%</span>
                <span className="text-xs text-[#666]">(676)</span>
              </div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subscriptionData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#222" strokeDasharray="none" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#666' }}
                      axisLine={{ stroke: '#333' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#666' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[100, 500]}
                      ticks={[100, 200, 300, 400, 500]}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                      labelStyle={{ color: '#999' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" fill="#ffffff" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-[#666]">Aug 1, 2024</span>
                <span className="text-[10px] text-[#666]">Aug 29, 2024</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CAC, Burnrate, Cohort retention row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* CAC */}
          <Card className="border-[#2a2a2a] bg-[#111111]">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <p className="text-xs text-[#999] mb-2">CAC</p>
              <span className="text-3xl font-bold text-white">$384</span>
            </CardContent>
          </Card>

          {/* Burnrate */}
          <Card className="border-[#2a2a2a] bg-[#111111]">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <p className="text-xs text-[#999] mb-2">Burnrate</p>
              <span className="text-3xl font-bold text-white">$32.5K</span>
            </CardContent>
          </Card>

          {/* Cohort retention - takes 3 cols */}
          <Card className="md:col-span-3 border-[#2a2a2a] bg-[#111111]">
            <CardContent className="p-4">
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-xs text-[#999]">Cohort retention</p>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold text-white">480</span>
                <span className="text-xs text-green-500">+6%</span>
                <span className="text-xs text-[#666]">(523)</span>
              </div>

              {/* Week label */}
              <p className="text-[10px] text-[#999] mb-2 ml-12">Week</p>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-[#999] font-normal pb-2 pr-2 w-12">Cohort</th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <th key={n} className="text-center text-[#999] font-normal pb-2 w-12">{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohortData.map((row) => (
                      <tr key={row.cohort}>
                        <td className="text-[#999] py-1 pr-2">{row.cohort}</td>
                        {row.values.map((val, i) => (
                          <td key={i} className={`text-center py-1 ${getCellColor(val)}`}>
                            <span className={val !== null ? 'text-white text-xs' : ''}>
                              {val !== null ? val : ''}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Runway + LTV row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-[#2a2a2a] bg-[#111111]">
            <CardContent className="p-4 flex items-center h-full">
              <span className="text-sm text-[#999]">Runway in years</span>
            </CardContent>
          </Card>
          <Card className="border-[#2a2a2a] bg-[#111111]">
            <CardContent className="p-4 flex items-center h-full">
              <span className="text-sm text-[#999]">LTV in years</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
