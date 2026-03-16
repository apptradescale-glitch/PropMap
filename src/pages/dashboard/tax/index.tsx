import { useEffect, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import PageHead from '@/components/shared/page-head';
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
  { date: '', value1: 120, value2: 100 },
  { date: '', value1: 150, value2: 130 },
  { date: '', value1: 200, value2: 180 },
  { date: '', value1: 280, value2: 210 },
  { date: '', value1: 350, value2: 250 },
  { date: '', value1: 250, value2: 300 },
  { date: '', value1: 300, value2: 280 },
  { date: '', value1: 420, value2: 350 },
  { date: '', value1: 380, value2: 320 },
  { date: '', value1: 320, value2: 290 },
  { date: '', value1: 450, value2: 400 },
  { date: '', value1: 500, value2: 420 },
  { date: '', value1: 480, value2: 450 },
  { date: '', value1: 520, value2: 470 },
];

const subscriptionData = [
  { date: '', value: 180 },
  { date: '', value: 220 },
  { date: '', value: 150 },
  { date: '', value: 280 },
  { date: '', value: 350 },
  { date: '', value: 320 },
  { date: '', value: 400 },
  { date: '', value: 280 },
  { date: '', value: 450 },
  { date: '', value: 380 },
  { date: '', value: 500 },
  { date: '', value: 420 },
  { date: '', value: 350 },
  { date: '', value: 300 },
  { date: '', value: 480 },
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
    document.body.style.backgroundColor = '#0d0d0d';
    document.body.style.margin = '0';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
    };
  }, []);

  const getCellBg = (value: number | null) => {
    if (value === null) return '#161616';
    if (value >= 200) return '#3d3424';
    if (value >= 100) return '#2e2a1f';
    if (value >= 50) return '#23211b';
    if (value >= 20) return '#1d1c18';
    return '#191919';
  };

  return (
    <PageContainer scrollable>
      <PageHead title="PROPMAP - Tax Overview" />
      <div style={{ fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', 'Courier New', monospace" }} className="pt-6">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-8 px-1">
          <div className="flex items-center gap-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="0.5" y="0.5" width="5" height="5" rx="0.5" stroke="#777" strokeWidth="1"/><rect x="8" y="0.5" width="5" height="5" rx="0.5" stroke="#777" strokeWidth="1"/><rect x="0.5" y="8" width="5" height="5" rx="0.5" stroke="#777" strokeWidth="1"/><rect x="8" y="8" width="5" height="5" rx="0.5" stroke="#777" strokeWidth="1"/></svg>
            <span style={{ color: '#ccc', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>Main KPIs</span>
            <span style={{ color: '#555', fontSize: 13, letterSpacing: '0.15em' }}>···</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1" style={{ fontSize: 12 }}>
              <span style={{ color: '#666' }}>Last</span>
              <span style={{
                color: timeRange === '30d' ? '#fff' : '#666',
                fontWeight: timeRange === '30d' ? 700 : 400,
                fontSize: 12,
                marginLeft: 6
              }}>30d</span>
              <span style={{
                color: timeRange === 'daily' ? '#fff' : '#666',
                fontWeight: timeRange === 'daily' ? 700 : 400,
                fontSize: 12,
                marginLeft: 6
              }}>Daily</span>
            </div>
            <span style={{ color: '#666', fontSize: 12 }}>Share</span>
          </div>
        </div>

        {/* Main KPIs Title */}
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 24, fontFamily: 'inherit' }}>Main KPIs</h1>

        {/* Revenue + New Subscriptions row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          {/* Revenue Card */}
          <div className="md:col-span-3 rounded-lg" style={{ background: '#141414', border: '1px solid #1e1e1e', padding: '20px 20px 14px' }}>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 6, letterSpacing: '0.01em' }}>Revenue</p>
            <div className="flex items-baseline gap-2" style={{ marginBottom: 16 }}>
              <span style={{ color: '#fff', fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'inherit' }}>$19.3K</span>
              <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 500 }}>+15%</span>
              <span style={{ color: '#555', fontSize: 11 }}>($17,840)</span>
            </div>
            <div style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.06} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e1e1e" vertical={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#555', fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                    domain={[100, 500]}
                    ticks={[100, 200, 300, 400, 500]}
                    width={35}
                  />
                  <XAxis dataKey="date" hide />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, fontFamily: 'monospace', fontSize: 11 }}
                    labelStyle={{ color: '#888' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="value1" stroke="#d4d4d4" strokeWidth={1.2} fill="url(#revGrad)" dot={false} />
                  <Area type="monotone" dataKey="value2" stroke="#555" strokeWidth={0.8} fill="none" strokeDasharray="3 3" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between" style={{ marginTop: 8 }}>
              <span style={{ color: '#555', fontSize: 10, fontFamily: 'monospace' }}>Jan 1, 2024</span>
              <span style={{ color: '#555', fontSize: 10, fontFamily: 'monospace' }}>Jan 30, 2024</span>
            </div>
          </div>

          {/* New Subscriptions Card */}
          <div className="md:col-span-2 rounded-lg" style={{ background: '#141414', border: '1px solid #1e1e1e', padding: '20px 20px 14px' }}>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 6, letterSpacing: '0.01em' }}>New Subscriptions</p>
            <div className="flex items-baseline gap-2" style={{ marginBottom: 16 }}>
              <span style={{ color: '#fff', fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'inherit' }}>1.2K</span>
              <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 500 }}>+183%</span>
              <span style={{ color: '#555', fontSize: 11 }}>(678)</span>
            </div>
            <div style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subscriptionData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke="#1e1e1e" vertical={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#555', fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                    domain={[100, 500]}
                    ticks={[100, 200, 300, 400, 500]}
                    width={35}
                  />
                  <XAxis dataKey="date" hide />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, fontFamily: 'monospace', fontSize: 11 }}
                    labelStyle={{ color: '#888' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#d4d4d4" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between" style={{ marginTop: 8 }}>
              <span style={{ color: '#555', fontSize: 10, fontFamily: 'monospace' }}>Aug 1, 2024</span>
              <span style={{ color: '#555', fontSize: 10, fontFamily: 'monospace' }}>Aug 29, 2024</span>
            </div>
          </div>
        </div>

        {/* CAC, Burnrate, Cohort retention row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          {/* CAC */}
          <div className="rounded-lg flex flex-col justify-center" style={{ background: '#141414', border: '1px solid #1e1e1e', padding: '20px 20px' }}>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 10 }}>CAC</p>
            <span style={{ color: '#fff', fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'inherit' }}>$384</span>
          </div>

          {/* Burnrate */}
          <div className="rounded-lg flex flex-col justify-center" style={{ background: '#141414', border: '1px solid #1e1e1e', padding: '20px 20px' }}>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 10 }}>Burnrate</p>
            <span style={{ color: '#fff', fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'inherit' }}>$32.5K</span>
          </div>

          {/* Cohort retention */}
          <div className="md:col-span-3 rounded-lg" style={{ background: '#141414', border: '1px solid #1e1e1e', padding: '20px 20px 16px' }}>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Cohort retention</p>
            <div className="flex items-baseline gap-2" style={{ marginBottom: 12 }}>
              <span style={{ color: '#fff', fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'inherit' }}>480</span>
              <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 500 }}>+6%</span>
              <span style={{ color: '#555', fontSize: 11 }}>(523)</span>
            </div>

            <p style={{ color: '#888', fontSize: 9, marginBottom: 6, paddingLeft: 36, letterSpacing: '0.05em' }}>Week</p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '2px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: '#666', fontSize: 10, fontWeight: 400, paddingBottom: 4, width: 50 }}>Cohort</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <th key={n} style={{ textAlign: 'center', color: '#666', fontSize: 10, fontWeight: 400, paddingBottom: 4, width: 46 }}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortData.map((row) => (
                    <tr key={row.cohort}>
                      <td style={{ color: '#666', fontSize: 10, paddingTop: 2, paddingBottom: 2 }}>{row.cohort}</td>
                      {row.values.map((val, i) => (
                        <td
                          key={i}
                          style={{
                            textAlign: 'center',
                            fontSize: 10,
                            color: val !== null ? '#ddd' : 'transparent',
                            background: getCellBg(val),
                            paddingTop: 5,
                            paddingBottom: 5,
                            borderRadius: 2,
                          }}
                        >
                          {val !== null ? val : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Runway + LTV row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="rounded-lg flex items-center" style={{ background: '#141414', border: '1px solid #1e1e1e', padding: '16px 20px' }}>
            <span style={{ color: '#888', fontSize: 12 }}>Runway in years</span>
          </div>
          <div className="rounded-lg flex items-center" style={{ background: '#141414', border: '1px solid #1e1e1e', padding: '16px 20px' }}>
            <span style={{ color: '#888', fontSize: 12 }}>LTV in years</span>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
