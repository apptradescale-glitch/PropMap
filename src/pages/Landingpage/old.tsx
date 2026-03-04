import InsightsImg from '@/assets/images/Insights.png';
import A1 from '@/assets/images/A1.png';
import A2 from '@/assets/images/A2.png';
import A3 from '@/assets/images/A3.png';
import A4 from '@/assets/images/A4.png';
import Homescreen from '@/assets/images/homescreen.png';
import LogoCPU from '@/assets/images/logocpu.png';
import AlphaFutures from '@/assets/images/alphafutures.png';
import HomeAlpha from '@/assets/images/Layer_1.png';
import HomeAlpha1 from '@/assets/images/homealpha.png';
import HomeAlpha2 from '@/assets/images/topstep.png';
import HomeAlpha3 from '@/assets/images/tradeify.png';

import A from '@/assets/images/apextraderfunding.png';
import T from '@/assets/images/topstep.png';
import M from '@/assets/images/myfundedfutures.png';
import F from '@/assets/images/fundednextfutures.png';
import L from '@/assets/images/lucid.png';
import TPT from '@/assets/images/takeprofittrader.png';
import TOF from '@/assets/images/toponefutures.png';
import TR from '@/assets/images/tradeify.png';



import React, { useEffect, useState } from 'react';
// Animated counter hook with Intersection Observer
function useCountUpOnVisible(target: number, duration: number = 1200, format?: (n: number) => string) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    let end = target;
    let startTime: number | null = null;
    function step(ts: number) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const value = Math.floor(progress * (end - start) + start);
      setCount(value);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    }
    requestAnimationFrame(step);
    // eslint-disable-next-line
  }, [started, target, duration]);
  return [ref, format ? format(count) : count] as const;
}
import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/context/FAuth';
import { Helmet } from 'react-helmet-async';
import Logo from '@/assets/images/lg34.png';
import { Button } from '@/components/ui/button';


import Tradovate from '@/assets/images/tradovate.png'; 
import TV from '@/assets/images/tvlogo.png'; 
import TVLogo2 from '@/assets/images/tvlogo2.png';
import NJT from '@/assets/images/njt.png'; 
import PJX from '@/assets/images/projectx.png'; 
import TPX from '@/assets/images/tpx.png';
import TopstepX from '@/assets/images/topstepX.jpg'; 
import Volumetrica from '@/assets/images/volumetrica.png';
import DDD from '@/assets/images/ddd.png';
import DDD2 from '@/assets/images/ddd2.png';

import { Crosshair, Key, Home, User, GitFork, Shield, Zap } from 'lucide-react';



const ACCENT = "#94bba3";

const gridBg = `
  repeating-linear-gradient(
    to right,
    transparent,
    transparent 23px,
    rgba(255,255,255,0.18) 24px,
    transparent 25px
  ),
  repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 23px,
    rgba(255,255,255,0.18) 24px,
    transparent 25px
  )
`;

const CheckIcon = (
  <span className="mt-1" style={{ color: ACCENT }}>
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20">
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l4 4 6-8"/>
    </svg>
  </span>
);

const firms = [
  { name: "Apex Trader Funding", logo: A },
  { name: "Topstep", logo: T },
  { name: "MyFundedFutures", logo: M },
  { name: "Lucid Trading", logo: L },
  { name: "Funded Next Futures", logo: F },
  { name: "Take Profit Trader", logo: TPT },
  { name: "Top One Futures", logo: TOF },
  { name: "Tradeify", logo: TR },
  { name: "Alpha Futures", logo: AlphaFutures },
];

function FancyHorizontalSeparator() {
  return (
    <div className="relative flex items-center justify-center w-full my-16">
      {/* Outer glow effect */}
      <div
        className="h-2 bg-[#94bba3] rounded-full shadow-[0_0_12px_4px_#94bba355] blur-[4px]"
        style={{ width: '200px' }}
      />
      {/* White inner part */}
    
    </div>
  );
}

