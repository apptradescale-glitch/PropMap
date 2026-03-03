import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase'; // adjust if needed
import { Card, CardContent } from '@/components/ui/card';
import { ParticlesBackground } from '@/components/shared/ParticlesBackground';
import logoImage from '@/assets/images/lg34.png';
import { Link } from 'react-router-dom';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
    setLoading(false);
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Particles in the background */}
      <div className="absolute inset-0 z-0">
        <ParticlesBackground />
      </div>

      {/* Card with reset content */}
      <Card className="relative z-10 w-full max-w-[600px]">
        <CardContent className="flex flex-col items-center justify-center space-y-6 p-6">
          <div className="flex flex-col items-center space-y-2">
            <img 
              src={logoImage} 
              alt="Logo" 
              className="h-24 w-auto"
            />
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Tradescale
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email to receive a password reset link.
              </p>
            </div>
          </div>

          {sent ? (
        <div
  className="w-full border border-white/15 rounded px-4 py-3 text-center text-[#94bba3] bg-transparent mt-2"
>
  Reset email sent | Check your inbox.
</div>
          ) : (
     <form onSubmit={handleSubmit} className="w-[400px] space-y-4">
  <div>
    <label className="ml-1 block text-sm font-medium">Email</label>
    <Input
      type="email"
      placeholder="Enter email"
      disabled={loading}
      className="border-white/15 focus-visible:ring-[#94bba3]/30 focus-visible:ring-1 focus-visible:ring-offset-0"
      value={email}
      onChange={e => setEmail(e.target.value)}
      required
    />
    {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
  </div>
  <div className="flex justify-center">
    <Button
      disabled={loading}
      type="submit"
      className="h-9 px-6 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
    >
      {loading ? (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : "Send Reset Password"}
    </Button>
  </div>
</form>
          )}

          <div className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              Back to{' '}
              <Link
                to="/auth/signin"
                className="underline underline-offset-4 hover:text-white"
              >
                Sign In
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}