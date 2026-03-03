import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// Check environment variables immediately
// Avoid logging environment values in serverless logs.

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil',
});

type PlanId = 'basic' | 'pro' | 'proplus';

// Stripe Price IDs (hardcoded by request)
// Replace these with your real Stripe price IDs.
const BASIC_PRICE_ID = 'price_1SuuqTKpp15zKIvzLLrLmJyM';
const PRO_PRICE_ID = 'price_1SuulqKpp15zKIvzt14fSPYO';
const PROPLUS_PRICE_ID = 'price_1SoSnmKpp15zKIvzXVnqMyZ6';

// Add-on subscription prices (on top of main subscription)
const BASIC_ADD_PRICE_ID = 'price_1SuutJKpp15zKIvzoX63tJ6D';
const PRO_ADD_PRICE_ID = 'price_1SuuuOKpp15zKIvzQVBDS7sm';
const PROPLUS_ADD_PRICE_ID = 'price_1SoTAwKpp15zKIvzpqXnxsHz';

function mapPriceIdToPlanId(priceId?: string | null): PlanId {
  const id = String(priceId || '');
  if (id === PROPLUS_PRICE_ID) return 'proplus';
  if (id === PRO_PRICE_ID) return 'pro';
  // Default to basic if unknown/missing.
  return 'basic';
}

function getPriceIdForPlan(planId: PlanId): string {
  if (planId === 'basic') {
    return BASIC_PRICE_ID;
  }
  if (planId === 'pro') {
    return PRO_PRICE_ID;
  }
  return PROPLUS_PRICE_ID;
}

function getAddOnPriceIdForPlan(planId: PlanId): string {
  if (planId === 'basic') {
    return BASIC_ADD_PRICE_ID;
  }
  if (planId === 'pro') {
    return PRO_ADD_PRICE_ID;
  }
  return PROPLUS_ADD_PRICE_ID;
}

function assertRealPriceId(priceId: string) {
  if (!priceId.startsWith('price_')) {
    throw new Error('Invalid Stripe price id format. Expected it to start with "price_".');
  }
  if (priceId.includes('REPLACE_ME')) {
    throw new Error('Stripe price IDs are not configured yet. Replace the price_REPLACE_ME_* placeholders in api/stripe/payments.ts.');
  }
}

function isPlanId(value: unknown): value is PlanId {
  return value === 'basic' || value === 'pro' || value === 'proplus';
}