const NAVBAR_HEIGHT = 60;

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const topRef = useRef<HTMLDivElement>(null);
  const platformsRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
    const insightsRef = useRef<HTMLDivElement>(null);
    const overviewRef = useRef<HTMLDivElement>(null);

  const [activeSection, setActiveSection] = useState<'home' | 'platforms' | 'contact' | 'pricing' | 'insights' | 'overview'>('home');

  // Force dark mode on landing page
  useEffect(() => {
    const root = window.document.documentElement;
    const previousTheme = root.className;
    
    root.classList.remove('light', 'dark');
    root.classList.add('dark');
    
    return () => {
      root.className = previousTheme;
    };
  }, []);

  const handleSubscriptionClick = (subscriptionType: 'basic' | 'basicON' | 'pro' | 'proplus') => {

    
    if (currentUser) {
      // User is authenticated, go directly to subscription management
     
      navigate('/dashboard/ManageSubscription', { 
        state: { selectedPlan: subscriptionType } 
      });
    } else {
      // Store the intended subscription in localStorage and redirect to signup
   
      localStorage.setItem('intendedSubscription', subscriptionType);
      navigate('/auth/signup');
    }
  };

  const handleNavScroll = (section: string) => {
    let ref: React.RefObject<HTMLDivElement> | null = null;
    if (section === 'home') ref = topRef;
    if (section === 'platforms') ref = platformsRef;
    if (section === 'contact') ref = contactRef;
    if (section === 'pricing') ref = pricingRef;
    if (section === 'insights') ref = insightsRef;
    if (section === 'overview') ref = overviewRef;
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Lightbox state for A images
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const openLightbox = (src: string) => {
    setLightboxImage(src);
    setLightboxOpen(true);
  };
  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxImage(null);
  };

  const carouselImages = [
    { src: A1, label: 'Trading Dashboard' },
    { src: A2, label: 'Trade Logbook' },
    { src: A3, label: 'Business Operational Tab' },
    { src: A4, label: 'Trade Copier Interface' },
  ];

  const nextSlide = () => {
    setCarouselIndex((prev) => (prev + 1) % carouselImages.length);
  };

  const prevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY + NAVBAR_HEIGHT;
      const sections = [
        { key: 'home', ref: topRef },
        { key: 'platforms', ref: platformsRef },
        { key: 'contact', ref: contactRef },
      ] as const;

      let current: typeof sections[number]['key'] = 'home';
      const allSections = [
        { key: 'home', ref: topRef },
        { key: 'platforms', ref: platformsRef },
        { key: 'pricing', ref: pricingRef },
        { key: 'overview', ref: overviewRef },
        { key: 'insights', ref: insightsRef },
        { key: 'contact', ref: contactRef },
      ];
      for (let i = 0; i < allSections.length; i++) {
        const ref = allSections[i].ref.current;
        if (ref) {
          const offsetTop = ref.offsetTop;
          if (scrollY >= offsetTop) {
            current = allSections[i].key;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <Helmet>
        <title>Tradescale</title>
        <meta name="description" content="Advanced trading Journal completely for free & other features available for professional traders. The most advanced tools for traders built for professional performance." />
        <meta name="keywords" content="trading journal, futures trading, trade copier, trading tools, professional trading, Tradovate" />
        
        {/* Open Graph tags for social sharing */}
        <meta property="og:title" content="Tradescale - Advanced Trading Tools for Professional Traders" />
        <meta property="og:description" content="Advanced trading Journal completely for free & other features available for professional traders. The most advanced tools for traders built for professional performance." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://tradescale.vercel.app/" />
        <meta property="og:site_name" content="Tradescale" />
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Tradescale - Advanced Trading Tools for Professional Traders" />
        <meta name="twitter:description" content="Advanced trading Journal completely for free & other features available for professional traders. The most advanced tools for traders built for professional performance." />
        
        {/* Additional SEO tags */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Tradescale Group" />
        <link rel="canonical" href="https://tradescale.vercel.app/" />
      </Helmet>
      
      <div className="min-h-screen bg-black flex flex-col w-full allow-scroll relative" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* Left Beam Effect */}
      <div
        className="hidden md:block"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '22rem',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 90% 180% at 0% 0%, ${ACCENT}cc 0%, ${ACCENT}44 40%, transparent 80%),
            radial-gradient(ellipse 90% 180% at 0% 100%, ${ACCENT}cc 0%, ${ACCENT}44 40%, transparent 80%)
          `,
          filter: 'blur(32px)',
        }}
      />
      {/* Left Grid Overlay */}
      <div
        className="hidden md:block"
        style={{
          position: 'fixed',
          top: 0,
          left: '-2rem',
          width: '20rem',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
          background: gridBg,
          opacity: 0.45,
          mixBlendMode: 'lighten',
        }}
      />
      {/* Right Beam Effect */}
      <div
        className="hidden md:block"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '22rem',
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 90% 180% at 100% 0%, ${ACCENT}cc 0%, ${ACCENT}44 40%, transparent 80%),
            radial-gradient(ellipse 90% 180% at 100% 100%, ${ACCENT}cc 0%, ${ACCENT}44 40%, transparent 80%)
          `,
          filter: 'blur(32px)',
        }}
      />
      {/* Right Grid Overlay */}
      <div
        className="hidden md:block"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '20rem',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
          background: gridBg,
          opacity: 0.45,
          mixBlendMode: 'lighten',
        }}
      />
      {/* Main Content */}
      <div className="relative z-10 flex flex-col w-full">
        {/* Fixed Navbar */}
        <nav className="fixed top-10 left-0 w-full flex justify-center z-50 bg-transparent" style={{height: NAVBAR_HEIGHT}}>
          <div className="flex items-center bg-black rounded-xl px-4 py-3 w-[95vw] max-w-5xl shadow border border-white/20 pointer-events-auto">
            {/* Left: Logo + Company Name */}
            <div className="flex items-center gap-1 md:mr-6">
              <img src={Logo} alt="Tradescale Logo" className="h-7 w-9" />
              <span className="font-semibold text-white text-lg">Tradescale</span>
              <span
                className="ml-2 px-2 py-1.5 rounded bg-white/10 text-xs text-white border border-white/20 font-semibold"
                style={{ lineHeight: 1.8 }}
              >
                Futures
              </span>
            </div>
            {/* Center: Nav Links */}
            <div className="hidden md:flex flex-1 justify-center gap-6">
              <button
                className={`${activeSection === 'home' ? 'text-white' : 'text-white'} font-bold transition`}
                onClick={() => handleNavScroll('home')}
              >
                Home
              </button>
              <button
                className={`${activeSection === 'pricing' ? 'text-white' : 'text-white'} font-bold transition`}
                onClick={() => handleNavScroll('pricing')}
              >
                Plans
              </button>
              <button
                className={`${activeSection === 'insights' ? 'text-white' : 'text-white'} font-bold transition`}
                onClick={() => handleNavScroll('insights')}
              >
                Insights
              </button>
              <button
                className={`${activeSection === 'contact' ? 'text-white' : 'text-white'} font-bold transition`}
                onClick={() => handleNavScroll('contact')}
              >
                Contact
              </button>
            </div>
            {/* Right: Auth Buttons (Sign up left, Sign in right) */}
            <div className="flex items-center gap-2 md:ml-6 pr-2 ml-auto">
              <Button
                className="hidden md:inline-flex bg-transparent border border-white/20 text-white px-4 py-1 rounded font-semibold hover:bg-white/10 transition"
                onClick={() => navigate('/auth/signup')}
              >
                Sign up
              </Button>
              <Button
                className="bg-[#94bba3] text-black px-4 py-1 rounded font-semibold border border-transparent hover:bg-[#a7d2b7] hover:text-black transition"
                style={{ filter: 'brightness(1.15)' }}
                onClick={() => navigate('/auth/signin')}
              >
                Sign in
              </Button>
            </div>
          </div>
        </nav>
        {/* Main Section */}
        <main
          className="flex flex-col items-center w-full pt-[120px] px-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {/* Add ref to top of page */}
        <div
  ref={topRef}
  style={{ scrollMarginTop: NAVBAR_HEIGHT - 2 }}
