import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firestore';

export async function saveStripeCustomerId(userId: string, stripeCustomerId: string) {
  await setDoc(doc(db, 'users', userId), { stripeCustomerId }, { merge: true });
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (userDoc.exists()) {
    return userDoc.data().stripeCustomerId || null;
  }
  return null;
}
