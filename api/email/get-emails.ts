import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

function initFirebaseAdmin() {
  if (admin.apps.length) return;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }
    
    initFirebaseAdmin();
    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.substring(7));
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    // Get emails from Firestore
    const db = admin.firestore();
    const emailSnap = await db.collection('email_imports').doc(uid).get();

    if (!emailSnap.exists) {
      return res.status(200).json({
        emails: [],
        total_emails: 0,
        uploaded_at: null,
        file_name: null
      });
    }

    const data = emailSnap.data();

    return res.status(200).json({
      emails: data?.emails || [],
      total_emails: data?.total_emails || 0,
      uploaded_at: data?.uploaded_at || null,
      file_name: data?.file_name || null
    });

  } catch (error: any) {
    console.error('Error getting emails:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve emails', 
      details: error.message 
    });
  }
}
