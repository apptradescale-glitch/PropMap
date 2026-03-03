import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/FAuth';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { ParticlesBackground } from '@/components/shared/ParticlesBackground';
import logoImage from '@/assets/images/lg34.png';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { app } from '@/config/firebase';

type SubscriptionRecord = {
  userId?: string;
  status: string;
  active?: boolean;
  subscriptionType?: 'basic' | 'pro' | 'proplus';
  firstPaymentDate?: string;
  cancelAtPeriodEnd?: boolean;
  endDate?: string;
  stripeCustomerId?: string;
  hasSubscription?: boolean;
  subscriptionStatus?: string;
  paymentStatus?: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  isTrialing?: boolean;
  trialEndDate?: string;
};

type PlanId = 'basic' | 'pro' | 'proplus';

function planRank(plan: PlanId): number {
  switch (plan) {
    case 'basic':
      return 1;
    case 'pro':
      return 2;
    case 'proplus':
      return 3;
  }
}

interface ProtectedRouteForFeaturesProps {
  children: React.ReactNode;
  requiresSubscription?: readonly PlanId[];
}

const ProtectedRouteForFeatures: React.FC<ProtectedRouteForFeaturesProps> = ({ children, requiresSubscription }) => {
  const { currentUser, loading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [subscriptionCheckNonce, setSubscriptionCheckNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPostPaymentLoading, setIsPostPaymentLoading] = useState(false);
  const [trialMode, setTrialMode] = useState<'free-trial' | 'already-used'>('already-used');
  const [isFraudDetected, setIsFraudDetected] = useState(false);
  const [hasAutoTradeSync, setHasAutoTradeSync] = useState(false);
  const [hasTradecopier, setHasTradecopier] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [freePlanData, setFreePlanData] = useState<{ userId: string; freedefalutl: boolean } | null>(null);

  // ✅ FIX: Remove hardcoded subscription type - we'll check properly below

  function CenteredSpinnerLoader() {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-transparent z-50">
        <img src={logoImage} alt="Loading" className="w-24 h-24 object-contain" />
      </div>
    );
  }

  const ENSURE_SUBSCRIPTION_URL = '/api/subscription/ensure';
  const canSubscribe = true;

  const [searchParams] = useSearchParams();

  async function isAdminUser(): Promise<boolean> {
    if (!currentUser) return false;
    const tokenResult = await currentUser.getIdTokenResult();
    return tokenResult?.claims?.admin === true;
  }

  async function ensureBaselineSubscriptionDoc(): Promise<void> {
    if (!currentUser) return;
    const token = await currentUser.getIdToken();
    await fetch(ENSURE_SUBSCRIPTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  // ✅ NEW: Handle payment success redirect
  useEffect(() => {
    const handlePaymentSuccess = async () => {
      const paymentStatus = searchParams.get('payment');
      const sessionId = searchParams.get('session_id');

      if (paymentStatus === 'success' && sessionId && currentUser?.uid) {
        setIsPostPaymentLoading(true); // Show loader while processing
        
        try {
          // Call the check-subscription API to save subscription data to Firestore
          const authToken = await currentUser.getIdToken();
          const response = await fetch('/api/stripe/payments', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              userId: currentUser.uid,
              action: 'check-subscription',
              sessionId: sessionId
            })
          });

          const result = await response.json();
        

          if (result.active) {
      
            
            // Clear URL parameters after successful processing
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
            
            // Reset states and force re-check subscription after saving
            setHasAccess(false); // Reset access state
            setSubscriptionChecked(false);
            setSubscriptionCheckNonce((n) => n + 1);
          } else {
          
          }
        } catch (error) {
       
        } finally {
          // Don't hide loader yet - wait until subscription is actually loaded (hasAccess determined)
          // The loader will be hidden when hasAccess becomes true or timeout occurs
        }
      }
    };


    handlePaymentSuccess();
  }, [searchParams, currentUser?.uid]);

  // ✅ Hide post-payment loader once subscription is actually loaded
  useEffect(() => {
    if (isPostPaymentLoading && hasAccess) {
      setIsPostPaymentLoading(false);
    }
  }, [isPostPaymentLoading, hasAccess]);

  // Reset subscription check state when user changes.
  useEffect(() => {
    setSubscriptionChecked(false);
    setHasAccess(false);
    setError(null);
  }, [currentUser?.uid]);

  // When freePlanData is loaded, re-evaluate access for REQUIRES_NONE routes
  useEffect(() => {
    if (freePlanData && subscriptionData && (!requiresSubscription || requiresSubscription.length === 0)) {
      // Re-evaluate access with fresh freePlanData
      if (subscriptionData.subscriptionType && (subscriptionData.subscriptionType === 'basic' || subscriptionData.subscriptionType === 'pro' || subscriptionData.subscriptionType === 'proplus')) {
        const isActive = subscriptionData.status === 'active' || subscriptionData.status === 'trialing';
        if (isActive) {
          setHasAccess(true);
          return;
        }
      }
      // Check free plan flag
      setHasAccess(freePlanData.freedefalutl === true);
    }
  }, [freePlanData, subscriptionData, requiresSubscription]);

  // Show modal when access is denied (but don't hide it just because access is granted)
  useEffect(() => {
    if (subscriptionChecked && !hasAccess) {
      setShowModal(true);
    }
  }, [hasAccess, subscriptionChecked]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const checkSubscription = async () => {      
      try {
        if (checkingSubscription) return;
        setCheckingSubscription(true);
        setError(null);

        const userId = currentUser?.uid;

        if (!userId) {
         
          setHasAccess(false);
          return;
        }

        // Ensure baseline subscription doc exists (safe placeholder).
        await ensureBaselineSubscriptionDoc();

        // Admin bypass logic (Firebase custom claim: { admin: true })
        if (await isAdminUser()) {
          setHasAccess(true);
          return;
        }

        // Skip fraud detection if user already acknowledged
        const fraudAcknowledged = sessionStorage.getItem('fraudAcknowledged');
        if (!fraudAcknowledged) {
          // Fraud detection logic here
        }

        // Fetching subscription data
        
        // First get basic subscription data from Firestore to get Stripe customer ID
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/firestore-all-subscription?userId=${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
       
        // Also fetch FREEPLAN data directly from Firestore
        try {
          const db = getFirestore(app);
          const freePlanRef = doc(db, 'FREEPLAN', userId);
          const freePlanSnap = await getDoc(freePlanRef);
          
          if (freePlanSnap.exists()) {
            setFreePlanData(freePlanSnap.data() as { userId: string; freedefalutl: boolean });
          } else {
            // Initialize with default if not found
            setFreePlanData({ userId, freedefalutl: false });
          }
        } catch (err) {
          // Initialize with default if error
          setFreePlanData({ userId, freedefalutl: false });
        }

        if (!response.ok) {
        
          setHasAccess(false);
          return;
        }

        const responseData = await response.json();
      

        const basicSubscription = responseData.subscription;
     

        if (!basicSubscription) {
          setHasAccess(false);
          setSubscriptionChecked(true);
          return;
        }

        let finalSubscriptionData = basicSubscription;

        // If we have a Stripe customer ID, fetch real-time data from Stripe
        if (basicSubscription.stripeCustomerId) {
          try {
            const authToken = await currentUser.getIdToken();
            const stripeResponse = await fetch('/api/stripe/payments', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                userId,
                action: 'get-subscription-details',
                stripeCustomerId: basicSubscription.stripeCustomerId
              }),
            });
            
            if (stripeResponse.ok) {
              const stripeData = await stripeResponse.json();
              if (stripeData.success && stripeData.subscription) {
                // Combine Firestore data with real Stripe data
                finalSubscriptionData = {
                  ...basicSubscription,
                  // Override with real Stripe data (map canonical Stripe fields)
                  status: stripeData.subscription.status,
                  cancelAtPeriodEnd: !!stripeData.subscription.cancel_at_period_end,
                  // map timestamps from seconds -> Date
                  currentPeriodStart: stripeData.subscription.current_period_start
                    ? new Date(stripeData.subscription.current_period_start * 1000)
                    : null,
                  currentPeriodEnd: stripeData.subscription.current_period_end
                    ? new Date(stripeData.subscription.current_period_end * 1000)
                    : null,
                  // canceled_at (when subscription was canceled immediately)
                  canceledAt: stripeData.subscription.canceled_at
                    ? new Date(stripeData.subscription.canceled_at * 1000)
                    : null,
                  // Trial info
                  isTrialing: stripeData.subscription.status === 'trialing',
                  trialEndDate: stripeData.subscription.trial_end
                    ? new Date(stripeData.subscription.trial_end * 1000).toISOString()
                    : basicSubscription.trialEndDate,
                  // Determine if subscription is still active based on Stripe status and dates
                  hasSubscription:
                    stripeData.subscription.status === 'active' ||
                    stripeData.subscription.status === 'trialing' ||
                    (
                      stripeData.subscription.status === 'canceled' &&
                      stripeData.subscription.cancel_at_period_end &&
                      stripeData.subscription.cancel_at &&
                      Date.now() < stripeData.subscription.cancel_at * 1000
                    ),
                  subscriptionStatus:
                    stripeData.subscription.status === 'active' || stripeData.subscription.status === 'trialing'
                      ? 'complete'
                      : 'expired',
                } as any;
              }
            }
          } catch (stripeError) {
        
          }
        }

        setSubscriptionData(finalSubscriptionData);

        // ✅ Helper function to detect fraud by checking dates (fallback)
        const isFraudCancelled = (data: any) => {
          if (!data?.createdAt || !data?.endedAt) return false;
          const createdDate = new Date(data.createdAt).toDateString();
          const endedDate = new Date(data.endedAt).toDateString();
        
          return createdDate === endedDate;
        };

        // ✅ Check for fraud immediately by dates (fast path) - but skip if user already acknowledged
       
        if (isFraudCancelled(finalSubscriptionData) && !fraudAcknowledged) {
          try {
            const token = await currentUser.getIdToken();
            await fetch('/api/stripe/payments', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                action: 'fraud-block',
                userId: currentUser.uid
              })
            });
          } catch (e) {
            // Continue even if the call fails
          }
          
          setIsFraudDetected(true);
          setHasAccess(false);
          setCheckingSubscription(false);
          setSubscriptionChecked(true);
          return;
        }

        // ✅ Fallback: Check for fraud-cancelled status after 3 second delay (webhook path)
        // Only set timeout if fraud wasn't already detected in fast path and user hasn't acknowledged
        let fraudCheckTimeoutId: number | null = null;
        
        fraudCheckTimeoutId = window.setTimeout(async () => {
          const fraudAcknowledged = sessionStorage.getItem('fraudAcknowledged');
          if (fraudAcknowledged) return; // Skip if user already acknowledged
          
          try {
            const token = await currentUser.getIdToken();
            const resp = await fetch(`/api/firestore-all-subscription?userId=${userId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (resp.ok) {
              const j = await resp.json();
              const freshData = j.subscription || null;
              
              // Check if subscription was cancelled due to fraud
              if (freshData?.subscriptionStatus === 'cancelled_fraud' && !isFraudDetected) {
                setIsFraudDetected(true);
                setHasAccess(false);
                setCheckingSubscription(false);
                setSubscriptionChecked(true);
              }
            }
          } catch (e) {
            // Ignore polling errors
          }
        }, 3000);

        // Cleanup function to cancel timeout if component unmounts
        ;(checkSubscription as any)._fraudTimeoutCleanup = () => {
          if (fraudCheckTimeoutId !== null) {
            window.clearTimeout(fraudCheckTimeoutId);
          }
        };

        // Note: entitlement fields are updated server-side via Stripe webhook.

        // ✅ Subscription access logic (server-authoritative fields)
        // Robust active-subscription check using Stripe fields, timestamps, and fallbacks
        const isSubscriptionActive = (data: any) => {
          if (!data) return false;
          const now = Date.now();

          // Helper to safely convert date to timestamp
          const toTimestamp = (date: any): number | null => {
            if (!date) return null;
            if (typeof date === 'number') return date; // Already a timestamp
            if (date instanceof Date) return date.getTime();
            if (typeof date === 'string') return new Date(date).getTime();
            return null;
          };

          // Prefer explicit Stripe status
          if (data.status) {
            const activeStatuses = new Set(['active', 'trialing']);
            const inactiveStatuses = new Set(['canceled', 'incomplete_expired', 'unpaid']);
            if (activeStatuses.has(data.status)) return true;

            if (inactiveStatuses.has(data.status)) {
              // If cancel_at_period_end, remain active until current_period_end arrives
              if (data.cancelAtPeriodEnd || data.cancel_at_period_end) {
                if (data.currentPeriodEnd) {
                  const endTime = toTimestamp(data.currentPeriodEnd);
                  if (endTime !== null) {
                    const isStillActive = now < endTime;
                   
                    return isStillActive;
                  }
                }
                // Missing end timestamp -> assume still active and re-check later
                // (don't revoke access yet, as Stripe will provide exact end time in webhook/refresh)
                return true;
              }
              // Immediate cancel: use canceledAt if present
              if (data.canceledAt || data.canceled_at) {
                const end = toTimestamp(data.canceledAt || data.canceled_at);
                return end !== null ? now < end : false;
              }
              return false;
            }
          }

          // If we have a current period end timestamp, use it
          if (data.currentPeriodEnd) {
            const endTime = toTimestamp(data.currentPeriodEnd);
            if (endTime !== null) {
              return now < endTime;
            }
          }

          // If there's a canceledAt/cancel_at timestamp and it's in the past, treat as inactive
          if (data.canceledAt) {
            const endTime = toTimestamp(data.canceledAt);
            return endTime !== null ? now < endTime : false;
          }
          if (data.cancelAt) {
            const endTime = toTimestamp(data.cancelAt);
            return endTime !== null ? now < endTime : false;
          }

          // Fallback to server-side flag if present
          if (typeof data.hasSubscription === 'boolean') return data.hasSubscription;

          return false;
        };

        const computeHasAccessFrom = (data: typeof finalSubscriptionData | null) => {
          // If no subscription required, check access
          if (!requiresSubscription || requiresSubscription.length === 0) {
            // If user has a paid subscription (basic or pro), grant access immediately
            if (data?.subscriptionType && (data.subscriptionType === 'basic' || data.subscriptionType === 'pro' || data.subscriptionType === 'proplus')) {
              const isActive = isSubscriptionActive(data);
              if (isActive) {
                return true;
              }
            }
            // Otherwise, check FREEPLAN flag (for free users only)
            return freePlanData?.freedefalutl === true;
          }

          // For routes that DO require a subscription, check if user has one
          if (!data) {
            return false;
          }
          const isActive = isSubscriptionActive(data);
          
          if (!isActive) {
            return false;
          }

          // Plan entitlement check
          const userPlan = data.subscriptionType as PlanId | undefined;
          if (!userPlan) {
            return false;
          }
          const userR = planRank(userPlan);
          const allowed = requiresSubscription.some(requiredPlan => userR >= planRank(requiredPlan));
          
          return allowed;
        };

        const access = computeHasAccessFrom(finalSubscriptionData);
       
        setHasAccess(access);

        // If Firestore shows no subscription yet, poll it briefly to cover webhook latency.
        if (!finalSubscriptionData.hasSubscription) {
          let attempts = 0;
          const maxAttempts = 6; // ~12 seconds
          const intervalMs = 2000;
          let pollId: number | null = null;
          const isActive = { value: true };

          const doPoll = async () => {
            attempts++;
            try {
              const token = await currentUser.getIdToken();
              const resp = await fetch(`/api/firestore-all-subscription?userId=${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (resp.ok) {
                const j = await resp.json();
                const sub = j.subscription || null;
                if (sub && sub.hasSubscription) {
                  if (!isActive.value) return;
                  setSubscriptionData(sub);
                  setHasAccess(computeHasAccessFrom(sub));
                  if (pollId !== null) window.clearInterval(pollId);
                  return;
                }
              }
            } catch (e) {
              // ignore transient errors during polling
            }

            if (attempts >= maxAttempts) {
              if (pollId !== null) window.clearInterval(pollId);
            }
          };

          pollId = window.setInterval(() => {
            if (!isActive.value) return;
            doPoll();
          }, intervalMs);

          // Run first poll immediately
          doPoll();

          // Cleanup on unmount
          const cleanup = () => {
            isActive.value = false;
            if (pollId !== null) window.clearInterval(pollId);
          };
          // ensure cleanup when component unmounts or effect re-runs
          // note: React won't let us return cleanup from inside this inner function, so attach to outer scope
          ;(checkSubscription as any)._cleanup = cleanup;
        }
      } catch (error) {
      
        setHasAccess(false);
      } finally {
        setCheckingSubscription(false);
        setSubscriptionChecked(true);
      }
    };

    checkSubscription();

    return () => {
      // call any inner cleanup (poll clear)
      const fn = (checkSubscription as any)._cleanup;
      if (typeof fn === 'function') fn();
    };
  }, [currentUser, requiresSubscription, subscriptionCheckNonce]);

  const handleSubscribe = async (subscriptionType: PlanId) => {
    if (!currentUser?.uid) {
      setError('User not authenticated');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/stripe/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          action: 'create-checkout-session',
          subscriptionType,
          skipTrial: trialMode === 'already-used',
        }),
      });

      const result = await response.json();

      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start subscription process');
    } finally {
      setIsProcessing(false);
    }
  };

  const needsPro = requiresSubscription?.includes('pro') || requiresSubscription?.includes('proplus');

  if (!currentUser && !loading) {
    return <Navigate to="/auth/signin" />;
  }

  // Fraud detection modal - check BEFORE loader
  if (isFraudDetected) {
    return (
      <div className="relative h-screen w-screen">
        <div className="absolute inset-0" style={{ zIndex: 10 }}>
          <ParticlesBackground />
        </div>
        <div className="relative" style={{ zIndex: 3000 }}>
          <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent
              className="sm:max-w-[600px] bg-black border-white/10 flex flex-col [&>button]:hidden"
              onPointerDownOutside={e => e.preventDefault()}
              onEscapeKeyDown={e => e.preventDefault()}
            >
              <DialogHeader className="text-center pb-0">
                <h2 className="text-2xl font-bold text-center mb-4">Free Trial was already used</h2>
                <p className="text-white/80 text-center mb-6">
                  This credit card has already been used for a free trial. Please navigate to the view plans section and continue with the Already Used Trial option 
                </p>
                <div
                  style={{
                    width: '100%',
                    height: '1px',
                    background: 'transparent',
                    borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                    margin: '16px auto 24px',
                    borderRadius: '1px',
                  }}
                />
                <button
                  onClick={() => {
                    sessionStorage.setItem('fraudAcknowledged', 'true');
                    setIsFraudDetected(false);
                    setCheckingSubscription(false);
                    setSubscriptionChecked(true);
                    setHasAccess(false);
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  }}
                  className="bg-[#94bba3] hover:bg-[#94bba3]/90 text-black font-medium py-2 px-6 rounded-md transition-colors w-fit mx-auto"
                >
                 View Plans
                </button>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // Prevent a brief paywall flash while auth/subscription state is still being resolved.
  if (loading || checkingSubscription || isProcessing || isPostPaymentLoading || (currentUser && !subscriptionChecked) || (currentUser && subscriptionChecked && !freePlanData)) {
    return <CenteredSpinnerLoader />;
  }

  if (error) {
    // Error state - removed, using fraud modal instead
    return null;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute inset-0" style={{ zIndex: 10 }}>
        <ParticlesBackground />
      </div>
      <div className="relative" style={{ zIndex: 3000 }}>
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent
            className="sm:max-w-[900px] bg-black border-white/10 flex flex-col [&>button]:hidden"
            onPointerDownOutside={e => e.preventDefault()}
            onEscapeKeyDown={e => e.preventDefault()}
          >
            <DialogHeader className="text-center pb-0">
              <h2 className="text-2xl font-bold text-center -mb-2">Unlock our powerful trading tools</h2>
              <p className="text-muted-foreground text-center mb-4">
                {needsPro
                  ? 'Pro subscription required to access this feature.'
                  : 'Subscription required to access this feature.'}
              </p>
              <div
                style={{
                  width: '600px',
                  height: '1px',
                  background: 'transparent',
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  margin: '16px auto 12px',
                  borderRadius: '1px',
                }}
              />
              <div className="flex justify-center mt-12 mb-6">
                <span
                  className="flex items-center justify-center h-9 px-4 bg-[#94bba3]/20 border border-white/15 rounded-full text-white font-medium text-sm shadow"
                  style={{
                    cursor: 'default',
                    userSelect: 'none',
                    transition: 'none'
                  }}
                >
                 Free Products availalbe
                </span>
              </div>
              <div
                style={{
                  width: '600px',
                  height: '1px',
                  background: 'transparent',
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                  margin: '20px auto 24px',
                  borderRadius: '2px',
                }}
              />
              
              {/* Trial Mode Toggle Container */}
              <div className="flex justify-center mb-8">
                <button
                  className="w-36 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group relative bg-gradient-to-b from-[rgba(148,187,163,0.8)] to-[rgba(255, 255, 255, 0.8)] text-white shadow-[0_0_10px_2px_rgba(148,187,163,0.4)] border border-[rgba(148,187,163,0.8)] hover:scale-105"
                  disabled
                >
                  <span className="text-sm font-bold">Choose your Path</span>
                </button>
              </div>
            </DialogHeader>

            {/* Add-On Selection Section */}
            <div className="w-full max-w-2xl mx-auto mt-8 space-y-4">
              {/* Trade Journaling - Default (Non-toggleable) */}
              <div className="border border-white/20 rounded-lg p-4 bg-black/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-5 h-5 rounded border border-[#94bba3] bg-[#94bba3]">
                      <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Trade Journaling</h3>
                      <p className="text-white/70 text-sm">Statistics & In depth Trade Journaling</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">$0</span>
                    <span className="text-sm text-white/70">/month</span>
                  </div>
                </div>
              </div>

              {/* Auto Trade Syncing - Optional */}
              <div className="border border-white/20 rounded-lg p-4 bg-black/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={hasAutoTradeSync}
                      onChange={(e) => {
                        if (!hasTradecopier) {
                          setHasAutoTradeSync(e.target.checked);
                        }
                      }}
                      disabled={hasTradecopier}
                      className="w-4 h-4 rounded border-white/20 bg-black text-[#94bba3] cursor-pointer appearance-none checked:bg-[#94bba3] checked:border-[#94bba3] relative disabled:opacity-50"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        backgroundImage: hasAutoTradeSync ? 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 20 20%22 fill=%22black%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z%22 clip-rule=%22evenodd%22 /%3E%3C/svg%3E")' : 'none',
                        backgroundSize: '80%',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        cursor: hasTradecopier ? 'not-allowed' : 'pointer'
                      }}
                    />
                    <div>
                      <h3 className="text-white font-semibold">Auto Trade Syncing</h3>
                      <p className="text-white/70 text-sm">Automatic trade syncing & Connect unlimited prop firm accounts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {hasTradecopier ? (
                      <>
                        <span className="text-sm text-[#94bba3] font-semibold">Included</span>
                        <span className="text-sm text-white/70 block"></span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-white">$5</span>
                        <span className="text-sm text-white/70">/month</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Trade Copier - Optional (Auto-enables Auto Trade Syncing) */}
              <div className="border border-white/20 rounded-lg p-4 bg-black/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={hasTradecopier}
                      onChange={(e) => {
                        setHasTradecopier(e.target.checked);
                        if (e.target.checked) {
                          setHasAutoTradeSync(true);
                        }
                      }}
                      className="w-4 h-4 rounded border-white/20 bg-black text-[#94bba3] cursor-pointer appearance-none checked:bg-[#94bba3] checked:border-[#94bba3] relative"
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        backgroundImage: hasTradecopier ? 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 20 20%22 fill=%22black%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z%22 clip-rule=%22evenodd%22 /%3E%3C/svg%3E")' : 'none',
                        backgroundSize: '80%',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                    <div>
                      <h3 className="text-white font-semibold">Trade Copier</h3>
                      <p className="text-white/70 text-sm">Trade Copying Software for Futures & Monitor accounts in Copier Dashboard</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">$29</span>
                    <span className="text-sm text-white/70">/month</span>
                  </div>
                </div>
              </div>

              {/* Price Summary */}
              <div className="border border-[#94bba3]/30 rounded-lg p-4 bg-[#94bba3]/5 mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80">Trade Journaling</span>
                  <span className="text-white">$0</span>
                </div>
                {hasAutoTradeSync && !hasTradecopier && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/80">Auto Trade Syncing</span>
                    <span className="text-white">$5</span>
                  </div>
                )}
                {hasTradecopier && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/80">Auto Trade Syncing</span>
                      <span className="text-[#94bba3] font-semibold">Included</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/80">Trade Copier</span>
                      <span className="text-white">$29</span>
                    </div>
                  </>
                )}
                <div className="border-t border-white/10 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-2xl font-bold text-[#94bba3]">
                      ${hasTradecopier ? 29 : hasAutoTradeSync ? 5 : 0}/month
                    </span>
                  </div>
                </div>
              </div>

              {/* Apply Coupon Button */}
              <div className="flex justify-center mb-4">
                <button
                  className="flex items-center justify-center h-9 px-4 bg-black border border-white/15 rounded-full text-white font-medium text-sm shadow"
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'none'
                  }}
                >
                  Apply Coupon in Checkout
                </button>
              </div>

              {/* Continue Button */}
              <button
                onClick={async () => {
                  if (hasTradecopier) {
                    handleSubscribe('pro');
                  } else if (hasAutoTradeSync) {
                    handleSubscribe('basic');
                  } else {
                    // Trade Journaling only ($0) - write to FREEPLAN in Firestore and close modal
                    try {
                      if (!currentUser?.uid) return;

                      const db = getFirestore(app);
                      const freePlanRef = doc(db, 'FREEPLAN', currentUser.uid);
                      
                      await setDoc(freePlanRef, {
                        userId: currentUser.uid,
                        freedefalutl: true
                      });

                      // Update local state
                      setFreePlanData({ userId: currentUser.uid, freedefalutl: true });
                      setShowModal(false);
                      setHasAccess(true);
                      // Trigger subscription check to re-evaluate
                      setSubscriptionCheckNonce((n) => n + 1);
                    } catch (error) {
                      setError('Failed to save plan selection');
                    }
                  }
                }}
                disabled={!canSubscribe || isProcessing}
                className={`w-full font-medium py-3 px-4 rounded-md transition-colors disabled:cursor-not-allowed text-base ${
                  canSubscribe 
                    ? 'bg-[#94bba3] hover:bg-[#94bba3]/90 text-black disabled:opacity-50'
                    : 'bg-transparent border border-gray-600 text-gray-400 cursor-not-allowed opacity-30'
                }`}
              >
                {!canSubscribe 
                  ? 'Coming Soon' 
                  : isProcessing ? 'Processing...' : !hasAutoTradeSync && !hasTradecopier ? 'Start for free now' : 'Continue to Checkout'}
              </button>
            </div>

            {/* Go Back Button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => window.history.back()}
                className="bg-transparent border border-white/20 text-white font-medium py-2 px-4 rounded-md transition-colors hover:border-white/40 w-fit"
              >
                Go Back
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
    </div>
  );
};

export default ProtectedRouteForFeatures;