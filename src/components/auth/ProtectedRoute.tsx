import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/FAuth';
import { ParticlesBackground } from '@/components/shared/ParticlesBackground';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ENSURE_SUBSCRIPTION_URL = '/api/subscription/ensure';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureBaselineSubscriptionDoc() {
    const token = await currentUser?.getIdToken();
    if (!token) throw new Error('Unable to get Firebase token');

    const response = await fetch(ENSURE_SUBSCRIPTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to ensure subscription record');
    }
  }

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let mounted = true;
    const checkSubscription = async () => {
      if (checkingSubscription) return;

      setCheckingSubscription(true);
      setError(null);

      try {
        await ensureBaselineSubscriptionDoc();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Subscription check failed');
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  if (!currentUser && !loading) {
    return <Navigate to="/auth/signin" />;
  }

  if (loading || checkingSubscription) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;