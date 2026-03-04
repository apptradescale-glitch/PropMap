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
        @keyframes heroGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        .hero-glow { animation: heroGlow 8s ease-in-out infinite; }
        .hero-glow-delay { animation: heroGlow 8s ease-in-out 4s infinite; }
      `}</style>

      <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>

        {/* ─── NAVBAR ─── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}>
          <div style={{
            maxWidth: 1200, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 24px',
          }}>
            {/* Left: logo + name + nav links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={Logo} alt='Tradescale' style={{ height: 24, width: 28 }} />
                <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>Tradescale</span>
              </div>
              <div style={{ display: 'flex', gap: 24 }} className='hidden md:flex'>
                {['Home', 'Plans', 'Insights', 'Contact'].map(item => (
                  <button key={item} style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
                    fontSize: 14, cursor: 'pointer', padding: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: auth buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => navigate('/auth/signup')}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
                  fontSize: 14, cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              >
                Sign up
              </button>
              <button
                onClick={() => navigate('/auth/signin')}
                style={{
                  background: '#fff', color: '#000', border: 'none',
                  padding: '6px 16px', borderRadius: 6, fontSize: 14,
                  fontWeight: 600, cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e5e5e5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                Sign in
              </button>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Background glow orbs */}
          <div className='hero-glow' style={{
            position: 'absolute', top: -120, left: '30%',
            width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div className='hero-glow-delay' style={{
            position: 'absolute', top: -80, right: '25%',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div ref={topRef} style={{
            maxWidth: 900, margin: '0 auto',
            textAlign: 'center',
            padding: '120px 24px 80px',
            position: 'relative', zIndex: 1,
          }}>
            <h1 style={{
              fontSize: 'clamp(40px, 7vw, 72px)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.05,
              margin: '0 0 24px',
            }}>
              The Trading Platform<br />for Professionals
            </h1>

            <p style={{
              fontSize: 16, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.6)',
              maxWidth: 600, margin: '0 auto 40px',
            }}>
              Used by traders worldwide, Tradescale enables you to create{' '}
              <strong style={{ color: '#fff' }}>high-performance trading workflows</strong>{' '}
              with the power of automated trade copying and journaling.
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
              <button
                onClick={() => navigate('/auth/signup')}
                style={{
                  background: '#fff', color: '#000',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '10px 24px', borderRadius: 8,
                  fontSize: 16, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e5e5e5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                Get Started
              </button>
              <button
                onClick={() => navigate('/auth/signin')}
                style={{
                  background: 'transparent', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  padding: '10px 24px', borderRadius: 8,
                  fontSize: 16, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
              >
                Sign In
              </button>
            </div>

            {/* Terminal-like snippet */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: 'rgba(255,255,255,0.5)', fontSize: 14,
              fontFamily: 'monospace',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>▲</span>
              <span>~ Start trading smarter today</span>
            </div>
          </div>

          {/* Decorative gradient line */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 1,
            background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1) 50%, transparent)',
          }} />
        </section>

        {/* ─── FEATURES SECTION ─── */}
        <section style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '80px 24px',
        }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{
              fontSize: 'clamp(24px, 3vw, 32px)',
              fontWeight: 700,
              display: 'inline',
              letterSpacing: '-0.02em',
            }}>
              What's in Tradescale?
            </h2>
            <span style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 16, marginLeft: 12,
            }}>
              Everything you need to trade at the highest level.
            </span>
          </div>

          {/* Feature cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 1,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Card 1 */}
            <div style={{
              background: '#0a0a0a',
              padding: '40px 32px',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}>
              {/* Card illustration */}
              <div style={{
                width: '100%', height: 180, marginBottom: 24,
                borderRadius: 8, overflow: 'hidden',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', bottom: 16, left: 16, right: 16,
                }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 4, padding: '8px 12px' }}>
                    <div style={{ height: 4, width: '70%', background: 'rgba(255,255,255,0.15)', borderRadius: 2, marginBottom: 6 }} />
                    <div style={{ height: 4, width: '50%', background: 'rgba(255,255,255,0.1)', borderRadius: 2 }} />
                  </div>
                </div>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Built-in Trade Journal
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
                Automatic and manual trade logging with performance analytics, screenshots, notes, and in-depth statistics.
              </p>
            </div>

            {/* Card 2 */}
            <div style={{
              background: '#0a0a0a',
              padding: '40px 32px',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{
                width: '100%', height: 180, marginBottom: 24,
                borderRadius: 8, overflow: 'hidden',
                background: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {/* Terminal-style UI */}
                <div style={{ padding: 16, width: '100%' }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5f57' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#28c840' }} />
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: '#28c840' }}>▶</span> Copying trade to 5 accounts...
                    </div>
                    <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.3)' }}>
                      ✓ Account 1 — filled
                    </div>
                    <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.3)' }}>
                      ✓ Account 2 — filled
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.2)' }}>
                      ✓ Account 3 — filled
                    </div>
                  </div>
                </div>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Instant Trade Copying
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
                Copy trades across unlimited prop firm accounts in real time. Supports Tradovate, NinjaTrader, and more.
              </p>
            </div>

            {/* Card 3 */}
            <div style={{
              background: '#0a0a0a',
              padding: '40px 32px',
            }}>
              <div style={{
                width: '100%', height: 180, marginBottom: 24,
                borderRadius: 8, overflow: 'hidden',
                background: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Abstract circles */}
                <svg width='160' height='120' viewBox='0 0 160 120'>
                  <circle cx='40' cy='40' r='20' fill='none' stroke='rgba(255,255,255,0.15)' strokeWidth='1' />
                  <circle cx='80' cy='40' r='20' fill='none' stroke='rgba(255,255,255,0.15)' strokeWidth='1' />
                  <circle cx='120' cy='40' r='20' fill='none' stroke='rgba(255,255,255,0.15)' strokeWidth='1' />
                  <circle cx='60' cy='80' r='20' fill='none' stroke='rgba(255,255,255,0.15)' strokeWidth='1' />
                  <circle cx='100' cy='80' r='20' fill='none' stroke='rgba(255,255,255,0.15)' strokeWidth='1' />
                  <circle cx='40' cy='40' r='5' fill='rgba(255,255,255,0.3)' />
                  <circle cx='80' cy='40' r='5' fill='rgba(255,255,255,0.2)' />
                  <circle cx='120' cy='40' r='5' fill='rgba(255,255,255,0.15)' />
                  <circle cx='60' cy='80' r='5' fill='rgba(255,255,255,0.25)' />
                  <circle cx='100' cy='80' r='5' fill='rgba(255,255,255,0.2)' />
                  <line x1='40' y1='40' x2='80' y2='40' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />
                  <line x1='80' y1='40' x2='120' y2='40' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />
                  <line x1='40' y1='40' x2='60' y2='80' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />
                  <line x1='80' y1='40' x2='60' y2='80' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />
                  <line x1='80' y1='40' x2='100' y2='80' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />
                  <line x1='120' y1='40' x2='100' y2='80' stroke='rgba(255,255,255,0.08)' strokeWidth='1' />
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Multi-Platform Connectivity
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
                Seamlessly connect every major futures prop firm and platform. Apex, Topstep, MyFundedFutures, and more.
              </p>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '40px 24px',
          textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            © {new Date().getFullYear()} Tradescale Group. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
}
