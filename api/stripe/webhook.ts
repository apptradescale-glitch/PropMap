import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import admin from 'firebase-admin';

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    } as any),
  });
}

type PlanId = 'basic' | 'pro' | 'proplus';

// Stripe Price IDs (hardcoded by request)
// Replace these with your real Stripe price IDs.
const BASIC_PRICE_ID = 'price_1SuuqTKpp15zKIvzLLrLmJyM';
const PRO_PRICE_ID = 'price_1SuulqKpp15zKIvzt14fSPYO';
const PROPLUS_PRICE_ID = 'price_1SoSnmKpp15zKIvzXVnqMyZ6';

function mapPriceIdToPlanId(priceId?: string | null): PlanId {
  const id = String(priceId || '');
  if (id === PROPLUS_PRICE_ID) return 'proplus';
  if (id === PRO_PRICE_ID) return 'pro';
  // Default to basic if unknown/missing.
  return 'basic';
}

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const maybeRaw = (req as any).rawBody;
  if (maybeRaw) {
    if (Buffer.isBuffer(maybeRaw)) return maybeRaw;
    if (typeof maybeRaw === 'string') return Buffer.from(maybeRaw);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function computeHasSubscription(sub: Stripe.Subscription, nowSec: number) {
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'canceled' && sub.cancel_at_period_end && sub.current_period_end && sub.current_period_end > nowSec) {
    return true;
  }
  return false;
}

async function upsertByUserId(userId: string, patch: Record<string, any>) {
  const db = admin.firestore();
  const ref = db.collection('subscriptions').doc(userId);
  const nowIso = new Date().toISOString();

  await ref.set(
    {
      userId,
      updatedAt: nowIso,
      ...patch,
    },
    { merge: true }
  );
}

async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const db = admin.firestore();
  const q = await db
    .collection('subscriptions')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  if (q.empty) return null;
  return (q.docs[0].data() as any)?.userId || q.docs[0].id;
}

async function getCardFingerprint(subscription: Stripe.Subscription, stripeClient: Stripe): Promise<string | null> {
  try {
    if (!subscription.default_payment_method) {
      return null;
    }
    
    const paymentMethodId = typeof subscription.default_payment_method === 'string' 
      ? subscription.default_payment_method 
      : subscription.default_payment_method.id;
    
    const paymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId);
    return (paymentMethod as any)?.card?.fingerprint || null;
  } catch {
    return null;
  }
}

