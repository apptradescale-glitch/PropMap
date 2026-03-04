import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Box, AlignHorizontalDistributeCenter, Key, Eye, Focus, BarChart3, Receipt, Shield, FileText, CreditCard, TrendingUp, Crown, Zap, ShieldCheck, PieChart, ArchiveRestore, BrainCircuit, Link2, Calculator, NotebookPen } from 'lucide-react';
import Logo from '@/assets/images/lg34.png';

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
        <title>PROPMAP</title>
      </Helmet>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; color: #fff; }
        @keyframes bgGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div className="allow-scroll" style={{
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
              {/* Logo: PropMap logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'default' }}>
                <img src={Logo} alt='PropMap' style={{ height: 22, width: 26 }} />
                <span style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  color: '#fff',
                }}>
                  PROP<span style={{ fontSize: 11, fontWeight: 400, verticalAlign: 'baseline', marginLeft: 1, opacity: 0.7 }}>MAP</span>
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
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 1.1,
              margin: '0 0 16px',
              color: '#fff',
            }}>
              Track Your Business
            </h1>

            {/* Dotted line with vertical ends */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              {/* Left vertical line */}
              <div style={{
                width: 1,
                height: 20,
                background: 'linear-gradient(to bottom, transparent, #666 50%, transparent)',
                opacity: 0.4,
              }} />
              {/* Horizontal dotted line */}
              <div style={{
                width: 600,
                height: 1,
                backgroundImage: 'linear-gradient(to right, #666 25%, transparent 25%)',
                backgroundSize: '8px 1px',
                backgroundRepeat: 'repeat-x',
                opacity: 0.6,
              }} />
              {/* Right vertical line */}
              <div style={{
                width: 1,
                height: 20,
                background: 'linear-gradient(to bottom, transparent, #666 50%, transparent)',
                opacity: 0.4,
              }} />
            </div>

            <h2 style={{
              fontSize: 48,
              fontWeight: 700,
              fontStyle: 'italic',
              color: '#888',
              lineHeight: 1.1,
              margin: '0 0 40px',
              textAlign: 'center',
              fontFamily: '"Ethnocentric", "Eurostile Extended", "Impact", "Arial Black", sans-serif',
              fontStretch: 'condensed',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
            }}>
              Finances & Analytics
            </h2>

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
             across revenue, expenses, and more.
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
               <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Key size={14} />
                  Start Free Trial [3-days]
                </span>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={14} />
                  See our Features
                </span>
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

          {/* ═══════ DASHBOARD PREVIEW ═══════ */}
          <div style={{
            maxWidth: 1000,
            margin: '0 auto',
            padding: '0 24px 80px',
            position: 'relative',
            zIndex: 1,
          }}>
            <div style={{
              background: '#0a0a0a',
              border: '1px solid #1a1a1a',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {/* Dashboard window header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #1a1a1a',
                background: '#111',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e0ac69' }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e0ac69', opacity: 0.8 }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e0ac69', opacity: 0.6 }} />
                  </div>
                  <span style={{ color: '#666', fontSize: 12, fontFamily: 'monospace' }}>propmap.app</span>
                </div>
                <span style={{ color: '#444', fontSize: 11, fontFamily: 'monospace' }}>COMING SOON</span>
              </div>
              
              {/* Dashboard content */}
              <div style={{
                padding: '60px 40px',
                textAlign: 'center',
                minHeight: 300,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 40,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <img src={Logo} alt='PropMap' style={{ height: 96, width: 112, marginBottom: 6 }} />
                  <h2 style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.04em',
                    margin: 0,
                    color: '#fff',
                  }}>
                    PROP<span style={{ fontSize: 11, fontWeight: 400, verticalAlign: 'baseline', marginLeft: 1, opacity: 0.7 }}>MAP</span>
                  </h2>
                </div>
                <p style={{
                  fontSize: 20,
                  color: '#888',
                  marginBottom: 32,
                  textAlign: 'center',
                }}>
                  
                </p>
                
                {/* Feature list with checkmarks */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  maxWidth: 400,
                  width: '100%',
                }}>
                  {[
                    'Track your Expenses, Revenue and Profits',
                    'Label & Categorize your transactions',
                    'Connect your bank accounts securly ',
                    'Automated reporting & insights',
                    'Preview to potetnial tax exposure',
                  ].map((feature, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      color: '#fff',
                      fontSize: 16,
                    }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: '#141414',
                        border: '1px solid #2a2a2a',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.03)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: '2px solid #e0ac69',
                          borderTopColor: 'transparent',
                          background: '#141414',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 8px rgba(224,172,105,0.15), 0 4px 6px rgba(224,172,105,0.5)',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e0ac69" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
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
              What's <span style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: '#ededed',
            }}>PROP<span style={{ fontSize: 11, fontWeight: 400, verticalAlign: 'baseline', marginLeft: 1, opacity: 0.7 }}>MAP</span></span>?
            </span>
            <span style={{
              color: '#979797ff',
              fontSize: 16,
              marginLeft: 16,
              fontWeight: 400,
              display: 'block',
              marginTop: 8,
            }}>
              Everything you need to get the full control about your 
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                  <Box size={14} />
                  business
                </span>
                <span style={{ color: '#979797ff' }}>&</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                  <AlignHorizontalDistributeCenter size={14} />
                 prop trading
                </span>
              </div>
              ANALYTICS
            </span>
          </div>
        </section>

        {/* ═══════ FEATURES ═══════ */}
        <section style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '80px 24px 100px',
        }}>
          {/* Full-width horizontal line */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            borderTop: '1px solid #1a1a1a',
          }} />
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                fontSize: 22.5,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '12px 27px',
                borderRadius: 9,
                letterSpacing: '0.02em',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 0 3px rgba(224,172,105,0.8))'
                }}
              >
                <rect
                  x="0.5"
                  y="0.5"
                  width="calc(100% - 1px)"
                  height="calc(100% - 1px)"
                  fill="none"
                  stroke="rgba(224, 172, 105, 0.8)"
                  strokeWidth="1.5"
                  strokeDasharray="50 510"
                  strokeDashoffset="0"
                  rx="6"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values="0;-560"
                    dur="2.5s"
                    begin="0.2s"
                    repeatCount="indefinite"
                  />
                </rect>
              </svg>
              <span style={{ color: '#e0ac69', position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: 22.5,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  color: '#e0ac69',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  PROP<span style={{ fontSize: 13.75, fontWeight: 400, verticalAlign: 'sub', marginLeft: 1, opacity: 0.7, position: 'relative', top: 2 }}>MAP</span>
                </span>
                <span style={{ fontSize: 22.5, color: '#e0ac69', marginLeft: 8 }}>Features</span>
              </span>
            </div>
          </div>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            maxWidth: 1100,
            margin: '0 auto',
            borderTop: '1px solid #1a1a1a',
            borderLeft: '1px solid #1a1a1a',
          }}>
            {[
              {
                title: 'Visual Analytics',
                description: 'Track real performance across all business types with powerful visual analytics. Our platform delivers in-depth insights and detailed statistics, with specialized tools designed for prop trading—helping you identify inefficiencies, fix issues faster, and scale with confidence..',
                usePieChart: true,
              },
              {
                title: 'Upload Files',
                description: 'Upload all your files, invoices or certificates, label them, put notes and save them in our database. Easy filtering & finding documents.',
                useArchiveRestore: true,
              },
              {
                title: 'Secure Bank Connection',
                description: 'Connect your bank accounts with plaid, encrypted data transfer, credentials are never stored.',
                useShieldCheck: true,
              },
              {
                title: 'Automated Sync',
                description: 'Not only transacton history, also new transaction are automatically inputted into the dashboard.',
                useBrainCircuit: true,
              },
              {
                title: 'Smart Categorization',
                description: 'Categorize and track all business expenses & profits with smart labeling and filtering.',
                useLink2: true,
              },
              {
                title: 'Tax Overview',
                description: 'Overview of all your tax liabilities, potential deductions and taxable income. [IMPORTANT: This is not tax advice, always consult a tax professional, ONLY A OVERVIEW]',
                useNotebookPen: true,
              }
            ].map((feature, index) => (
              <div key={index} style={{
                padding: '32px',
                textAlign: 'left',
                borderRight: '1px solid #1a1a1a',
                borderBottom: '1px solid #1a1a1a',
              }}>
                <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: '#141414',
                        border: '1px solid #2a2a2a',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.03)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 20,
                        flexShrink: 0,
                      }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: '2px solid #e0ac69',
                          borderTopColor: 'transparent',
                          background: '#141414',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 8px rgba(224,172,105,0.15), 0 4px 6px rgba(224,172,105,0.5)',
                        }}>
                          {feature.usePieChart ? (
                            <PieChart size={14} color="#e0ac69" />
                          ) : feature.useArchiveRestore ? (
                            <ArchiveRestore size={14} color="#e0ac69" />
                          ) : feature.useBrainCircuit ? (
                            <BrainCircuit size={14} color="#e0ac69" />
                          ) : feature.useLink2 ? (
                            <Link2 size={14} color="#e0ac69" />
                          ) : feature.useNotebookPen ? (
                            <NotebookPen size={14} color="#e0ac69" />
                          ) : feature.useShieldCheck ? (
                            <ShieldCheck size={14} color="#e0ac69" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e0ac69" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </div>
                <h3 style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 12,
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: 14,
                  color: '#888',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
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
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#888' }}>Support</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Documentation</span>
                  <span style={{ color: '#666', fontSize: 13, cursor: 'pointer' }}>Contact</span>
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
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
