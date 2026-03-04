import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/FAuth';
import { Helmet } from 'react-helmet-async';
import Logo from '@/assets/images/lg34.png';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const topRef = useRef<HTMLDivElement>(null);

  // Force dark mode on landing page
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
        <meta name='description' content='Advanced trading Journal completely for free & other features available for professional traders. The most advanced tools for traders built for professional performance.' />
        <meta name='keywords' content='trading journal, futures trading, trade copier, trading tools, professional trading' />
        <meta property='og:title' content='Tradescale - Advanced Trading Tools for Professional Traders' />
        <meta property='og:description' content='Advanced trading Journal completely for free & other features available for professional traders. The most advanced tools for traders built for professional performance.' />
        <meta property='og:type' content='website' />
        <meta property='og:url' content='https://tradescale.vercel.app/' />
        <meta property='og:site_name' content='Tradescale' />
        <meta name='twitter:card' content='summary_large_image' />
        <meta name='twitter:title' content='Tradescale - Advanced Trading Tools for Professional Traders' />
        <meta name='twitter:description' content='Advanced trading Journal completely for free & other features available for professional traders. The most advanced tools for traders built for professional performance.' />
        <meta name='robots' content='index, follow' />
        <meta name='author' content='Tradescale Group' />
        <link rel='canonical' href='https://tradescale.vercel.app/' />
      </Helmet>
      
      <div className='min-h-screen bg-black text-white relative overflow-hidden'>
        {/* Animated Background */}
        <div className='absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20'>
          <div className='absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse'></div>
          <div className='absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000'></div>
          <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-full blur-3xl animate-pulse delay-500'></div>
        </div>

        {/* Navigation */}
        <nav className='relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto'>
          <div className='flex items-center gap-2'>
            <img src={Logo} alt='Tradescale Logo' className='h-8 w-10' />
            <span className='text-xl font-bold'>Tradescale</span>
          </div>
          
          <div className='hidden md:flex items-center gap-8'>
            <button className='text-white/80 hover:text-white transition-colors'>Home</button>
            <button className='text-white/80 hover:text-white transition-colors'>Insights</button>
            <button className='text-white/80 hover:text-white transition-colors'>Contact</button>
            <Button
              className='bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors'
              onClick={() => navigate('/auth/signup')}
            >
              Sign up
            </Button>
            <Button
              className='bg-transparent border border-white text-white px-4 py-2 rounded-lg hover:bg-white hover:text-black transition-colors'
              onClick={() => navigate('/auth/signin')}
            >
              Sign in
            </Button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className='relative z-10 px-8 py-20 max-w-7xl mx-auto text-center'>
          <div className='max-w-4xl mx-auto'>
            <h1 className='text-5xl md:text-7xl font-bold mb-6'>
              <span className='bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent'>
                Tradescale
              </span>
              <br />
              <span className='text-4xl md:text-6xl text-white'>
                Advanced Trading Platform
              </span>
            </h1>
            <p className='text-xl text-white/80 mb-8 max-w-2xl mx-auto'>
              The most comprehensive trading journal and trade copier software for professional futures traders. Track, analyze, and copy trades seamlessly.
            </p>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <Button
                className='bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-3 rounded-lg text-lg hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105'
                onClick={() => navigate('/auth/signup')}
              >
                Start Free Trial
              </Button>
              <Button
                className='bg-transparent border border-white text-white px-8 py-3 rounded-lg text-lg hover:bg-white hover:text-black transition-all'
                onClick={() => navigate('/auth/signin')}
              >
                Sign In
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className='relative z-10 px-8 py-20 max-w-7xl mx-auto'>
          <div className='text-center mb-16'>
            <h2 className='text-4xl font-bold mb-4'>
              <span className='bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent'>
                Powerful Features
              </span>
            </h2>
            <p className='text-xl text-white/80 max-w-2xl mx-auto'>
              Everything you need to take your trading to the next level
            </p>
          </div>

          <div className='grid md:grid-cols-3 gap-8'>
            {/* Feature Card 1 */}
            <div className='bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all'>
              <div className='w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mb-4'></div>
              <h3 className='text-xl font-semibold mb-2'>Trade Journal</h3>
              <p className='text-white/80'>
                Comprehensive trade logging with detailed analytics and performance tracking. Manual and automatic trade entry.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className='bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all'>
              <div className='w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mb-4'></div>
              <h3 className='text-xl font-semibold mb-2'>Trade Copier</h3>
              <p className='text-white/80'>
                Copy trades between multiple accounts instantly. Support for all major prop firms and trading platforms.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className='bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all'>
              <div className='w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg mb-4'></div>
              <h3 className='text-xl font-semibold mb-2'>Analytics</h3>
              <p className='text-white/80'>
                Deep insights into your trading performance with advanced statistics and customizable reports.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className='relative z-10 px-8 py-20 max-w-7xl mx-auto text-center'>
          <div className='bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-lg border border-white/10 rounded-xl p-12'>
            <h2 className='text-4xl font-bold mb-4'>
              Ready to Transform Your Trading?
            </h2>
            <p className='text-xl text-white/80 mb-8 max-w-2xl mx-auto'>
              Join thousands of traders who have already elevated their trading game with Tradescale.
            </p>
            <Button
              className='bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-3 rounded-lg text-lg hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105'
              onClick={() => navigate('/auth/signup')}
            >
              Get Started Free
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className='relative z-10 border-t border-white/10 px-8 py-12'>
          <div className='max-w-7xl mx-auto text-center'>
            <p className='text-white/60'>
              © 2024 Tradescale Group. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