/>
          {/* Partnership text */}
          <div className="flex justify-center mb-2 mt-3">
            <span
              className="flex items-center justify-center h-9 px-4 bg-[#94bba3]/20 border border-white/15 rounded-full text-white font-medium text-sm shadow mb-3"
              style={{
                cursor: 'default',
                userSelect: 'none',
                transition: 'none'
              }}
            >
              Official Partner of NinjaTrader & Tradovate
            </span>
          </div>
          {/* Top Banner moved above headline */}
          <div className="mt-4 mb-10">
            <div className="flex justify-center">
              <span className="relative inline-flex items-center gap-2 px-5 py-2 rounded-none border border-white/20 bg-black text-white/90 font-medium text-sm shadow animated-pill">
                <span className="ml-2 h-2 w-2 rounded-full bg-[#94bba3] inline-block"></span>
                #1 Futures Trading Allrounder
                <span className="inline-block align-middle ml-1" style={{ verticalAlign: 'middle' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#94bba3" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 4px #94bba3)' }}>
                    <ellipse cx="12" cy="12" rx="10" ry="12" />
                    <ellipse cx="9" cy="12" rx="2" ry="3" fill="#222" />
                    <ellipse cx="15" cy="12" rx="2" ry="3" fill="#222" />
                    <ellipse cx="12" cy="17" rx="3" ry="1.2" fill="#b2e5c7" />
                  </svg>
                </span>
                {/* Smooth perimeter animation using SVG stroke */}
                <svg className="pill-outline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 32" preserveAspectRatio="none">
                  <rect x="1" y="1" width="98" height="30" rx="0" ry="0" fill="none" />
                </svg>
              </span>
            </div>
          </div>
          {/* Headline */}
     
            {/* Taglines moved above the main heading */}
            <div className="w-full flex justify-center mb-4">
              <div className="max-w-xl text-center">
                <p className="text-white/80 text-sm">All Tools combined in one Platform</p>
                <p className="text-white/80 text-sm mt-2">
                  Trade Copier ⊂⊃ Trading Journal ⊂⊃ Backtesting
                  <span className="inline-flex items-center ml-2 px-1.5 py-0.5 text-[12px] font-semibold leading-none rounded border border-white/25 text-white/75 bg-transparent align-middle">
                    Soon
                  </span>
                </p>
              </div>
            </div>
            {/* Main heading */}
            <div className="mt-4 mb-8 w-full flex justify-center px-2">
              <h1 className="text-center text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight">
                Best <span style={{ color: ACCENT }}>Trade Copier</span> Software
              </h1>
            </div>
            {/* Styled description text below the main heading, centered */}
            <div className="w-full flex justify-center mb-12">
              <div className="flex md:scale-100 z-10 bg-black">
                <div className="border border-[#94bba3] shadow-[0_0_24px_2px_#94bba3aa] rounded-lg p-6 flex flex-col bg-black min-w-[300px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Tradescale</h3>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-white">$0</span>
                      <span className="text-sm text-white/70">/month</span>
                    </div>
                  </div>
                  <button
                    className="relative h-12 px-8 text-lg font-medium text-white bg-[#94bba3]/20 border border-white/15 hover:bg-[#94bba3]/20 transition-transform hover:scale-105 overflow-hidden group flex items-center gap-2 justify-center w-full rounded-md"
                    onClick={() => navigate('/auth/signup')}
                  >
                    <Key size={18} />
                    Start for free
                  </button>
                </div>
              </div>
            </div>
          {/* Subheadline, CTA, and Supported Platforms removed per request */}
          {/* Waveform Visualization Placeholder - Empty Frame */}
          <div className="w-full flex justify-center mb-8">
            <div
              className="rounded-xl w-full overflow-visible flex items-center justify-center relative"
              style={{
                maxWidth: 1200,
                maxHeight: 650,
                minHeight: 320,
                border: 'none',
                background: 'black',
                position: 'relative',
                aspectRatio: '16/9',
                padding: '40px',
              }}
            >
              {/* Top glow effect - height peaks at center, tapers at edges */}
              <div
                style={{
                  position: 'absolute',
                  top: '-30px',
                  left: '49.5%',
                  transform: 'translateX(-50%)',
                  width: '300px',
                  height: '40px',
                  background: 'radial-gradient(ellipse 40% 100% at 50% 100%, rgba(148, 187, 163, 0.25) 0%, rgba(148, 187, 163, 0.15) 25%, rgba(148, 187, 163, 0.05) 60%, transparent 100%)',
                  pointerEvents: 'none',
                  zIndex: -1,
                  filter: 'blur(6px)',
                }}
              />


              {/* Tradescale label with logo */}
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '49%',
                  transform: 'translateX(-50%)',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 1)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <img src={Logo} alt="Tradescale" style={{ height: '20px', width: '24px', marginTop: '-1px' }} />
                Tradescale
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '30px',
                  left: '49.5%',
                  transform: 'translateX(-50%)',
                  width: '200px',
                  height: '1px',
                  background: 'linear-gradient(to right, transparent 0%, rgba(148, 187, 163, 0.3) 30%, rgba(148, 187, 163, 0.4) 50%, rgba(148, 187, 163, 0.3) 70%, transparent 100%)',
                  boxShadow: '0 -4px 6px 0px rgba(148, 187, 163, 0.2)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />



              {/* Rounded corners overlay - top and sides only, no bottom */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: '12px',
                  pointerEvents: 'none',
                  zIndex: 3,
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 1px 0 0 rgba(255, 255, 255, 0.05), inset -1px 0 0 rgba(255, 255, 255, 0.05)',
                }}
              />

              {/* Globe Network Visualization */}
              <svg
                viewBox="0 0 800 600"
                style={{
                  position: 'absolute',
                  top: '50px',
                  left: 0,
                  right: 0,
                  width: '100%',
                  height: 'calc(100% - 50px)',
                  zIndex: 1,
                }}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Grid lines */}
                <defs>
                  <linearGradient id="globeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(148, 187, 163, 0.1)" />
                    <stop offset="100%" stopColor="rgba(148, 187, 163, 0.05)" />
                  </linearGradient>
                </defs>

                {/* Vertical grid lines */}
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <line
                    key={`v-${i}`}
                    x1={i * 133}
                    y1="20"
                    x2={i * 133}
                    y2="550"
                    stroke="rgba(128, 128, 128, 0.15)"
                    strokeWidth="1"
                    opacity={i === 0 || i === 6 ? 0 : 1}
                  />
                ))}

                {/* Horizontal grid lines */}
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <line
                    key={`h-${i}`}
                    x1="0"
                    y1={20 + i * 80}
                    x2="800"
                    y2={20 + i * 80}
                    stroke="rgba(128, 128, 128, 0.15)"
                    strokeWidth="1"
                    opacity={i === 6 ? 0 : 1}
                  />
                ))}

                {/* Curved grid lines (dome effect) */}

                {/* Connection lines */}

                {/* Nodes - Triangle shapes */}

                {/* Circle clipping paths */}
                <defs>
                  <clipPath id="circleClip">
                    <circle cx="400" cy="100" r="33" />
                  </clipPath>
                  <clipPath id="circleClipBottom">
                    <circle cx="400" cy="420" r="33" />
                  </clipPath>
                  <clipPath id="circleClipLeft">
                    <circle cx="200" cy="260" r="33" />
                  </clipPath>
                  <clipPath id="circleClipRight">
                    <circle cx="600" cy="260" r="33" />
                  </clipPath>
                  <clipPath id="rectClipTopLeft">
                    <rect x="95" y="60" width="80" height="80" />
                  </clipPath>
                  <clipPath id="rectClipTopRight">
                    <rect x="625" y="60" width="80" height="80" />
                  </clipPath>
                  <clipPath id="rectClipBottomLeft">
                    <rect x="75" y="380" width="120" height="80" />
                  </clipPath>
                  <clipPath id="rectClipBottomRight">
                    <rect x="625" y="380" width="80" height="80" />
                  </clipPath>
                  <clipPath id="rectClipMidRight">
                    <rect x="710" y="220" width="80" height="80" />
                  </clipPath>
                  <clipPath id="rectClipMidLeft">
                    <rect x="10" y="220" width="80" height="80" />
                  </clipPath>
                  <clipPath id="rectClipTopLeftDDD">
                    <rect x="75" y="60" width="120" height="80" />
                  </clipPath>
                  <linearGradient id="volumetricaLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4158FF" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <linearGradient id="blueGlowGradient" x1="135" y1="380" x2="135" y2="450">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Glow filter for the traveling dot */}
                <filter id="dotGlow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Blue glow filter for top line - enhanced */}
                <filter id="blueLineGlow">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Static connecting line as background */}
                <line
                  x1="400"
                  y1="135"
                  x2="400"
                  y2="220"
                  stroke="rgba(148, 187, 163, 0.08)"
                  strokeWidth="1"
                />

                {/* Traveling dot with animation */}
                <circle
                  cx="400"
                  cy="220"
                  r="5"
                  fill="#000000"
                  stroke="#94bba3"
                  strokeWidth="2"
                  filter="url(#dotGlow)"
                  opacity="1"
                >
                  <animate
                    attributeName="cy"
                    values="220;135;135;220"
                    keyTimes="0;0.155;0.845;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0;0"
                    keyTimes="0;0.155;0.156;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Outer Circle Design */}
                <circle
                  cx="400"
                  cy="100"
                  r="35"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />

                {/* Beacon Pulse Ring 1 */}
                <circle
                  cx="400"
                  cy="100"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.6);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Beacon Pulse Ring 2 */}
                <circle
                  cx="400"
                  cy="100"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.4);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* HomeAlpha Image inside circle */}
                <image
                  x="377.5"
                  y="78"
                  width="45"
                  height="45"
                  href={HomeAlpha}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#circleClip)"
                />

                {/* DDD Rectangle - top left (where Tradovate was), same size as TopstepX */}
                <rect
                  x="75"
                  y="60"
                  width="120"
                  height="80"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />
                <image
                  x="85"
                  y="55"
                  width="100"
                  height="90"
                  href={DDD}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#rectClipTopLeftDDD)"
                  filter="blur(8px)"
                />

                {/* Dark purple line on DDD rectangle top border */}
                <rect
                  x="117"
                  y="58"
                  width="36"
                  height="4"
                  fill="rgba(128, 128, 128, 0.6)"
                  filter="url(#blueLineGlow)"
                />

                {/* Right Rectangle */}
                <rect
                  x="625"
                  y="60"
                  width="80"
                  height="80"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />
                <image
                  x="630"
                  y="65"
                  width="70"
                  height="70"
                  href={TVLogo2}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#rectClipTopRight)"
                />

                {/* White line on top right rectangle top border - center part */}
                <rect
                  x="647"
                  y="58"
                  width="36"
                  height="4"
                  fill="#ffffff"
                  filter="url(#blueLineGlow)"
                />

                {/* Center CPU Logo */}
                <image
                  x="360"
                  y="220"
                  width="80"
                  height="80"
                  href={LogoCPU}
                  preserveAspectRatio="xMidYMid meet"
                />

                {/* Traveling dot going down from CPU logo to bottom circle */}
                <circle
                  cx="400"
                  cy="300"
                  r="5"
                  fill="#000000"
                  stroke="#94bba3"
                  strokeWidth="2"
                  filter="url(#dotGlow)"
                  opacity="1"
                >
                  <animate
                    attributeName="cy"
                    values="300;385;385;300"
                    keyTimes="0;0.155;0.845;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0;0"
                    keyTimes="0;0.155;0.156;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Static connecting line below CPU logo */}
                <line
                  x1="400"
                  y1="300"
                  x2="400"
                  y2="385"
                  stroke="rgba(148, 187, 163, 0.08)"
                  strokeWidth="1"
                />

                {/* Left Rectangle Bottom */}
                <rect
                  x="75"
                  y="380"
                  width="120"
                  height="80"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />
                <image
                  x="95"
                  y="380"
                  width="80"
                  height="80"
                  href={TopstepX}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#rectClipBottomLeft)"
                />

                {/* White line on bottom left rectangle top border - center part */}
                <rect
                  x="117"
                  y="378"
                  width="36"
                  height="4"
                  fill="#ffffff"
                  filter="url(#blueLineGlow)"
                />

                {/* Right Rectangle Bottom */}
                <rect
                  x="625"
                  y="380"
                  width="80"
                  height="80"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />
                <image
                  x="630"
                  y="385"
                  width="70"
                  height="70"
                  href={NJT}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#rectClipBottomRight)"
                />

                {/* Orange line on bottom right rectangle top border - center part */}
                <rect
                  x="647"
                  y="378"
                  width="36"
                  height="4"
                  fill="#ff6b35"
                  filter="url(#blueLineGlow)"
                />

                {/* Bottom Circle Design */}
                <circle
                  cx="400"
                  cy="420"
                  r="35"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />

                {/* Beacon Pulse Ring 1 */}
                <circle
                  cx="400"
                  cy="420"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.6);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Beacon Pulse Ring 2 */}
                <circle
                  cx="400"
                  cy="420"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.4);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* HomeTopstep Image inside bottom circle */}
                <image
                  x="377.5"
                  y="394"
                  width="45"
                  height="45"
                  href={HomeAlpha1}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#circleClipBottom)"
                />

                {/* Traveling dot going left from CPU logo to left circle */}
                <circle
                  cx="340"
                  cy="260"
                  r="5"
                  fill="#000000"
                  stroke="#94bba3"
                  strokeWidth="2"
                  filter="url(#dotGlow)"
                  opacity="1"
                >
                  <animate
                    attributeName="cx"
                    values="340;235;235;340"
                    keyTimes="0;0.155;0.845;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0;0"
                    keyTimes="0;0.155;0.156;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Static connecting line left of CPU logo */}
                <line
                  x1="340"
                  y1="260"
                  x2="235"
                  y2="260"
                  stroke="rgba(148, 187, 163, 0.08)"
                  strokeWidth="1"
                />

                {/* Left Circle Design */}
                <circle
                  cx="200"
                  cy="260"
                  r="35"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />

                {/* Beacon Pulse Ring 1 */}
                <circle
                  cx="200"
                  cy="260"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.6);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Beacon Pulse Ring 2 */}
                <circle
                  cx="200"
                  cy="260"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.4);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* HomeApex Image inside left circle */}
                <image
                  x="177.5"
                  y="237"
                  width="45"
                  height="45"
                  href={HomeAlpha2}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#circleClipLeft)"
                />

                {/* Volumetrica Rectangle - mid left, next to Topstep circle, mirroring Tradovate */}
                <rect
                  x="10"
                  y="220"
                  width="80"
                  height="80"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />
                <image
                  x="15"
                  y="225"
                  width="70"
                  height="70"
                  href={Volumetrica}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#rectClipMidLeft)"
                  filter="blur(8px)"
                />

                {/* Split-color line on Volumetrica rectangle top border */}
                <rect
                  x="32"
                  y="218"
                  width="36"
                  height="4"
                  fill="url(#volumetricaLineGrad)"
                  filter="url(#blueLineGlow)"
                />

                {/* Traveling dot going right from CPU logo to right circle */}
                <circle
                  cx="460"
                  cy="260"
                  r="5"
                  fill="#000000"
                  stroke="#94bba3"
                  strokeWidth="2"
                  filter="url(#dotGlow)"
                  opacity="1"
                >
                  <animate
                    attributeName="cx"
                    values="460;565;565;460"
                    keyTimes="0;0.155;0.845;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0;0"
                    keyTimes="0;0.155;0.156;1"
                    dur="4.0s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Static connecting line right of CPU logo */}
                <line
                  x1="460"
                  y1="260"
                  x2="565"
                  y2="260"
                  stroke="rgba(148, 187, 163, 0.08)"
                  strokeWidth="1"
                />

                {/* Right Circle Design */}
                <circle
                  cx="600"
                  cy="260"
                  r="35"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />

                {/* Beacon Pulse Ring 1 */}
                <circle
                  cx="600"
                  cy="260"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.6);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.1s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Beacon Pulse Ring 2 */}
                <circle
                  cx="600"
                  cy="260"
                  r="35"
                  fill="none"
                  stroke="rgba(148, 187, 163, 0)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="r"
                    values="35;60"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke"
                    values="rgba(148, 187, 163, 0.4);rgba(148, 187, 163, 0)"
                    keyTimes="0;1"
                    dur="1s"
                    begin="1.3s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* HomeTradeify Image inside right circle */}
                <image
                  x="577.5"
                  y="237"
                  width="45"
                  height="45"
                  href={HomeAlpha3}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#circleClipRight)"
                />

                {/* Tradovate Rectangle - right middle, next to Tradeify */}
                <rect
                  x="710"
                  y="220"
                  width="80"
                  height="80"
                  fill="#000000"
                  stroke="rgba(128, 128, 128, 0.15)"
                  strokeWidth="1.5"
                />
                <image
                  x="715"
                  y="225"
                  width="70"
                  height="70"
                  href={Tradovate}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath="url(#rectClipMidRight)"
                />

                {/* Blue line on Tradovate rectangle top border */}
                <rect
                  x="732"
                  y="218"
                  width="36"
                  height="4"
                  fill="#3b82f6"
                  filter="url(#blueLineGlow)"
                />

                {/* Filter for glow */}
                <filter id="blur">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
                </filter>
              </svg>
            </div>
          </div>
          {/* Stats Bar directly below the picture */}
          <div className="w-full flex justify-center mb-8">
            <div className="flex bg-black rounded-xl px-2 py-4 gap-8 w-full max-w-4xl justify-between items-center">
              {/* Stat 1 */}
              <div className="flex flex-col items-center flex-1">
                {(() => { const [ref, val] = useCountUpOnVisible(375); return (
                  <span ref={ref} className="text-4xl font-bold text-white">
                    {val}<span className="text-[#94bba3]">+</span>
                  </span>
                ); })()}
                <span className="text-white/80 text-base mt-2 text-center">
                  Traders using Tradescale
                </span>
              </div>
              {/* Divider */}
              <div className="h-12 w-px bg-white/20 mx-2" />
              {/* Stat 2 */}
              <div className="flex flex-col items-center flex-1">
                {(() => { const [ref, val] = useCountUpOnVisible(80); return (
                  <span ref={ref} className="text-4xl font-bold text-white">
                    {val}<span className="text-[#94bba3]">+</span>
                  </span>
                ); })()}
                <span className="text-white/80 text-base mt-2 text-center">
                  Connected Accounts
                </span>
              </div>
              {/* Divider */}
              <div className="h-12 w-px bg-white/20 mx-2" />
              {/* Stat 3 */}
              <div className="flex flex-col items-center flex-1">
                {(() => { const [ref, val] = useCountUpOnVisible(1250, 1200, n => n >= 1000 ? (n/1000).toFixed(2) + 'k' : n.toString()); return (
                  <span ref={ref} className="text-4xl font-bold text-white">
                    {val}<span className="text-[#94bba3]">+</span>
                  </span>
                ); })()}
                <span className="text-white/80 text-base mt-2 text-center">
                  Trades copied
                </span>
              </div>

              
            </div>
          </div>

          {/* Supported Connections Section Header */}
          <div className="flex flex-col items-center mb-12" style={{ marginTop: '48px' }}>
            <span
              className="flex items-center justify-center h-9 px-4 bg-[#94bba3]/20 border border-white/15 rounded-full text-white font-medium text-sm shadow mb-8 mt-2"
              style={{
                cursor: 'default',
                userSelect: 'none',
                transition: 'none'
              }}
            >
              Supported Connections
            </span>
            <p className="text-center text-white text-3xl md:text-4xl font-extrabold mb-4">
              <span style={{ color: '#94bba3', filter: 'drop-shadow(0 0 6px #94bba3)', fontSize: '0.75em', display: 'inline-block', transform: 'translateY(-0.18em)', marginRight: '0.3em' }}>⧼</span>
              Connect every futures prop firm account seamlessly
              <span style={{ color: '#94bba3', filter: 'drop-shadow(0 0 6px #94bba3)', fontSize: '0.75em', display: 'inline-block', transform: 'translateY(-0.18em)', marginLeft: '0.3em' }}>⧽</span>
            </p>
            <p className="text-center text-white/80 text-lg font-normal">
              Connectability of the following Platforms & Prop Firms
            </p>
          </div>

          {/* Platforms Row */}
          <div className="flex flex-wrap justify-center items-center gap-8 mb-0">
            {/* Tradovate */}
            <div className="flex items-center gap-3">
              <img src={Tradovate} alt="Tradovate" className="w-12 h-12 grayscale" style={{ marginTop: '-4px' }} />
              <span className="text-white text-lg font-medium">Tradovate</span>
            </div>

            {/* NinjaTrader */}
            <div className="flex items-center gap-3">
              <img src={NJT} alt="NinjaTrader" className="w-18 h-10 grayscale" />
              <span className="text-white text-lg font-medium">NinjaTrader</span>
            </div>

            {/* TradingView */}
            <div className="flex items-center gap-3">
              <img src={TV} alt="TradingView" className="w-14 h-12 grayscale" />
              <span className="text-white text-lg font-medium">TradingView</span>
            </div>

                   {/* Topstep */}
            <div className="flex items-center gap-3">
              <img src={TopstepX} alt="Topstep" className="w-18 h-10 grayscale" />
              <span className="text-white text-lg font-medium"></span>
            </div>

            {/* Volumetrica */}
            <div className="flex items-center gap-3">
              <img src={Volumetrica} alt="Volumetrica" className="w-12 h-12 grayscale" style={{ marginTop: '-4px', filter: 'blur(8px) grayscale(100%)' }} />
              <span className="text-white text-lg font-medium" style={{ filter: 'blur(4px)' }}>Volumetrica</span>
            </div>

            {/* DeepChart */}
            <div className="flex items-center gap-3">
              <img src={DDD} alt="DeepChart" className="w-26 h-10 grayscale" style={{ marginTop: '0px', filter: 'blur(8px)' }} />
            </div>
          </div>

     

          {/* Horizontal Line */}
          <div style={{ width: '400px', height: '3px', background: 'linear-gradient(to right, transparent 0%, #94bba3 35%, #94bba3 65%, transparent 100%)', margin: '48px auto', borderRadius: '2px', boxShadow: '0 0 12px #94bba3, 0 0 24px rgba(148, 187, 163, 0.6)', animation: 'glowPulse 2.5s ease-in-out infinite' }} />

