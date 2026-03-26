import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

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

// Simple MBOX parser
function parseMBOX(content: string) {
  const emails = [];
  const emailBlocks = content.split(/^From .+$/m);
  
  for (const block of emailBlocks) {
    if (!block.trim()) continue;
    
    const lines = block.split('\n');
    let headers: { [key: string]: string } = {};
    let bodyStart = -1;
    
    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        bodyStart = i + 1;
        break;
      }
      
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    
    // Extract body
    const body = bodyStart > -1 ? lines.slice(bodyStart).join('\n').trim() : '';
    
    // Create email object
    const email = {
      id: Buffer.from(`${headers['message-id'] || Date.now()}-${Math.random()}`).toString('base64'),
      subject: headers['subject'] || '(No Subject)',
      from: extractEmail(headers['from'] || ''),
      to: extractEmail(headers['to'] || ''),
      date: parseDate(headers['date'] || new Date().toISOString()),
      body: body.substring(0, 10000), // Limit body size
      attachments: []
    };
    
    emails.push(email);
  }
  
  return emails;
}

// Extract email address from "Name <email@domain.com>" format
function extractEmail(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  return match ? match[1] : emailString;
}

// Parse email date
function parseDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

    // Parse the form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB max file size
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const file = files.emailFile?.[0];

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check file extension
    const fileExtension = path.extname(file.originalFilename || '').toLowerCase();
    const validExtensions = ['.mbox', '.pst', '.msg'];
    
    if (!validExtensions.includes(fileExtension)) {
      return res.status(400).json({ error: 'Invalid file type. Please upload .mbox, .pst, or .msg files.' });
    }

    // Read file content
    const fileContent = fs.readFileSync(file.filepath, 'utf8');
    
    // Parse emails based on file type
    let emails = [];
    
    if (fileExtension === '.mbox') {
      emails = parseMBOX(fileContent);
    } else if (fileExtension === '.pst' || fileExtension === '.msg') {
      // For now, return a placeholder for PST/MSG files
      // You would need a more sophisticated parser for these formats
      emails = [{
        id: 'placeholder',
        subject: 'PST/MSG files require additional parsing',
        from: 'system@propmap.com',
        to: uid,
        date: new Date().toISOString(),
        body: 'PST and MSG file parsing will be implemented in a future update. Please use MBOX format for now.',
        attachments: []
      }];
    }

    // Clean up temporary file
    fs.unlinkSync(file.filepath);

    // Store emails in Firestore
    const db = admin.firestore();
    const emailData = {
      emails: emails,
      uploaded_at: new Date().toISOString(),
      file_name: file.originalFilename,
      file_size: file.size,
      total_emails: emails.length
    };

    await db.collection('email_imports').doc(uid).set(emailData, { merge: true });

    console.log(`User ${uid} uploaded ${emails.length} emails from ${file.originalFilename}`);

    return res.status(200).json({
      success: true,
      emails: emails,
      total_emails: emails.length,
      file_name: file.originalFilename
    });

  } catch (error: any) {
    console.error('Error uploading emails:', error);
    return res.status(500).json({ 
      error: 'Failed to upload and parse emails', 
      details: error.message 
    });
  }
}
