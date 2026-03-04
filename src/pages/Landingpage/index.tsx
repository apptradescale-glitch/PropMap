import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/FAuth';
import { Helmet } from 'react-helmet-async';
import Logo from '@/assets/images/lg34.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#000000';
    document.body.style.margin = '0';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Tradescale</title>
        <meta name='description' content='Advanced trading Journal completely for free & other features available for professional traders.' />
        <meta name='robots' content='index, follow' />
        <meta name='author' content='Tradescale Group' />
      </Helmet>

      <style>{`
        @keyframes subtleFloat {
          0%, 100% { opacity: 0.35; transform: scale(1) translateY(0); }
          50% { opacity: 0.55; transform: scale(1.08) translateY(-8px); }
        }
        .nav-link {
          background: none; border: none; color: #888; font-size: 14px;
          cursor: pointer; padding: 0; transition: color 0.2s;
        }
        .nav-link:hover { color: #fff; }
        .cta-primary {
          background: #fff; color: #000; border: 1px solid #333;
          padding: 8px 20px; border-radius: 7px; font-size: 14px;
          font-weight: 500; cursor: pointer; transition: background 0.15s;
        }
        .cta-primary:hover { background: #e0e0e0; }
        .cta-secondary {
          background: transparent; color: #fff; border: 1px solid #333;
          padding: 8px 20px; border-radius: 7px; font-size: 14px;
          font-weight: 500; cursor: pointer; transition: border-color 0.15s;
        }
        .cta-secondary:hover { border-color: #666; }
        .feature-card {
          background: #0a0a0a; padding: 32px 28px;
          transition: background 0.2s;
        }
        .feature-card:hover { background: #111; }
      `}</style>

      <div ref={topRef} style={{
        minHeight: '100vh', backgroundColor: '#000', color: '#ededed',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}>

        {/* ─── NAVBAR ─── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}>
          <div style={{
            maxWidth: 1100, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', height: 48,
          }}>
            {/* Left: logo + company name + nav links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
                <img src={Logo} alt='Tradescale' style={{ height: 22, width: 26 }} />
                <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.03em', color: '#ededed' }}>
                  Tradescale
                </span>
              </div>
              <div style={{ display: 'flex', gap: 20 }} className='hidden md:flex'>
                {['Home', 'Plans', 'Insights', 'Contact'].map(item => (
                  <button key={item} className='nav-link'>{item}</button>
                ))}
              </div>
            </div>

            {/* Right: auth actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => navigate('/auth/signup')}
                className='nav-link'
              >
                Sign up
              </button>
              <button
                onClick={() => navigate('/auth/signin')}
                style={{
                  background: '#ededed', color: '#000', border: 'none',
                  padding: '5px 14px', borderRadius: 5, fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#ccc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ededed'; }}
              >
                Sign in
              </button>
            </div>
          </div>
        </nav>

        {/* ─── HERO SECTION ─── */}
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Subtle ambient glow behind heading */}
          <div style={{
            position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
            width: 600, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 65%)',
            pointerEvents: 'none',
            animation: 'subtleFloat 10s ease-in-out infinite',
          }} />

          <div style={{
            maxWidth: 720, margin: '0 auto', textAlign: 'center',
            padding: '100px 24px 48px',
            position: 'relative', zIndex: 1,
          }}>
            {/* Main heading — large, bold, tight letter-spacing */}
            <h1 style={{
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 1.08,
              margin: '0 0 20px',
              color: '#fff',
            }}>
              The Trading Platform<br />for Professionals
            </h1>

            {/* Subtitle — smaller, gray, with bold+underline highlight */}
            <p style={{
              fontSize: 16, lineHeight: 1.65,
              color: '#888',
              maxWidth: 540, margin: '0 auto 36px',
              fontWeight: 400,
            }}>
              Used by traders worldwide, Tradescale enables you to create{' '}
              <strong style={{
                color: '#fff', fontWeight: 600,
                textDecoration: 'underline',
                textDecorationColor: 'rgba(255,255,255,0.4)',
                textUnderlineOffset: '3px',
              }}>high-performance trading workflows</strong>{' '}
              with the power of automated trade copying and journaling.
            </p>

            {/* CTA buttons — exactly like Next.js: white filled + dark bordered */}
            <div style={{
              display: 'flex', gap: 12, justifyContent: 'center',
              flexWrap: 'wrap', marginBottom: 16,
            }}>
              <button className='cta-primary' onClick={() => navigate('/auth/signup')}>
                Get Started
              </button>
              <button className='cta-secondary' onClick={() => navigate('/auth/signin')}>
                Learn More
              </button>
            </div>

            {/* Terminal-style command line */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: '#666', fontSize: 13,
              fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
              marginTop: 4,
            }}>
              <span style={{ color: '#555' }}>▲</span>
              <span>~  Start trading smarter today</span>
            </div>
          </div>

          {/* ─── GRID PATTERN below hero content ─── */}
          <div style={{
            position: 'relative', zIndex: 1,
            maxWidth: 720, margin: '0 auto',
            padding: '0 24px 60px',
          }}>
            {/* 3-column grid of dark rectangles with subtle borders */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 0,
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #1a1a1a',
            }}>
              {/* Row 1 */}
              <div style={{ height: 80, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }} />
              <div style={{ height: 80, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }} />
              <div style={{ height: 80, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }} />
              {/* Row 2 */}
              <div style={{ height: 80, background: '#0a0a0a', borderRight: '1px solid #1a1a1a' }} />
              <div style={{ height: 80, background: '#0a0a0a', borderRight: '1px solid #1a1a1a' }} />
              <div style={{ height: 80, background: '#0a0a0a' }} />
            </div>
          </div>

          {/* Bottom gradient line separator */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(to right, transparent, #222 50%, transparent)',
          }} />
        </section>

        {/* ─── FEATURES SECTION ─── */}
        <section style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '80px 24px',
        }}>
          {/* Section heading — bold title + gray subtitle inline */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{
              fontSize: 24, fontWeight: 700, color: '#ededed',
              letterSpacing: '-0.03em',
            }}>
              What's in Tradescale?
            </span>
            <span style={{
              color: '#666', fontSize: 16, marginLeft: 16,
              fontWeight: 400,
            }}>
              Everything you need to trade at the highest level.
            </span>
          </div>

          {/* Feature cards — 3 columns, flush together with border separators */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #1a1a1a',
          }}>
            {/* Card 1: Built-in Optimizations style — gradient mountain illustration */}
            <div className='feature-card' style={{ borderRight: '1px solid #1a1a1a' }}>
              <div style={{
                width: '100%', height: 200, marginBottom: 20,
                borderRadius: 8, overflow: 'hidden',
                position: 'relative',
                background: 'linear-gradient(180deg, #1a1a2e 0%, #111 100%)',
              }}>
                {/* Mountain/landscape shapes */}
                <svg width='100%' height='100%' viewBox='0 0 320 200' preserveAspectRatio='none' style={{ position: 'absolute', bottom: 0 }}>
                  <defs>
                    <linearGradient id='mtn1' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor='#2a2a4a' />
                      <stop offset='100%' stopColor='#1a1a2e' />
                    </linearGradient>
                    <linearGradient id='mtn2' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor='#333355' />
                      <stop offset='100%' stopColor='#222240' />
                    </linearGradient>
                  </defs>
                  <polygon points='0,200 60,90 140,140 200,60 260,120 320,80 320,200' fill='url(#mtn1)' opacity='0.6' />
                  <polygon points='0,200 80,130 160,100 240,140 320,110 320,200' fill='url(#mtn2)' opacity='0.4' />
                  <line x1='0' y1='200' x2='320' y2='200' stroke='#2a2a4a' strokeWidth='1' />
                </svg>
                {/* Window dots */}
                <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
                </div>
                {/* "DEVELOP" label */}
                <div style={{
                  position: 'absolute', top: 10, right: 14,
                  color: '#555', fontSize: 10, fontFamily: 'monospace',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  JOURNAL
                </div>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: '#ededed' }}>
                Built-in Trade Journal
              </h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Automatic and manual trade logging with in-depth statistics, screenshots, and performance analytics.
              </p>
            </div>

            {/* Card 2: Dynamic HTML Streaming style — terminal/code UI */}
            <div className='feature-card' style={{ borderRight: '1px solid #1a1a1a' }}>
              <div style={{
                width: '100%', height: 200, marginBottom: 20,
                borderRadius: 8, overflow: 'hidden',
                background: '#111', position: 'relative',
              }}>
                {/* Window dots */}
                <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
                </div>
                {/* Code/terminal content */}
                <div style={{
                  padding: '36px 16px 16px', fontFamily: 'monospace', fontSize: 11,
                  color: '#555', lineHeight: 1.7,
                }}>
                  <div><span style={{ color: '#666' }}>{'>'}</span> <span style={{ color: '#888' }}>Copying trade...</span></div>
                  <div style={{ color: '#444' }}>  ├─ Account 1 <span style={{ color: '#28c840' }}>✓ filled</span></div>
                  <div style={{ color: '#444' }}>  ├─ Account 2 <span style={{ color: '#28c840' }}>✓ filled</span></div>
                  <div style={{ color: '#444' }}>  ├─ Account 3 <span style={{ color: '#28c840' }}>✓ filled</span></div>
                  <div style={{ color: '#444' }}>  ├─ Account 4 <span style={{ color: '#28c840' }}>✓ filled</span></div>
                  <div style={{ color: '#444' }}>  └─ Account 5 <span style={{ color: '#28c840' }}>✓ filled</span></div>
                  <div style={{ marginTop: 8, color: '#555' }}>
                    <span style={{ color: '#666' }}>{'>'}</span> <span style={{ color: '#888' }}>5/5 accounts synced</span> <span style={{ color: '#28c840' }}>■</span>
                  </div>
                </div>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: '#ededed' }}>
                Instant Trade Copying
              </h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Streaming real-time trade execution across unlimited prop firm accounts with zero delay.
              </p>
            </div>

            {/* Card 3: React Server Components style — abstract connected circles */}
            <div className='feature-card'>
              <div style={{
                width: '100%', height: 200, marginBottom: 20,
                borderRadius: 8, overflow: 'hidden',
                background: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width='180' height='140' viewBox='0 0 180 140'>
                  {/* Connection lines */}
                  <line x1='50' y1='45' x2='90' y2='45' stroke='#222' strokeWidth='1' />
                  <line x1='90' y1='45' x2='130' y2='45' stroke='#222' strokeWidth='1' />
                  <line x1='50' y1='45' x2='70' y2='95' stroke='#222' strokeWidth='1' />
                  <line x1='90' y1='45' x2='70' y2='95' stroke='#222' strokeWidth='1' />
                  <line x1='90' y1='45' x2='110' y2='95' stroke='#222' strokeWidth='1' />
                  <line x1='130' y1='45' x2='110' y2='95' stroke='#222' strokeWidth='1' />
                  {/* Outer circles */}
                  <circle cx='50' cy='45' r='18' fill='none' stroke='#2a2a2a' strokeWidth='1.5' />
                  <circle cx='90' cy='45' r='18' fill='none' stroke='#2a2a2a' strokeWidth='1.5' />
                  <circle cx='130' cy='45' r='18' fill='none' stroke='#2a2a2a' strokeWidth='1.5' />
                  <circle cx='70' cy='95' r='18' fill='none' stroke='#2a2a2a' strokeWidth='1.5' />
                  <circle cx='110' cy='95' r='18' fill='none' stroke='#2a2a2a' strokeWidth='1.5' />
                  {/* Inner filled circles */}
                  <circle cx='50' cy='45' r='7' fill='#333' />
                  <circle cx='90' cy='45' r='7' fill='#444' />
                  <circle cx='130' cy='45' r='7' fill='#333' />
                  <circle cx='70' cy='95' r='7' fill='#3a3a3a' />
                  <circle cx='110' cy='95' r='7' fill='#3a3a3a' />
                  {/* Highlight dots */}
                  <circle cx='50' cy='45' r='2.5' fill='#888' />
                  <circle cx='90' cy='45' r='2.5' fill='#aaa' />
                  <circle cx='130' cy='45' r='2.5' fill='#888' />
                  <circle cx='70' cy='95' r='2.5' fill='#888' />
                  <circle cx='110' cy='95' r='2.5' fill='#888' />
                </svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: '#ededed' }}>
                Multi-Platform Connectivity
              </h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Seamlessly connect every major futures prop firm. Apex, Topstep, MyFundedFutures, Tradeify, and more.
              </p>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer style={{
          borderTop: '1px solid #1a1a1a',
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#444', fontSize: 13, margin: 0 }}>
            © {new Date().getFullYear()} Tradescale Group. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
}