{/* Firm Infinite Scroll – seamless marquee */}
<div className="w-full flex justify-center mb-12">

  {/* VIEWPORT */}
  <div
    className="relative overflow-hidden"
    style={{
      width: "900px",
      maxWidth: "100%",
    }}
  >
    <style>
      {`
        @keyframes firmScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-268px * ${firms.length})); }
        }
      `}
    </style>

    {/* Fade edges */}
    <div
      className="absolute inset-0 z-10 pointer-events-none"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
    />

    {/* SCROLLING TRACK — two identical sets back-to-back for seamless loop */}
    <div
      className="flex whitespace-nowrap"
      style={{
        animation: "firmScroll 20s linear infinite",
        width: `${268 * firms.length * 2}px`,
      }}
    >
      {[...firms, ...firms].map((firm, index) => (
        <div
          key={index}
          className="flex items-center justify-center gap-3 flex-shrink-0"
          style={{ width: "220px", marginRight: "48px" }}
        >
          <img
            src={firm.logo}
            alt={firm.name}
            className="w-12 h-10 grayscale"
            style={{
              border: "1.5px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "6px",
            }}
          />
          <span className="text-white text-lg font-medium" style={{ marginRight: '18px' }}>
            {firm.name}
          </span>
        </div>
      ))}
    </div>
  </div>
