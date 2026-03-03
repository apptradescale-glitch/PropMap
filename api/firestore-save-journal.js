const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ VERIFY AUTH TOKEN (SECURITY)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid auth token' });
  }

  const token = authHeader.slice(7);
  let decodedToken;

  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { userId, date, notes, screenshots } = req.body;

  // Ensure userId matches token
  if (decodedToken.uid !== userId) {
    return res.status(403).json({ error: 'Unauthorized: userId mismatch' });
  }

  if (!userId || !date) {
    return res.status(400).json({ error: 'Missing userId or date' });
  }

  try {
    // Save or update journal entry
    const docId = `${userId}_${date}`;
    const journalRef = db.collection('DailyJournal').doc(docId);

    await journalRef.set({
      userId,
      date,
      notes: notes || [],
      screenshots: screenshots || [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.status(200).json({ 
      success: true, 
      message: 'Journal saved successfully',
      docId 
    });

  } catch (error) {
  
    return res.status(500).json({ error: error.message });
  }
}
