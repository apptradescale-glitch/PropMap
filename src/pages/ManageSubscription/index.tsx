import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/FAuth';
import PageHead from '@/components/shared/page-head';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Crown, Star } from 'lucide-react';
import logoImage from '@/assets/images/lg34.png';

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
  // Stripe-specific fields
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  canceledAt?: Date | null;
  endedAt?: Date | null;
  priceId?: string;
  // Trial fields
  isTrialing?: boolean;
  trialEndDate?: string;
};

type PlanId = 'basic' | 'pro' | 'proplus';

export default function ManageSubscription() {
  const { currentUser } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  const fetchSubscriptionData = async () => {
    if (!currentUser?.uid) return;

    try {
      // First get the basic subscription data from Firestore to get the Stripe customer ID
      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/firestore-all-subscription?userId=${currentUser.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.subscription && result.subscription.stripeCustomerId) {
        // Fetch real-time data from Stripe
        const stripeResponse = await fetch('/api/stripe/payments', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: currentUser.uid,
            action: 'get-subscription-details',
            stripeCustomerId: result.subscription.stripeCustomerId
          }),
        });
        
        if (stripeResponse.ok) {
          const stripeData = await stripeResponse.json();
      
          
          if (stripeData.success && stripeData.subscription) {
        
            
            // Combine Firestore data with real Stripe data
            const combinedData = {
              ...result.subscription,
              // Override with real Stripe data
              status: stripeData.subscription.status,
              cancelAtPeriodEnd: stripeData.subscription.cancel_at_period_end,
              currentPeriodStart: stripeData.subscription.current_period_start
                ? new Date(stripeData.subscription.current_period_start * 1000)
                : (stripeData.subscription.start_date ? new Date(stripeData.subscription.start_date * 1000) : null),
              currentPeriodEnd: stripeData.subscription.current_period_end
                ? new Date(stripeData.subscription.current_period_end * 1000)
                : (stripeData.subscription.cancel_at ? new Date(stripeData.subscription.cancel_at * 1000) : null),
              canceledAt: stripeData.subscription.canceled_at ? new Date(stripeData.subscription.canceled_at * 1000) : null,
              endedAt: stripeData.subscription.ended_at ? new Date(stripeData.subscription.ended_at * 1000) : null,
              priceId: stripeData.subscription.items?.data[0]?.price?.id || result.subscription.priceId,
              // Trial info from Stripe
              isTrialing: stripeData.subscription.status === 'trialing',
              trialEndDate: stripeData.subscription.trial_end 
                ? new Date(stripeData.subscription.trial_end * 1000).toISOString() 
                : result.subscription.trialEndDate,
              // Keep subscription active if still within the paid period, regardless of cancel status
              hasSubscription: stripeData.subscription.status === 'active' || 
                              stripeData.subscription.status === 'trialing' ||
                              (stripeData.subscription.status === 'canceled' && 
                               stripeData.subscription.current_period_end && 
                               new Date() < new Date(stripeData.subscription.current_period_end * 1000)),
              // Keep original Firestore subscription status and payment status
              subscriptionStatus: result.subscription.subscriptionStatus,
              paymentStatus: result.subscription.paymentStatus
            };
            
            // Note: entitlement fields are updated server-side via Stripe webhook.
            
          
            setSubscriptionData(combinedData);
          } else {
            // Fallback to Firestore data if Stripe call doesn't return subscription
            setSubscriptionData(result.subscription);
          }
        } else {
          // Fallback to Firestore data if Stripe call fails
          setSubscriptionData(result.subscription);
        }
      } else if (result.subscription) {
        // No Stripe customer ID, use Firestore data
        setSubscriptionData(result.subscription);
      } else {
        setSubscriptionData(null);
      }
    } catch (error) {
    
      setSubscriptionData(null);
    }
  };

  useEffect(() => {
    const loadSubscription = async () => {
      setLoading(true);
      await fetchSubscriptionData();
      setLoading(false);
    };

    loadSubscription();
  }, [currentUser?.uid]);

  const handleCancelSubscription = async () => {
    if (!currentUser?.uid || !subscriptionData?.stripeCustomerId) return;
    
    setCanceling(true);
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
          action: 'cancel-subscription',
          stripeCustomerId: subscriptionData.stripeCustomerId
        }),
      });

      const result = await response.json();
    
      
      if (result.success && result.subscription) {

        
        // Use the updated subscription data directly from Stripe response
        const updatedSubscriptionData = {
          ...subscriptionData,
          // Use real Stripe data from the response
          status: result.subscription.status,
          cancelAtPeriodEnd: result.subscription.cancel_at_period_end,
          currentPeriodStart: result.subscription.current_period_start
            ? new Date(result.subscription.current_period_start * 1000)
            : (result.subscription.start_date ? new Date(result.subscription.start_date * 1000) : null),
          currentPeriodEnd: result.subscription.current_period_end
            ? new Date(result.subscription.current_period_end * 1000)
            : (result.subscription.cancel_at ? new Date(result.subscription.cancel_at * 1000) : null),
          canceledAt: result.subscription.canceled_at ? new Date(result.subscription.canceled_at * 1000) : new Date(),
        };

     

        // Firestore will be updated by Stripe webhook; update local state immediately.
        
        // Update local state immediately with the new data
        setSubscriptionData(updatedSubscriptionData);
      } else {
        alert('Failed to cancel subscription. Please try again.');
      }
    } catch (error) {
    
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setCanceling(false);
    }
  };

  const handleActivateSubscription = async () => {
    if (!currentUser?.uid || !subscriptionData?.stripeCustomerId) return;
    
    setCanceling(true);
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
          action: 'resume-subscription',
          stripeCustomerId: subscriptionData.stripeCustomerId
        }),
      });

      const result = await response.json();
      if (result.success && result.subscription) {
        // Use the updated subscription data directly from Stripe response
        const updatedSubscriptionData = {
          ...subscriptionData,
          // Use real Stripe data from the response
          status: result.subscription.status,
          cancelAtPeriodEnd: result.subscription.cancel_at_period_end,
          currentPeriodStart: result.subscription.current_period_start
            ? new Date(result.subscription.current_period_start * 1000)
            : (result.subscription.start_date ? new Date(result.subscription.start_date * 1000) : null),
          currentPeriodEnd: result.subscription.current_period_end
            ? new Date(result.subscription.current_period_end * 1000)
            : (result.subscription.cancel_at ? new Date(result.subscription.cancel_at * 1000) : null),
          canceledAt: result.subscription.canceled_at ? new Date(result.subscription.canceled_at * 1000) : null,
        };

        // Firestore will be updated by Stripe webhook; update local state immediately.
        
        // Update local state immediately with the new data
        setSubscriptionData(updatedSubscriptionData);
      } else {
        alert('Failed to reactivate subscription. Please try again.');
      }
    } catch (error) {
    
      alert('Failed to reactivate subscription. Please try again.');
    } finally {
      setCanceling(false);
    }
  };

  const calculateNextRebillDate = (startDateString: string): string => {
    if (!startDateString) return 'N/A';
    
    const startDate = new Date(startDateString);
    const currentDate = new Date();
    
    // Start with the initial rebill date (30 days from start)
    let nextRebillDate = new Date(startDate);
    nextRebillDate.setDate(nextRebillDate.getDate() + 30);
    
    // Keep adding 30 days until we get a future date
    while (nextRebillDate <= currentDate) {
      nextRebillDate.setDate(nextRebillDate.getDate() + 30);
    }
    
    return nextRebillDate.toLocaleDateString();
  };

  const calculateSubscriptionEndDate = (startDateString: string): string => {
    if (!startDateString) return 'N/A';
    
    const startDate = new Date(startDateString);
    const currentDate = new Date();
    
    // Calculate the current period end date (don't add more days if cancelled)
    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);
    
    // Find the current period end date (the last billing period)
    while (endDate <= currentDate) {
      endDate.setDate(endDate.getDate() + 30);
    }
    
    return endDate.toLocaleDateString();
  };

  const getSubscriptionInfo = () => {
    // Show subscription features if user has any subscription (even if cancelled but still active)
    if (!subscriptionData || !subscriptionData.hasSubscription) {
      return {
        title: 'No Active Subscription',
        type: 'None',
        icon: null,
        color: 'bg-gray-500',
        features: []
      };
    }

    const plan = subscriptionData.subscriptionType as PlanId | undefined;

    switch (plan) {
      case 'basic':
        return {
          title: 'Basic Plan',
          type: 'Basic',
          icon: 'logo',
          color: 'bg-blue-500',
          features: [
            { text: 'Dashboard', divider: false },
            { text: 'Trade Logbook', divider: false },
            { text: 'Operational', divider: false },
            { text: 'Connect', divider: false },
           
          ]
        };
      case 'pro':
        return {
          title: 'Pro Plan',
          type: 'Pro',
          icon: 'logo',
          color: 'bg-green-500',
          features: [
            { text: 'Dashboard', divider: false },
            { text: 'Trade Logbook', divider: false },
            { text: 'Operational', divider: true },
            { text: 'Connect', divider: false },
            { text: 'Real-time market data', divider: false },
            { text: 'Trade Copier [70 Accounts]', divider: false },
          ]
        };
      case 'proplus':
        return {
          title: 'Pro+ Plan',
          type: 'Pro+',
          icon: 'logo',
          color: 'bg-purple-500',
          features: [
            { text: 'Dashboard', divider: false },
            { text: 'Trade Logbook', divider: false },
            { text: 'Operational', divider: true },
            { text: 'Connect', divider: false },
            { text: 'Real-time market data', divider: false },
            { text: 'Trade Copier [70 Accounts]', divider: false },
          ]
        };
      default:
        return {
          title: 'No Active Subscription',
          type: 'None',
          icon: null,
          color: 'bg-gray-500',
          features: []
        };
    }
  };

  const subscriptionInfo = getSubscriptionInfo();

  if (loading) {
    return (
      <PageContainer scrollable>
        <PageHead title="Manage Subscription - Tradescale" />
        <div className="pb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-6">Manage Subscription</h2>
          <div className="flex items-center justify-center py-12">
            <div className="text-white/60">Loading subscription details</div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer scrollable>
      <PageHead title="Manage Subscription - Tradescale" />
      <div className="pb-8">
        <h2 className="text-2xl font-bold tracking-tight mb-6">Manage Subscription</h2>
        
        {/* Current Subscription Card */}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-4">
              {subscriptionInfo.icon && (
                <div className="p-3 rounded-lg bg-transparent border border-white/20">
                  {subscriptionInfo.icon === 'logo' ? (
                    <img src={logoImage} alt="Logo" className="h-10 w-12" />
                  ) : (
                    (() => {
                      const IconComponent = subscriptionInfo.icon as React.ComponentType<{className: string}>;
                      return <IconComponent className="h-8 w-8 text-white" />;
                    })()
                  )}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {subscriptionInfo.title}
                </h3>
                <div className="space-y-2">
                  {subscriptionInfo.features.map((feature, index) => (
                    <div key={index}>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4" style={{ color: '#94bba3' }} />
                        <span className="text-sm text-white">{feature.text}</span>
                      </div>
                 {feature.divider && (
  <div className="w-full h-px bg-stone-300 dark:bg-stone-900 my-3"></div>
)}
                    </div>
                  ))}
                </div>
                
                {subscriptionData && subscriptionData.hasSubscription && (
              <div className="mt-4 pt-4 border-t border-stone-300 dark:border-stone-900">
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-[#94bba3]">Status:</span>
                        <div className="font-medium text-white">
                          {subscriptionData.isTrialing 
                            ? 'Free Trial' 
                            : subscriptionData.cancelAtPeriodEnd 
                            ? 'Cancelled' 
                            : 'Active'}
                        </div>
                      </div>
                      {(subscriptionData.currentPeriodStart || subscriptionData.firstPaymentDate) && (
                        <div>
                          <span className="text-[#94bba3]">Started:</span>
                          <div className="font-medium text-white">
                            {subscriptionData.currentPeriodStart
                              ? subscriptionData.currentPeriodStart.toLocaleDateString()
                              : new Date(subscriptionData.firstPaymentDate as string).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-[#94bba3]">
                          {subscriptionData.isTrialing
                            ? 'Trial ends:'
                            : subscriptionData.cancelAtPeriodEnd 
                            ? 'Subscription ends:' 
                            : 'Next rebill:'}
                        </span>
                        <div className="font-medium text-white">
                          {subscriptionData.isTrialing && subscriptionData.trialEndDate ? (
                            // Show trial end date
                            new Date(subscriptionData.trialEndDate).toLocaleDateString()
                          ) : subscriptionData.currentPeriodEnd ? (
                            // Use real Stripe date when available
                            subscriptionData.currentPeriodEnd.toLocaleDateString()
                          ) : subscriptionData.cancelAtPeriodEnd ? (
                            // Fallback to calculated date for cancelled subscriptions
                            subscriptionData.firstPaymentDate 
                              ? calculateSubscriptionEndDate(subscriptionData.firstPaymentDate)
                              : 'N/A'
                          ) : (
                            // Fallback to calculated next rebill date for active subscriptions
                            subscriptionData.firstPaymentDate 
                              ? calculateNextRebillDate(subscriptionData.firstPaymentDate)
                              : 'N/A'
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Cancel/Activate Button */}
                    <Button
                      onClick={subscriptionData.cancelAtPeriodEnd ? handleActivateSubscription : handleCancelSubscription}
                      disabled={canceling}
                      className={
                        subscriptionData.cancelAtPeriodEnd
                          ? 'h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform rounded text-white flex items-center gap-2'
                          : 'h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#bb9494]/20 transition-transform rounded text-white flex items-center gap-2'
                      }
                    >
                      {canceling 
                        ? (subscriptionData.cancelAtPeriodEnd ? 'Reactivating...' : 'Canceling...')
                        : (subscriptionData.cancelAtPeriodEnd ? 'Reactivate Subscription' : 'Cancel Subscription')
                      }
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}