</div>

          {/* Pricing Section */}
          <div ref={pricingRef} style={{ scrollMarginTop: NAVBAR_HEIGHT + 52, marginTop: '48px' }} className="flex flex-col items-center mb-6">
            <span
              className="flex items-center justify-center h-9 px-4 bg-[#94bba3]/20 border border-white/15 rounded-full text-white font-medium text-sm shadow mb-8 mt-2"
              style={{
                cursor: 'default',
                userSelect: 'none',
                transition: 'none'
              }}
            >
              Plans
            </span>
            {/* Subtitle above Pro Plan */}
            <div className="mb-2">
              <span className="block text-center text-white text-2xl md:text-4xl font-extrabold" style={{ color: '#fff', fontWeight: 800 }}>
                <span style={{ color: '#94bba3', filter: 'drop-shadow(0 0 6px #94bba3)', fontSize: '0.75em', display: 'inline-block', transform: 'translateY(-0.18em)', marginRight: '0.3em' }}>⧼</span>
                Choose the plan that matches your needs<span style={{ color: '#94bba3', filter: 'drop-shadow(0 0 6px #94bba3)', fontSize: '0.75em', display: 'inline-block', transform: 'translateY(-0.18em)', marginLeft: '0.3em' }}>⧽</span>
              </span>
              <span className="block text-center text-white/80 text-lg font-normal mt-1 mb-6">
                Select the plan tailored to your trading setup and usage level
              </span>
              <div style={{ width: '400px', height: '1px', background: 'rgba(255, 255, 255, 0.2)', margin: '24px auto', borderRadius: '2px' }} />
            </div>
            {/* Trade Journaling Card - Outside Grid */}
            <div className="w-full max-w-5xl px-2 md:px-6 mb-16 md:scale-110">
              <div className="flex flex-col h-full">
                <div className="border border-white/20 rounded-lg p-4 h-full flex flex-col shadow-[0_0_20px_2px_rgba(148,187,163,0.5)]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-[#94bba3]">Trade Journaling</h3>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-white">$0</span>
                      <span className="text-sm text-white/70">/month</span>
                    </div>
                  </div>
                  <ul className="text-sm text-white/90 space-y-1 mb-4 flex-1">
                    <li className="flex items-center gap-2"><span className="text-[#94bba3]">✓</span>Manual Trade Input</li>
                    <li className="flex items-center gap-2"><span className="text-[#94bba3]">✓</span>Statistics & In depth Trade Journaling</li>
                  </ul>
                  <button
                    onClick={() => navigate('/auth/signup')}
                    className="w-full font-medium py-1 px-4 rounded-md transition-colors bg-[#94bba3] hover:bg-[#94bba3]/90 text-black"
                  >
                    Join for free here
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl mt-4 px-2 md:px-6">
              {/* Basic Plan Card with Add On */}
              <div className="flex flex-col h-full gap-4">
                {/* Basic Plan Card */}
                <div className="flex flex-col h-full gap-0">
                  <div className="border border-slate-500/50 shadow-[0_0_16px_1.5px_rgba(148,163,184,0.3)] rounded-lg p-4 h-full flex flex-col bg-black">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-slate-500">Journal Add On</h3>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold text-white">$5</span>
                        <span className="text-sm text-white/70">/month</span>
                      </div>
                    </div>
                    <ul className="text-sm text-white/90 space-y-1 mb-4 flex-1">
                      <li className="flex items-center gap-2"><span className="text-slate-500">✓</span>Automatic trade syncing</li>
                    
                    </ul>
                    <button
                      onClick={() => navigate('/auth/signup')}
                      className="w-full font-medium py-1 px-4 rounded-md transition-colors border border-white/20 text-white/80 hover:bg-white/10 relative overflow-hidden group"
                    >
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{
                          filter: 'drop-shadow(0 0 3px rgba(148,163,184,0.8))'
                        }}
                      >
                        <rect
                          x="0.5"
                          y="0.5"
                          width="calc(100% - 1px)"
                          height="calc(100% - 1px)"
                          fill="none"
                          stroke="rgba(148, 163, 184, 0.8)"
                          strokeWidth="1.5"
                          strokeDasharray="50 460"
                          strokeDashoffset="0"
                          className="animate-addon-stroke-sm"
                          rx="6"
                        />
                      </svg>
                      Get Access
                    </button>
                  </div>
                </div>
                {/* Add On Card */}
                <div className="flex flex-col h-full gap-0">
                
                  <div className="border border-slate-500/50 shadow-[0_0_16px_1.5px_rgba(148,163,184,0.3)] rounded-lg p-4 h-full flex flex-col bg-black">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-slate-500">Backtest Add On</h3>
                      <span className="text-xs font-semibold px-3 py-1 bg-slate-500/20 border border-slate-500/50 rounded-full text-slate-400">Soon</span>
                    </div>
                    <ul className="text-sm text-white/90 space-y-1 mb-4 flex-1">
                      <li className="flex items-center gap-2"><span className="text-slate-500">✓</span><span style={{ filter: 'blur(4px)' }}>Backtesting Software</span></li>
                    </ul>
                    <button
                      onClick={() => navigate('/auth/signup')}
                      className="w-full font-medium py-1 px-4 rounded-md transition-colors border border-white/20 text-white/80 hover:bg-white/10 relative overflow-hidden group"
                    >
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{
                          filter: 'drop-shadow(0 0 3px rgba(148,163,184,0.8))'
                        }}
                      >
                        <rect
                          x="0.5"
                          y="0.5"
                          width="calc(100% - 1px)"
                          height="calc(100% - 1px)"
                          fill="none"
                          stroke="rgba(148, 163, 184, 0.8)"
                          strokeWidth="1.5"
                          strokeDasharray="50 460"
                          strokeDashoffset="0"
                          className="animate-addon-stroke-sm"
                          rx="6"
                        />
                      </svg>
                      Get Access
                    </button>
                  </div>
                </div>
              </div>
              {/* Trade Copier Card */}
              <div className="flex flex-col h-full md:scale-110 z-10 bg-black">
                <div className="flex flex-col h-full">
                  <div className="border border-white/20 rounded-lg p-4 h-full flex flex-col shadow-[0_0_20px_2px_rgba(148,187,163,0.5)]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-[#94bba3]">Trade Copier</h3>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold text-white">$29</span>
                        <span className="text-sm text-white/70">/month</span>
                      </div>
                    </div>
                    <ul className="text-sm text-white/90 space-y-1 mb-4 flex-1">
                      <li className="flex items-center gap-2"><span className="text-[#94bba3]">✓</span>Trade Journaling</li>
                      <li className="flex items-center gap-2"><span className="text-[#94bba3]">✓</span>Automatic trade syncing</li>     
                      <li className="flex items-center gap-2"><span className="text-[#94bba3]">✓</span>Copy <span className="text-[#94bba3] font-bold drop-shadow-[0_0_6px_#94bba3]">unlimited Accounts</span></li>
                    </ul>
                    <button
                      onClick={() => navigate('/auth/signup')}
                      className="w-full font-medium py-1.5 px-3 rounded-md transition-colors bg-[#94bba3] hover:bg-[#94bba3]/90 text-black text-sm"
                    >
                      Get Access
                    </button>
                  </div>
                </div>
              </div>
              {/* Pro+ Plan Card */}
              <div className="flex flex-col h-full">
                <h4 className="text-lg font-semibold text-center text-white mb-1"></h4>
                <p className="text-sm text-white/80 text-center mb-0"></p>
                <p className="text-sm text-white/80 text-center mb-3"></p>
                <div className="border border-white/20 rounded-lg p-4 h-full flex flex-col bg-black relative overflow-hidden">
                  <div 
                    className="absolute opacity-30"
                    style={{
                      backgroundImage: `
                        linear-gradient(rgba(148, 187, 163, 0.3) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(148, 187, 163, 0.3) 1px, transparent 1px)
                      `,
                      backgroundSize: '40px 40px',
                      top: 0,
                      left: '-1rem',
                      right: '-1rem',
                      height: '80%'
                    }}
                  />
                  <div className="flex-1 flex items-center justify-center mb-4 relative z-10 w-full">
                    {/* Animated Star with Glowing Outline Dot */}
                    <svg viewBox="0 0 140 150" className="relative w-52 h-52">
                      <defs>
                        <filter id="starDotGlow">
                          <feGaussianBlur stdDeviation="4" result="blur1" />
                          <feGaussianBlur stdDeviation="8" result="blur2" />
                          <feMerge>
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Faint star outline — shifted down by 10 */}
                      <polygon
                        points="70,25 79.5,58 114,58 86,78 95.5,111 70,92 44.5,111 54,78 26,58 60.5,58"
                        fill="none"
                        stroke="rgba(148, 187, 163, 0.12)"
                        strokeWidth="1"
                        strokeLinejoin="round"
                      />

                      {/* Glowing outline dot tracing the star path */}
                      <circle r="5" fill="none" stroke="#94bba3" strokeWidth="1.5" filter="url(#starDotGlow)" opacity="1">
                        <animateMotion
                          dur="4s"
                          repeatCount="indefinite"
                          path="M70,25 L79.5,58 L114,58 L86,78 L95.5,111 L70,92 L44.5,111 L54,78 L26,58 L60.5,58 Z"
                        />
                      </circle>

                      {/* Trailing comet tail */}
                      <circle r="3" fill="none" stroke="#94bba3" strokeWidth="1" opacity="0.4" filter="url(#starDotGlow)">
                        <animateMotion
                          dur="4s"
                          repeatCount="indefinite"
                          begin="-0.08s"
                          path="M70,25 L79.5,58 L114,58 L86,78 L95.5,111 L70,92 L44.5,111 L54,78 L26,58 L60.5,58 Z"
                        />
                      </circle>
                      <circle r="2" fill="none" stroke="#94bba3" strokeWidth="0.8" opacity="0.2" filter="url(#starDotGlow)">
                        <animateMotion
                          dur="4s"
                          repeatCount="indefinite"
                          begin="-0.16s"
                          path="M70,25 L79.5,58 L114,58 L86,78 L95.5,111 L70,92 L44.5,111 L54,78 L26,58 L60.5,58 Z"
                        />
                      </circle>

                      {/* Spark particles at star points — shifted down by 10 */}
                      <circle cx="114" cy="58" r="1.5" fill="#94bba3" filter="url(#starDotGlow)">
                        <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.5s" repeatCount="indefinite" />
                        <animate attributeName="r" values="0.5;2.5;0.5" dur="2s" begin="0.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="26" cy="58" r="1.5" fill="#94bba3" filter="url(#starDotGlow)">
                        <animate attributeName="opacity" values="0;1;0" dur="2.2s" begin="1s" repeatCount="indefinite" />
                        <animate attributeName="r" values="0.5;2.5;0.5" dur="2.2s" begin="1s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="95.5" cy="111" r="1.5" fill="#94bba3" filter="url(#starDotGlow)">
                        <animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
                        <animate attributeName="r" values="0.5;2;0.5" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="44.5" cy="111" r="1.5" fill="#94bba3" filter="url(#starDotGlow)">
                        <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.5s" repeatCount="indefinite" />
                        <animate attributeName="r" values="0.5;2;0.5" dur="2.4s" begin="1.5s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="70" cy="25" r="1.5" fill="#94bba3" filter="url(#starDotGlow)">
                        <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.8s" repeatCount="indefinite" />
                        <animate attributeName="r" values="0.5;3;0.5" dur="2s" begin="0.8s" repeatCount="indefinite" />
                      </circle>
                    </svg>

                    {/* Logo - centered in the middle */}
                    <img src={Logo} alt="Pro+" className="h-48 w-20 object-contain absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    onClick={() => navigate('/auth/signup')}
                    className="w-full font-medium py-1 px-4 rounded-md transition-colors border border-white/20 text-white/80 hover:bg-white/10 relative overflow-hidden group z-10 flex items-center justify-center gap-2"
                  >
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{
                        filter: 'drop-shadow(0 0 3px rgba(148,187,163,0.8))'
                      }}
                    >
                      <rect
                        x="0.5"
                        y="0.5"
                        width="calc(100% - 1px)"
                        height="calc(100% - 1px)"
                        fill="none"
                        stroke="rgba(148, 187, 163, 0.8)"
                        strokeWidth="1.5"
                        strokeDasharray="50 510"
                        strokeDashoffset="0"
                        className="animate-addon-stroke-lg"
                        rx="6"
                      />
                    </svg>
                  Upgrade your Trading <Zap size={20} style={{ color: '#94bba3' }} className="relative z-20" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Contact Button and Section */}
                    {/* Insights Section above Contact */}
                    <div style={{ scrollMarginTop: NAVBAR_HEIGHT + 52, marginTop: '48px' }} className="flex flex-col items-center mb-8">
                      <span style={{paddingTop: '48px'}}></span>
                      <span
                        className="flex items-center justify-center h-9 px-4 bg-[#94bba3]/20 border border-white/15 rounded-full text-white font-medium text-sm shadow mb-8 mt-2"
                        style={{
                          cursor: 'default',
                          userSelect: 'none',
                          transition: 'none'
                        }}
                      >
                        Insights
                      </span>
                      {/* Subtitle below Insights button */}
                      <div className="mb-2">
                        <span className="block text-center text-white text-2xl md:text-4xl font-extrabold" style={{ color: '#fff', fontWeight: 800 }}>
                          <span style={{ color: '#94bba3', filter: 'drop-shadow(0 0 6px #94bba3)', fontSize: '0.75em', display: 'inline-block', transform: 'translateY(-0.18em)', marginRight: '0.3em' }}>⧼</span>
                          Take a peek at what our Trading-Allrounder can do<span style={{ color: '#94bba3', filter: 'drop-shadow(0 0 6px #94bba3)', fontSize: '0.75em', display: 'inline-block', transform: 'translateY(-0.18em)', marginLeft: '0.3em' }}>⧽</span>
                        </span>
                        <span className="block text-center text-white/80 text-lg font-normal mt-1 mb-2">
                          From performance insights & statistics to indetph trade anaylsis with Notes and Screenshot. <br />Keep track of your actual trading returns form a business perspective with expenses & xarnings tracker. <br />Powerful trade copying software Interface
                        </span>
                      </div>
                      <div style={{ paddingBottom: '32px' }}></div>
               
                        <div ref={insightsRef} style={{ scrollMarginTop: NAVBAR_HEIGHT + 52 }} className="w-full flex justify-center mb-8">
                        <div className="w-full max-w-6xl px-4">
                          {/* Navigation Buttons */}
                          <div className="flex justify-center gap-6 mb-8">
                            {[
                              { id: 'dashboard', label: 'Dashboard', icon: Home },
                              { id: 'logbook', label: 'Trade Logbook', icon: Crosshair },
                              { id: 'operational', label: 'Operational', icon: User },
                              { id: 'copier', label: 'Trade Copier', icon: GitFork }
                            ].map((btn, idx) => {
                              const BtnIcon = btn.icon;
                              const isActive = carouselIndex === idx;
                              return (
                                <div key={btn.id} className="flex flex-col items-center">
                                  <button
                                    onClick={() => setCarouselIndex(idx)}
                                    className={`
                                      w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group relative
                                      ${isActive
                                        ? 'bg-gradient-to-b from-[rgba(148,187,163,0.8)] to-[rgba(255, 255, 255, 0.8)] text-white shadow-[0_0_10px_2px_rgba(148,187,163,0.4)] border border-[rgba(148,187,163,0.8)]'
                                        : 'bg-transparent text-white/80 hover:text-white border border-white/10'
                                      }
                                      hover:scale-110
                                    `}
                                    title={btn.label}
                                  >
                                    <BtnIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                                  </button>
                                  <span className="text-white/70 text-xs mt-2 text-center" style={{ width: '80px', fontSize: '11px' }}>
                                    {btn.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Images Container */}
                          <div className="relative overflow-hidden rounded-xl w-full glow-border-soft bg-black" style={{ minHeight: 400 }}>
                            <img 
                              src={carouselImages[carouselIndex].src} 
                              alt={carouselImages[carouselIndex].label} 
                              className="w-full h-full object-cover cursor-pointer" 
                              onClick={() => openLightbox(carouselImages[carouselIndex].src)} 
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openLightbox(carouselImages[carouselIndex].src)} 
                                className="inline-flex items-center gap-2 px-5 py-2 bg-black border border-white/20 rounded text-white font-semibold shadow"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94bba3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="-ml-1">
                                  <path d="M3 9v12h12" />
                                  <path d="M21 15V3H9" />
                                  <path d="M21 3l-7 7" />
                                </svg>
                                Open full view
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
          <div ref={contactRef} style={{ scrollMarginTop: NAVBAR_HEIGHT + 52 }} className="flex flex-col items-center mb-6">
            {/* Contact Button */}
            <span style={{paddingTop: '48px'}}></span>
            <span
              className="flex items-center justify-center h-9 px-4 bg-[#94bba3]/20 border border-white/15 rounded-full text-white font-medium text-sm shadow mb-3"
              style={{
                cursor: 'default',
                userSelect: 'none',
                transition: 'none'
              }}
            >
              Contact
            </span>
            {/* Contact Info */}
            <span className="text-white/80 text-center text-base md:text-lg max-w-xl">
              For partnership requests or support get in touch via<br />
              <span className="font-semibold text-white">Email: apptradescale@gmail.com</span>
            </span>
            {/* Mail Card Button (moved below contact info) */}
            <button
              className="flex items-center justify-center border border-white/20 bg-transparent rounded-lg px-6 py-3 mt-4 shadow transition hover:border-[#94bba3]"
              style={{ minWidth: 64, minHeight: 48 }}
              onClick={() => window.location = 'mailto:apptradescale@gmail.com'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28" height="28" viewBox="0 0 24 24"
                fill="none"
                stroke="#94bba3"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 6px #94bba3)' }}
              >
                <rect x="3" y="5" width="18" height="14" rx="3" fill="none" />
                <polyline points="3.5 6.5,12 13.5,20.5 6.5" />
              </svg>
            </button>
          </div>
          <div className="h-0"></div>
          {/* Lightbox modal for A images */}
          {lightboxOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={closeLightbox}>
              <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <button onClick={closeLightbox} className="absolute -top-3 -right-3 bg-black/60 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl">×</button>
                <img src={lightboxImage ?? ''} alt="Preview" className="block max-h-[90vh] max-w-[90vw] object-contain rounded" />
              </div>
            </div>
          )}
        </main>
      </div>
      <style>{`
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { display: none; }
        body { -ms-overflow-style: none; scrollbar-width: none; }
        .glow-border {
          box-shadow: 0 0 32px 2px rgba(148, 187, 163, 0.35), 0 0 0 2px rgba(255,255,255,0.08);
          transition: box-shadow 0.3s;
        }
        .glow-border:hover {
          box-shadow: 0 0 32px 2px rgba(148, 187, 163, 0.35), 0 0 0 3px rgba(255,255,255,0.08);
        }
        .glow-border-soft {
          box-shadow: 0 0 16px 1px rgba(148, 187, 163, 0.175), 0 0 0 1px rgba(255,255,255,0.04);
          transition: box-shadow 0.3s;
        }
        .glow-border-soft:hover {
          box-shadow: 0 0 16px 1px rgba(148, 187, 163, 0.175), 0 0 0 2px rgba(255,255,255,0.04);
        }
        /* Animated outline around the free tools pill */
        .animated-pill { overflow: hidden; }
        .animated-pill .pill-outline {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .animated-pill .pill-outline rect {
          stroke: ${ACCENT};
          stroke-width: 2;
          stroke-linecap: butt;
          filter: drop-shadow(0 0 4px ${ACCENT}55);
          /* Single moving highlight segment around a rectangular outline */
          stroke-dasharray: 40 216; /* 40px segment, 216px gap → total ≈ 256px perimeter */
          stroke-dashoffset: 0;
          animation: pillStroke 3.2s linear infinite;
        }
        @keyframes pillStroke {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -256; }
        }
        @keyframes glowPulse {
          0% { box-shadow: 0 0 8px #94bba3, 0 0 16px rgba(148, 187, 163, 0.4); }
          50% { box-shadow: 0 0 16px #94bba3, 0 0 32px rgba(148, 187, 163, 0.8); }
          100% { box-shadow: 0 0 8px #94bba3, 0 0 16px rgba(148, 187, 163, 0.4); }
        }
        @keyframes addonStrokeSm {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -510; }
        }
        .animate-addon-stroke-sm {
          animation: addonStrokeSm 2.8s linear infinite;
        }
        @keyframes addonStrokeLg {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -560; }
        }
        .animate-addon-stroke-lg {
          animation: addonStrokeLg 3.2s linear infinite;
        }
      `}</style>
<footer className="w-full bg-black py-8 mt-12">
  <div className="mx-auto px-2 max-w-xl flex flex-col items-center text-center">
    {/* Centered line */}
    <div
      style={{
        width: '400px',
        height: '1px',
        background: 'rgba(255, 255, 255, 0.2)',
        margin: '0 auto 24px auto',
        borderRadius: '2px',
      }}
    />
    <span className="text-white/80 text-sm mb-4">
      <strong>Risk Disclosure:</strong> <br /> Trading futures, options, and forex involves substantial risk of loss and is not suitable for all investors. Past performance is not necessarily indicative of future results. You should carefully consider whether trading is appropriate for you in light of your financial condition, experience, and risk tolerance. Only risk capital should be used for trading and only those with sufficient risk capital should consider trading. Tradescale Group does not guarantee any profits or freedom from loss. All information and tools provided are for educational purposes only and do not constitute investment advice.
    </span>
    <span className="text-white/40 text-xs mt-2">
      &copy; {new Date().getFullYear()} Tradescale Group. All rights reserved.
    </span>
  </div>
      </footer>
      </div>
    </>
  );
}