import UserAuthForm from './components/user-auth-form';
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logoImage from '@/assets/images/lg34.png';
import { Card, CardContent } from '@/components/ui/card';

export default function SignInPage() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#000';
    document.body.style.margin = '0';
    
    // Add custom styles to override greenish colors
    const style = document.createElement('style');
    style.textContent = `
      /* Override button hover and focus colors */
      button:hover {
        background-color: rgba(255, 255, 255, 0.1) !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
      }
      button:focus {
        background-color: rgba(255, 255, 255, 0.15) !important;
        border-color: rgba(255, 255, 255, 0.4) !important;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2) !important;
      }
      
      /* Override input focus colors */
      input:focus {
        border-color: rgba(255, 255, 255, 0.4) !important;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2) !important;
        outline: none !important;
      }
      
      /* Override any green accent colors */
      .ring-green-500,
      .border-green-500,
      .bg-green-500,
      .text-green-500 {
        border-color: rgba(255, 255, 255, 0.4) !important;
        color: rgba(255, 255, 255, 0.8) !important;
        background-color: rgba(255, 255, 255, 0.1) !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Card with login content */}
      <Card className="relative z-10 w-full max-w-[600px]">
        <CardContent className="flex flex-col items-center justify-center space-y-6 p-6">
          <div className="flex flex-col items-center space-y-2">
            <img 
              src={logoImage} 
              alt="Logo" 
              className="h-24 w-auto"
              style={{ border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', marginBottom: '16px' }}
            />
            <div className="flex flex-col space-y-2 text-center">
              <h1 style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.04em',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}>
                PROP<span style={{ fontSize: 11, fontWeight: 400, verticalAlign: 'sub', marginLeft: 1, opacity: 0.7, position: 'relative', top: 2 }}>MAP</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Login with your credentials to continue
              </p>
            </div>
          </div>

       <UserAuthForm />
          
          <div className="space-y-4 text-center text-sm text-gray-400">
            <p>
              Sign up to Tradescale | {' '}
              <Link
                to="/auth/signup"
                className="underline underline-offset-4 hover:text-white"
                style={{ color: '#e5e5e5' }}
              >
                Create Account
              </Link>
            </p>
            
    <p className="px-8">
  By clicking Create Account, you agree to our{' '}
  <Link
    to="/terms"
    className="underline underline-offset-4 hover:text-white"
    style={{ color: '#e5e5e5' }}
  >
    Terms of Service
  </Link>
  {' '}and{' '}
  <Link
    to="/policy"
    className="underline underline-offset-4 hover:text-white"
    style={{ color: '#e5e5e5' }}
  >
    Privacy Policy
  </Link>
  .
    </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}