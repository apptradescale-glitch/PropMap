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
    return () => {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
      document.body.style.margin = '';
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
              style={{ border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px' }}
            />
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Tradescale
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