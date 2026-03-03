'use client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/FAuth';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Settings } from 'lucide-react';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type SubscriptionRecord = {
  status: string; // 'active' | 'inactive' | 'expiring'
  firstPaymentDate?: string; // ISO string
  cancelAtPeriodEnd?: boolean;
  endDate?: string | null; // ISO string
};

async function updateSubscriptionInFirestore(userId: string, subscription: SubscriptionRecord) {
  // Get the current user's ID token for authentication
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user');
  
  const token = await currentUser.getIdToken();
  await fetch('/api/firestore-save-subscription', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ userId, subscription }),
  });
}

export function UserNav() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showBilling, setShowBilling] = React.useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = React.useState<string | null>(null);
  const [nextRebill, setNextRebill] = React.useState<string | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [endDate, setEndDate] = React.useState<string | null>(null);

  // Dummy fetch from Firestore (replace with your real fetch logic)
  const getSubscriptionInfo = async () => {
    if (!currentUser?.uid) return;
    // Fetch from your Firestore API
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/firestore-get-subscription?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    const record: SubscriptionRecord = data.subscription || { status: 'inactive' };

    if (record.cancelAtPeriodEnd && record.endDate) {
      setSubscriptionStatus('expiring');
      setNextRebill(record.endDate);
      setCancelled(true);
      setEndDate(record.endDate);
    } else if (record.status === 'active' && record.firstPaymentDate) {
      setSubscriptionStatus('active');
      // Calculate next rebill date (simple +1 month logic)
      const first = new Date(record.firstPaymentDate);
      const now = new Date();
      let next = new Date(first);
      next.setMonth(next.getMonth() + 1);
      while (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      setNextRebill(next.toLocaleDateString());
      setCancelled(false);
      setEndDate(null);
    } else {
      setSubscriptionStatus(record.status);
      setNextRebill(null);
      setCancelled(false);
      setEndDate(null);
    }
  };

  const handleOpenBilling = () => {
    setShowBilling(true);
    getSubscriptionInfo();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/auth/signin');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out"
      });
    }
  };

  // Cancel subscription: update Firestore only
  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    if (!currentUser?.uid) return;

    // Fetch current subscription from Firestore
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/firestore-get-subscription?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    let record: SubscriptionRecord = data.subscription || { status: 'inactive' };

    if (record.status === 'active' && record.stripeCustomerId) {
      // 1. Cancel in Stripe
      const stripeRes = await fetch('/api/stripe/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          action: 'cancel-subscription',
          stripeCustomerId: record.stripeCustomerId,
        }),
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: stripeData.error || "Failed to cancel subscription in Stripe."
        });
        setIsCancelling(false);
        return;
      }

      // 2. Update Firestore
      record.cancelAtPeriodEnd = true;
      const first = new Date(record.firstPaymentDate);
      const now = new Date();
      let next = new Date(first);
      next.setMonth(next.getMonth() + 1);
      while (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      record.endDate = next.toLocaleDateString();
      record.status = 'expiring';

      await updateSubscriptionInFirestore(currentUser.uid, record);

      setSubscriptionStatus('expiring');
      setNextRebill(record.endDate);
      setCancelled(true);
      setEndDate(record.endDate);
    }
    setIsCancelling(false);
  };

  // Continue subscription: update Firestore only
  const handleContinueSubscription = async () => {
    setIsCancelling(true);
    if (!currentUser?.uid) return;

    // Fetch current subscription from Firestore
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/firestore-get-subscription?userId=${currentUser.uid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    let record: SubscriptionRecord = data.subscription || { status: 'inactive' };

    if (record.status === 'expiring' && record.stripeCustomerId) {
      // 1. Resume in Stripe
      const stripeRes = await fetch('/api/stripe/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          action: 'resume-subscription',
          stripeCustomerId: record.stripeCustomerId,
        }),
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: stripeData.error || "Failed to resume subscription in Stripe."
        });
        setIsCancelling(false);
        return;
      }

      // 2. Update Firestore
      record.cancelAtPeriodEnd = false;
      record.endDate = null;
      record.status = 'active';

      await updateSubscriptionInFirestore(currentUser.uid, record);

      setSubscriptionStatus('active');
      setCancelled(false);
      setEndDate(null);

      // Optionally, recalculate next rebill
      if (record.firstPaymentDate) {
        const first = new Date(record.firstPaymentDate);
        const now = new Date();
        let next = new Date(first);
        next.setMonth(next.getMonth() + 1);
        while (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        setNextRebill(next.toLocaleDateString());
      }
    }
    setIsCancelling(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings />
            <span className="sr-only">Settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-black" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                Account
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {currentUser?.email || 'Not signed in'}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {/* Hide Billing tab by wrapping in false && ... */}
            {false && (
              <DropdownMenuItem
                className="hover:bg-[rgba(148,187,163,0.2)] focus:bg-[rgba(148,187,163,0.2)]"
                onClick={handleOpenBilling}
              >
                Billing
                <DropdownMenuShortcut>⌗</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="hover:bg-[rgba(148,187,163,0.2)] focus:bg-[rgba(148,187,163,0.2)]"
            onClick={handleLogout}
          >
            Log out
            <DropdownMenuShortcut>⌗</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="hover:bg-[rgba(148,187,163,0.2)] focus:bg-[rgba(148,187,163,0.2)]"
            onClick={() => console.log('logout')}
          >
            Support: apptradescale@gmail.com
            <DropdownMenuShortcut>⌗</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Billing Dialog */}
      {showBilling && (
        <Dialog open={showBilling} onOpenChange={setShowBilling}>
          <DialogContent className="sm:max-w-[425px] bg-black border-white/10">
            <DialogHeader>
              <DialogTitle>Billing Info</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium">{currentUser?.email}</span>
              </div>
              <div className="grid gap-2">
                <span className="text-sm text-muted-foreground">Subscription status</span>
                {subscriptionStatus === "expiring" ? (
                  <span className="font-medium text-red-400">expiring</span>
                ) : (
                  <span className="font-medium text-[#94bba3]">active</span>
                )}
              </div>
              <div className="grid gap-2">
                <span className="text-sm text-muted-foreground">
                  {subscriptionStatus === "expiring" ? "Subscription end" : "Next rebill"}
                </span>
                <span className="font-medium">{nextRebill || "Unknown"}</span>
              </div>
            </div>
            <div className="flex justify-start">
              {subscriptionStatus === "expiring" ? (
                <Button
                  onClick={handleContinueSubscription}
                  disabled={isCancelling}
                  className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-[#94bba3]/20 transition-transform"
                >
                  {isCancelling ? "Continuing..." : "Continue Subscription"}
                </Button>
              ) : (
                !cancelled && (
                  <Button
                    onClick={handleCancelSubscription}
                    disabled={isCancelling}
                    className="h-9 w-auto px-2 bg-transparent border border-white/15 hover:bg-red-500/80 transition-transform"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Subscription"}
                  </Button>
                )
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}