import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Box, AlignHorizontalDistributeCenter } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#000';
    document.body.style.margin = '0';
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>PropMap</title>
      </Helmet>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; color: #fff; }
        @keyframes bgGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}>

        {/* ═══════ NAVBAR ═══════ */}
        <nav style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}>
          <div style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 47,
          }}>
            {/* Left side: logo + nav links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              {/* Logo: triangle + NEXT.js */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'default' }}>
                <svg width="18" height="18" viewBox="0 0 76 65" fill="none">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#fff" />
                </svg>
                <span style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  color: '#fff',
                }}>
                  NEXT<span style={{ fontSize: 11, fontWeight: 400, verticalAlign: 'super', marginLeft: 1, opacity: 0.7 }}>.js</span>
                </span>
              </div>
              {/* Nav links */}
              <div style={{ display: 'flex', gap: 22 }}>
                {['Home', 'Features', 'Pricing', 'Contact'].map(item => (
                  <span
                    key={item}
                    style={{
                      color: '#888',
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#888')}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Right side: search + buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Search bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: '5px 12px',
                minWidth: 180,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span style={{ color: '#555', fontSize: 13 }}>Search through docs</span>
              </div>
              {/* Dark mode icon */}
              <span style={{
                color: '#888', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              </span>
              {/* Deploy button */}
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                color: '#fff', fontSize: 13, cursor: 'pointer',
                background: 'transparent', border: '1px solid #333',
                padding: '5px 12px', borderRadius: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 76 65" fill="none">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#fff" />
                </svg>
                Sign Up
              </span>
              {/* Learn button */}
              <span style={{
                background: '#fff',
                color: '#000',
                fontSize: 13,
                fontWeight: 500,
                padding: '5px 14px',
                borderRadius: 6,
                cursor: 'pointer',
              }}>
                Sign In
              </span>
            </div>
          </div>
        </nav>

        {/* ═══════ HERO ═══════ */}
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Subtle radial glow */}
          <div style={{
            position: 'absolute',
            top: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 700,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.035) 0%, transparent 60%)',
            pointerEvents: 'none',
            animation: 'bgGlow 8s ease-in-out infinite',
          }} />

          <div style={{
            maxWidth: 750,
            margin: '0 auto',
            textAlign: 'center',
            padding: '100px 24px 40px',
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Main heading */}
            <h1 style={{
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 1.1,
              margin: '0 0 24px',
              color: '#fff',
            }}>
              Track Your Business Numbers
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: '#888',
              maxWidth: 560,
              margin: '0 auto 40px',
              fontWeight: 400,
            }}>
             Designed for prop traders and business owners, PropMap enables{' '}
              <strong style={{
                color: '#fff',
                fontWeight: 600,
                textDecoration: 'underline',
                textDecorationColor: 'rgba(255,255,255,0.4)',
                textUnderlineOffset: '3px',
                textDecorationThickness: '1px',
              }}>deep financial analytics</strong>{' '}
             across revenue, expenses, and performance.
            </p>

            {/* CTA Buttons */}
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              marginBottom: 18,
            }}>
              <button
                style={{
                  background: '#fff',
                  color: '#000',
                  border: '1px solid #333',
                  padding: '9px 22px',
                  borderRadius: 7,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e5e5e5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
               Start Free Trial [3-days]
              </button>
              <button
                style={{
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid #333',
                  padding: '9px 22px',
                  borderRadius: 7,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#666'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; }}
              >
              See our Features
              </button>
            </div>

            {/* Terminal command */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#555',
              fontSize: 13,
              fontFamily: '"SF Mono", "Fira Code", Menlo, Consolas, monospace',
            }}>
              <svg width="11" height="11" viewBox="0 0 76 65" fill="none">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#444" />
              </svg>
              <span>~ Take your business to the next level</span>
            </div>
          </div>

          {/* ═══════ GRID PATTERN ═══════ */}
          <div style={{
            maxWidth: 680,
            margin: '0 auto',
            padding: '0 24px 56px',
            position: 'relative',
            zIndex: 1,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #1a1a1a',
            }}>
              <div style={{ height: 72, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }} />
              <div style={{ height: 72, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }} />
              <div style={{ height: 72, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }} />
              <div style={{ height: 72, background: '#0a0a0a', borderRight: '1px solid #1a1a1a' }} />
              <div style={{ height: 72, background: '#0a0a0a', borderRight: '1px solid #1a1a1a' }} />
              <div style={{ height: 72, background: '#0a0a0a' }} />
            </div>
          </div>
        </section>

        {/* ═══════ FEATURES ═══════ */}
        <section style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '80px 24px 100px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#ededed',
              letterSpacing: '-0.03em',
            }}>
              What's PropMap?
            </span>
            <span style={{
              color: '#666',
              fontSize: 16,
              marginLeft: 16,
              fontWeight: 400,
            }}>
              Everything you need to get the full control about{' '}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Box size={14} />
                business
              </span>
              {' / '}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlignHorizontalDistributeCenter size={14} />
                trading
              </span>
              .
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #1a1a1a',
          }}>
            {/* Card 1: Built-in Optimizations */}
            <div style={{ background: '#0a0a0a', padding: '28px 24px', borderRight: '1px solid #1a1a1a' }}>
              <div style={{
                width: '100%', height: 200, marginBottom: 20, borderRadius: 8,
                overflow: 'hidden', position: 'relative',
                background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)',
              }}>
                <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <div style={{ position: 'absolute', top: 10, right: 14, color: '#444', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>DEVELOP</div>
                <svg width="100%" height="100%" viewBox="0 0 340 200" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0 }}>
                  <defs>
                    <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2a2a4a" /><stop offset="100%" stopColor="#1a1a30" /></linearGradient>
                    <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#333355" /><stop offset="100%" stopColor="#222244" /></linearGradient>
                  </defs>
                  <polygon points="0,200 70,80 150,140 210,50 270,110 340,75 340,200" fill="url(#m1)" opacity="0.5" />
                  <polygon points="0,200 90,125 170,95 250,135 340,105 340,200" fill="url(#m2)" opacity="0.35" />
                </svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#ededed' }}>Built-in Optimizations</h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.55, margin: 0 }}>Automatic Image, Font, and Script Optimizations for improved UX and Core Web Vitals.</p>
            </div>

            {/* Card 2: Dynamic HTML Streaming */}
            <div style={{ background: '#0a0a0a', padding: '28px 24px', borderRight: '1px solid #1a1a1a' }}>
              <div style={{
                width: '100%', height: 200, marginBottom: 20, borderRadius: 8,
                overflow: 'hidden', background: '#111', position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <div style={{ padding: '38px 16px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 50, height: 6, borderRadius: 3, background: '#222' }} />
                    <div style={{ width: 40, height: 6, borderRadius: 3, background: '#222' }} />
                    <div style={{ width: 60, height: 6, borderRadius: 3, background: '#222' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 50, borderRadius: 4, background: '#1a1a1a', border: '1px solid #222' }} />
                    <div style={{ flex: 1, height: 50, borderRadius: 4, background: '#1a1a1a', border: '1px solid #222' }} />
                  </div>
                  <div style={{ width: '100%', height: 60, borderRadius: 4, background: '#1a1a1a', border: '1px solid #222' }} />
                </div>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#ededed' }}>Dynamic HTML Streaming</h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.55, margin: 0 }}>Instantly stream UI from the server, integrated with the App Router and React Suspense.</p>
            </div>

            {/* Card 3: React Server Components */}
            <div style={{ background: '#0a0a0a', padding: '28px 24px' }}>
              <div style={{
                width: '100%', height: 200, marginBottom: 20, borderRadius: 8,
                overflow: 'hidden', background: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="180" height="140" viewBox="0 0 180 140">
                  <line x1="50" y1="42" x2="90" y2="42" stroke="#222" strokeWidth="1" />
                  <line x1="90" y1="42" x2="130" y2="42" stroke="#222" strokeWidth="1" />
                  <line x1="50" y1="42" x2="70" y2="98" stroke="#222" strokeWidth="1" />
                  <line x1="90" y1="42" x2="70" y2="98" stroke="#222" strokeWidth="1" />
                  <line x1="90" y1="42" x2="110" y2="98" stroke="#222" strokeWidth="1" />
                  <line x1="130" y1="42" x2="110" y2="98" stroke="#222" strokeWidth="1" />
                  <circle cx="50" cy="42" r="18" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                  <circle cx="90" cy="42" r="18" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                  <circle cx="130" cy="42" r="18" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                  <circle cx="70" cy="98" r="18" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                  <circle cx="110" cy="98" r="18" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
                  <circle cx="50" cy="42" r="8" fill="#2a2a2a" />
                  <circle cx="90" cy="42" r="8" fill="#333" />
                  <circle cx="130" cy="42" r="8" fill="#2a2a2a" />
                  <circle cx="70" cy="98" r="8" fill="#2e2e2e" />
                  <circle cx="110" cy="98" r="8" fill="#2e2e2e" />
                  <circle cx="47" cy="39" r="2" fill="#555" />
                  <circle cx="87" cy="39" r="2.5" fill="#666" />
                  <circle cx="127" cy="39" r="2" fill="#555" />
                  <circle cx="67" cy="95" r="2" fill="#555" />
                  <circle cx="107" cy="95" r="2" fill="#555" />
                </svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#ededed' }}>React Server Components</h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.55, margin: 0 }}>Add components without sending additional client-side JavaScript. Built on the latest React features.</p>
            </div>
          </div>
        </section>

        {/* ═══════ FOOTER ═══════ */}
        <footer style={{
          borderTop: '1px solid #1a1a1a',
          padding: '60px 24px 40px',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: 1100,
            margin: '0 auto',
          }}>
            <div style={{ marginBottom: 40 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#ededed' }}>
                Ready to take control?
              </h3>
              <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
                Join thousands of traders and business owners using PropMap to track their performance.
              </p>
              <button
                style={{
                  background: '#fff',
                  color: '#000',
                  border: '1px solid #333',
                  padding: '10px 24px',
                  borderRadius: 7,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e5e5e5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                Start Free Trial
              </button>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 40,
              marginBottom: 40,
              flexWrap: 'wrap',
            }}>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#888' }}>Product</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Features</span>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Pricing</span>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>API</span>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#888' }}>Company</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>About</span>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Blog</span>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Careers</span>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#888' }}>Support</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Documentation</span>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Contact</span>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Status</span>
                </div>
              </div>
            </div>
            <div style={{
              paddingTop: 32,
              borderTop: '1px solid #1a1a1a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}>
              <p style={{ color: '#444', fontSize: 13, margin: 0 }}>
                © {new Date().getFullYear()} PropMap. All rights reserved.
              </p>
              <div style={{ display: 'flex', gap: 24 }}>
                <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Privacy</span>
                <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Terms</span>
                <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Cookies</span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