async function checkAndSaveCardFingerprint(
  fingerprint: string | null,
  subscription: Stripe.Subscription,
  isTrialSubscription: boolean
): Promise<boolean> {
  // Only enforce trial card limit for trial subscriptions
  if (!isTrialSubscription || !fingerprint) {
    return true; // Allow non-trial or missing fingerprint
  }

  const db = admin.firestore();
  const trialCardsRef = db.collection('usedTrialCards');
  
  try {
    // Check if this card fingerprint has already been used for a trial
    const existing = await trialCardsRef.doc(fingerprint).get();
    
    if (existing.exists) {
      // Card already used for trial - deny this subscription
      return false;
    }
    
    // Card not used yet - save it
    await trialCardsRef.doc(fingerprint).set({
      fingerprint,
      usedAt: new Date().toISOString(),
      subscriptionId: subscription.id,
      customerId: subscription.customer,
    });
    
    return true; // Allow subscription
  } catch {
    // On error, allow subscription to proceed (fail open)
    return true;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  initFirebaseAdmin();

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return res.status(500).json({ error: 'Server misconfigured: missing Stripe secrets' });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-03-31.basil',
  });

  const sig = req.headers['stripe-signature'];
  if (!sig || Array.isArray(sig)) {
    return res.status(400).send('Missing Stripe signature');
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err?.message || 'Invalid signature'}`);
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = (session.client_reference_id as string) || (session.metadata?.userId as string) || '';

      if (!userId) {
        return res.status(200).json({ received: true, ignored: true });
      }

      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id || null;

      let subscription: Stripe.Subscription | null = null;
      if (subscriptionId) {
        subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price', 'default_payment_method'],
        });
      }

      const priceId = subscription?.items?.data?.[0]?.price?.id || null;
      const subscriptionType = mapPriceIdToPlanId(priceId);
      const hasSubscription = subscription ? computeHasSubscription(subscription, nowSec) : false;
      
      // Extract current_period_end from the subscription items (first item)
      const currentPeriodEndSec = subscription?.items?.data?.[0]?.current_period_end ?? subscription?.current_period_end;
      const currentPeriodEndIso = currentPeriodEndSec ? new Date(currentPeriodEndSec * 1000).toISOString() : null;

      // Extract trial end date if in trial
      const trialEndSec = subscription?.trial_end;
      const trialEndIso = trialEndSec ? new Date(trialEndSec * 1000).toISOString() : null;
      const isTrialing = subscription?.status === 'trialing';

      // Check card fingerprint for trial fraud prevention
      if (isTrialing && subscription) {
        const fingerprint = await getCardFingerprint(subscription, stripe);
        const cardAllowed = await checkAndSaveCardFingerprint(fingerprint, subscription, true);
        
        if (!cardAllowed) {
          // Card already used for trial - cancel this subscription immediately
          await stripe.subscriptions.cancel(subscriptionId!);
          // Also update Firestore to reflect the cancellation
          await upsertByUserId(userId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            hasSubscription: false,
            subscriptionStatus: 'cancelled_fraud',
            paymentStatus: 'unpaid',
          });
          return res.status(200).json({ 
            received: true, 
            message: 'Trial already used with this card' 
          });
        }
      }

      await upsertByUserId(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionType,
        hasSubscription,
        subscriptionStatus: hasSubscription ? 'complete' : 'none',
        paymentStatus: hasSubscription ? 'paid' : 'unpaid',
        cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
        currentPeriodEnd: currentPeriodEndIso,
        firstPaymentDate: new Date((session.created || nowSec) * 1000).toISOString(),
        isTrialing: isTrialing,
        trialEndDate: trialEndIso,
      });

      return res.status(200).json({ received: true });
    }

    if (event.type.startsWith('customer.subscription.')) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const userId = await findUserIdByCustomerId(customerId);
      if (!userId) {
        return res.status(200).json({ received: true, ignored: true });
      }

      // For subscription creation events, check card fingerprint for trial fraud prevention
      if (event.type === 'customer.subscription.created' && sub.status === 'trialing') {
        // Retrieve subscription with payment method expanded
        const expandedSub = await stripe.subscriptions.retrieve(sub.id, {
          expand: ['default_payment_method', 'items.data.price'],
        });
        
        const fingerprint = await getCardFingerprint(expandedSub, stripe);
        const cardAllowed = await checkAndSaveCardFingerprint(fingerprint, expandedSub, true);
        
        if (!cardAllowed) {
          // Card already used for trial - cancel this subscription immediately
          await stripe.subscriptions.cancel(sub.id);
          // Also update Firestore to reflect the cancellation
          await upsertByUserId(userId, {
            hasSubscription: false,
            subscriptionStatus: 'cancelled_fraud',
            stripeSubscriptionId: sub.id,
          });
          return res.status(200).json({ 
            received: true, 
            message: 'Trial already used with this card' 
          });
        }
      }

      const priceId = sub.items?.data?.[0]?.price?.id || null;
      const subscriptionType = mapPriceIdToPlanId(priceId);
      const hasSubscription = computeHasSubscription(sub, nowSec);
      
      // Extract current_period_end from the subscription items (first item)
      const currentPeriodEndSec = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
      const currentPeriodEndIso = currentPeriodEndSec ? new Date(currentPeriodEndSec * 1000).toISOString() : null;

      // Extract trial end date if in trial
      const trialEndSec = sub.trial_end;
      const trialEndIso = trialEndSec ? new Date(trialEndSec * 1000).toISOString() : null;
      const isTrialing = sub.status === 'trialing';

      await upsertByUserId(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        subscriptionType,
        hasSubscription,
        subscriptionStatus: hasSubscription ? 'complete' : 'expired',
        paymentStatus: hasSubscription ? 'paid' : 'unpaid',
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: currentPeriodEndIso,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        endedAt: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
        isTrialing: isTrialing,
        trialEndDate: trialEndIso,
      });

      return res.status(200).json({ received: true });
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const userId = await findUserIdByCustomerId(customerId);
      
      if (userId) {
        // Subscription was deleted - deny access
        await upsertByUserId(userId, {
          hasSubscription: false,
          subscriptionStatus: 'cancelled',
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          endedAt: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
        });
      }

      return res.status(200).json({ received: true });
    }

    // Other events: acknowledge.
    return res.status(200).json({ received: true });
  } catch (err: any) {
    // Return 200 to avoid infinite retries for non-transient issues, but include an error marker.
    return res.status(200).json({ received: true });
  }
}