async function getStoredStripeIds(uid: string): Promise<{ stripeCustomerId: string | null; stripeSubscriptionId: string | null }> {
  const doc = await admin.firestore().collection('subscriptions').doc(uid).get();
  const data = doc.exists ? (doc.data() as any) : null;
  return {
    stripeCustomerId: data?.stripeCustomerId ? String(data.stripeCustomerId) : null,
    stripeSubscriptionId: data?.stripeSubscriptionId ? String(data.stripeSubscriptionId) : null,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ VERIFY AUTH TOKEN (SECURITY)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid auth token' });
  }

  const token = authHeader.substring(7);
  let authenticatedUserId: string;
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    authenticatedUserId = decodedToken.uid;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }

  try {
    const { userId: bodyUserId, action, sessionId, stripeCustomerId, subscriptionType, referrer, skipTrial } = req.body;
    // Request processing started

    // ✅ VERIFY USER OWNERSHIP (but allow omitting userId; token is the source of truth)
    if (bodyUserId && bodyUserId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }
    const userId: string = bodyUserId || authenticatedUserId;

    if (action === 'create-checkout-session') {
      try {
        const requested = String(subscriptionType || '').toLowerCase();
        if (!isPlanId(requested)) {
          return res.status(400).json({ error: 'Invalid subscriptionType. Expected one of: basic, pro, proplus.' });
        }
        const planId: PlanId = requested;

        const priceId = getPriceIdForPlan(planId);
        assertRealPriceId(priceId);

        const successUrl = referrer
          ? `${process.env.NEXT_PUBLIC_BASE_URL}/#/dashboard/AutoSync?payment=success&session_id={CHECKOUT_SESSION_ID}`
          : `${process.env.NEXT_PUBLIC_BASE_URL}/#/dashboard/AutoSync?payment=success&session_id={CHECKOUT_SESSION_ID}`;

        // Check if user already used their free trial or skipped it
        let trialDays: number | undefined = 5;
        
        if (skipTrial) {
          // User explicitly chose to skip trial (already used one before)
          trialDays = undefined;
        } else {
          // Check if user already used their free trial
          const userDoc = await admin.firestore().collection('subscriptions').doc(userId).get();
          const hasUsedTrial = userDoc.exists && userDoc.data()?.isTrialing === true;
          if (hasUsedTrial) {
            trialDays = undefined;
          }
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'subscription',
          allow_promotion_codes: true,
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
            {
              price: getAddOnPriceIdForPlan(planId),
              quantity: 1,
            },
          ],
          subscription_data: {
            trial_period_days: trialDays,
          },
          success_url: successUrl,
          cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
          client_reference_id: userId,
          metadata: { userId, subscriptionType: planId },
        });

        return res.status(200).json({ url: session.url });
      } catch (stripeError: any) {
  
        return res.status(500).json({ 
          error: 'Failed to create checkout session',
          details: stripeError.message
        });
      }
    }

    if (action === 'check-subscription') {
      try {
        if (sessionId) {
          const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['customer', 'subscription']
          });

          // ✅ Ensure the session belongs to the authenticated user
          if (!session.client_reference_id || session.client_reference_id !== authenticatedUserId) {
            return res.status(403).json({ error: 'Unauthorized: session does not belong to authenticated user' });
          }

          // Save Stripe customer ID and subscription info to Firestore (paidUsers collection)
          try {
            if (session.customer && session.client_reference_id) {
              const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer.id;
              const rawPlan = (session.metadata?.subscriptionType as string) || 'basic';
              const subscriptionType: PlanId = isPlanId(rawPlan) ? rawPlan : 'basic';
              const paymentStatus = session.payment_status || 'unknown';
              const subscriptionStatus = session.status || 'unknown';
              const hasSubscription = !!session.subscription;

              // Avoid logging customer identifiers / payment metadata.

              // Update the existing document in the subscriptions collection
              try {
                const subscriptionsDocRef = admin.firestore().collection('subscriptions').doc(session.client_reference_id);
                
                // Get existing document to preserve firstPaymentDate if it already exists
                const existingDoc = await subscriptionsDocRef.get();
                const existingData = existingDoc.exists ? existingDoc.data() : {};
                
                const subscriptionsData = {
                  userId: session.client_reference_id,
                  subscriptionType: subscriptionType,
                  stripeCustomerId: stripeCustomerId,
                  paymentStatus: paymentStatus,
                  subscriptionStatus: subscriptionStatus,
                  hasSubscription: hasSubscription,
                  // Only set firstPaymentDate if it doesn't already exist
                  firstPaymentDate: existingData?.firstPaymentDate || new Date().toISOString(),
                };

                await subscriptionsDocRef.set(subscriptionsData, { merge: true });
                // Subscriptions record updated successfully
              } catch {
                // Intentionally ignore Firestore write errors (no serverless logging).
              }
            }
          } catch {
            // Intentionally ignore Firestore write errors (no serverless logging).
          }

          const isActive = session.payment_status === 'paid' && 
                session.status === 'complete' &&
                session.subscription;

          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer?.id;

          const subscriptionType = (session.metadata?.subscriptionType as string) || 'basic';

          return res.status(200).json({ 
            active: isActive,
            subscriptionType,
            stripeCustomerId: customerId
          });
        }

        // ✅ Do not trust client-provided stripeCustomerId; require it to match Firestore.
        const subscriptionDoc = await admin.firestore().collection('subscriptions').doc(authenticatedUserId).get();
        const storedStripeCustomerId = subscriptionDoc.exists
          ? (subscriptionDoc.data() as any)?.stripeCustomerId
          : null;

        if (stripeCustomerId && storedStripeCustomerId && stripeCustomerId !== storedStripeCustomerId) {
          return res.status(403).json({ error: 'Unauthorized: stripeCustomerId does not match authenticated user' });
        }

        const effectiveStripeCustomerId = storedStripeCustomerId || stripeCustomerId;

        if (effectiveStripeCustomerId) {
          const subscriptions = await stripe.subscriptions.list({
            customer: effectiveStripeCustomerId,
            status: 'active',
            limit: 1,
            expand: ['data.items.data.price']
          });
          
          const isActive = subscriptions.data.length > 0;
          let subscriptionType: PlanId = 'basic';
          
          if (isActive) {
            const priceId = subscriptions.data[0].items.data[0].price.id;
            subscriptionType = mapPriceIdToPlanId(priceId);
          }
          
          return res.status(200).json({ 
            active: isActive,
            subscriptionType,
            stripeCustomerId: effectiveStripeCustomerId 
          });
        }
        return res.status(200).json({ 
          active: false,
          subscriptionType: null,
          stripeCustomerId: null 
        });
      } catch (stripeError: any) {
        return res.status(500).json({
          error: stripeError.message || 'Failed to check subscription'
        });
      }
    }

    // --- Cancel Subscription ---
    if (action === 'cancel-subscription') {
      try {
        const stored = await getStoredStripeIds(authenticatedUserId);
        const storedStripeCustomerId = stored.stripeCustomerId;
        const storedStripeSubscriptionId = stored.stripeSubscriptionId;

        if (stripeCustomerId && storedStripeCustomerId && stripeCustomerId !== storedStripeCustomerId) {
          return res.status(403).json({ error: 'Unauthorized: stripeCustomerId does not match authenticated user' });
        }

        const effectiveStripeCustomerId = storedStripeCustomerId || stripeCustomerId;
        if (!effectiveStripeCustomerId) {
          return res.status(400).json({ error: 'stripeCustomerId is required' });
        }

        // Prefer the exact subscription id we stored from the webhook.
        let subscriptionId = storedStripeSubscriptionId;
        if (!subscriptionId) {
          // Fallback: find the most recent subscription that can be canceled.
          const subscriptions = await stripe.subscriptions.list({
            customer: effectiveStripeCustomerId,
            status: 'all',
            limit: 10,
          });
          const candidate = subscriptions.data.find((s: Stripe.Subscription) => s.status === 'active' || s.status === 'trialing') || subscriptions.data[0];
          if (!candidate) {
            return res.status(404).json({ error: 'No subscription found' });
          }
          subscriptionId = candidate.id;
        }

        // Set cancel at period end
        const updated = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });

        // ✅ FIX: Immediately save currentPeriodEnd to Firestore to avoid race condition with webhook
        const currentPeriodEndSec = updated.items?.data?.[0]?.current_period_end ?? updated.current_period_end;
        const currentPeriodEndIso = currentPeriodEndSec ? new Date(currentPeriodEndSec * 1000).toISOString() : null;
        
        await admin.firestore().collection('subscriptions').doc(authenticatedUserId).set(
          {
            cancelAtPeriodEnd: updated.cancel_at_period_end,
            currentPeriodEnd: currentPeriodEndIso,
            canceledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        return res.status(200).json({ success: true, subscription: updated });
      } catch (stripeError: any) {
        return res.status(500).json({
          error: stripeError.message || 'Failed to cancel subscription'
        });
      }
    }

    // --- Resume Subscription ---
    if (action === 'resume-subscription') {
      try {
        const stored = await getStoredStripeIds(authenticatedUserId);
        const storedStripeCustomerId = stored.stripeCustomerId;
        const storedStripeSubscriptionId = stored.stripeSubscriptionId;

        if (stripeCustomerId && storedStripeCustomerId && stripeCustomerId !== storedStripeCustomerId) {
          return res.status(403).json({ error: 'Unauthorized: stripeCustomerId does not match authenticated user' });
        }

        const effectiveStripeCustomerId = storedStripeCustomerId || stripeCustomerId;
        if (!effectiveStripeCustomerId) {
          return res.status(400).json({ error: 'stripeCustomerId is required' });
        }

        // Prefer the exact subscription id we stored from the webhook.
        let subscriptionId = storedStripeSubscriptionId;
        if (!subscriptionId) {
          const subscriptions = await stripe.subscriptions.list({
            customer: effectiveStripeCustomerId,
            status: 'all',
            limit: 10,
          });
          const candidate = subscriptions.data.find((s: Stripe.Subscription) => s.cancel_at_period_end) || subscriptions.data[0];
          if (!candidate) {
            return res.status(404).json({ error: 'No subscription found' });
          }
          subscriptionId = candidate.id;
        }

        // Remove cancel at period end
        const updated = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
        });

        // ✅ FIX: Immediately save subscription status to Firestore
        const currentPeriodEndSec = updated.items?.data?.[0]?.current_period_end ?? updated.current_period_end;
        const currentPeriodEndIso = currentPeriodEndSec ? new Date(currentPeriodEndSec * 1000).toISOString() : null;
        
        await admin.firestore().collection('subscriptions').doc(authenticatedUserId).set(
          {
            cancelAtPeriodEnd: updated.cancel_at_period_end,
            currentPeriodEnd: currentPeriodEndIso,
            canceledAt: null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        return res.status(200).json({ success: true, subscription: updated });
      } catch (stripeError: any) {
        return res.status(500).json({
          error: stripeError.message || 'Failed to resume subscription'
        });
      }
    }

    // --- Get Subscription Details ---
    if (action === 'get-subscription-details') {
      try {
        const stored = await getStoredStripeIds(authenticatedUserId);
        const storedStripeCustomerId = stored.stripeCustomerId;
        const storedStripeSubscriptionId = stored.stripeSubscriptionId;

        if (stripeCustomerId && storedStripeCustomerId && stripeCustomerId !== storedStripeCustomerId) {
          return res.status(403).json({ error: 'Unauthorized: stripeCustomerId does not match authenticated user' });
        }

        const effectiveStripeCustomerId = storedStripeCustomerId || stripeCustomerId;
        if (!effectiveStripeCustomerId) {
          return res.status(400).json({ error: 'stripeCustomerId is required' });
        }

        if (storedStripeSubscriptionId) {
          const sub = await stripe.subscriptions.retrieve(storedStripeSubscriptionId, {
            expand: ['items.data.price'],
          });
          return res.status(200).json({ success: true, subscription: sub });
        }
        
        // Get all subscriptions for this customer (including canceled ones that are still active)
        const subscriptions = await stripe.subscriptions.list({
          customer: effectiveStripeCustomerId,
          status: 'all',
          limit: 10,
          expand: ['data.items.data.price']
        });
        
        // Find the most recent subscription (active or canceled but still within period)
        const activeSubscription = subscriptions.data.find((sub: Stripe.Subscription) => 
          sub.status === 'active' || 
          (sub.status === 'canceled' && sub.cancel_at_period_end && new Date() < new Date((sub as any).current_period_end * 1000))
        );
        
        if (!activeSubscription) {
          return res.status(200).json({ success: false, message: 'No active subscription found' });
        }
        
        return res.status(200).json({ 
          success: true, 
          subscription: activeSubscription
        });
      } catch (stripeError: any) {
        return res.status(500).json({
          error: stripeError.message || 'Failed to get subscription details'
        });
      }
    }

    // ✅ NEW: Fraud detection - block user's subscription access
    if (action === 'fraud-block') {
      const userId = req.body.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      try {
        const db = admin.firestore();
        const nowIso = new Date().toISOString();
        
        await db.collection('subscriptions').doc(userId).set(
          {
            userId,
            hasSubscription: false,
            subscriptionStatus: 'cancelled_fraud',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        return res.status(200).json({ 
          success: true, 
          message: 'Fraud block applied - access denied' 
        });
      } catch (error: any) {
        return res.status(500).json({ 
          error: error.message || 'Failed to apply fraud block' 
        });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    return res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
}