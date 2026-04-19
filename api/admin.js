// Admin API — approve, edit, or delete trend posts
// Protected by Firebase Auth — only your UID can call this

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db   = getFirestore();
const auth = getAuth();

const ADMIN_UID = process.env.ADMIN_UID; // your Firebase UID

async function verifyAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid === ADMIN_UID;
  } catch(e) { return false; }
}

export default async function handler(req, res) {
  if (!(await verifyAdmin(req))) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { action, postId, updates } = req.body || {};

  try {
    if (action === 'approve') {
      await db.collection('trendPosts').doc(postId).update({
        approved: true, publishedAt: Timestamp.now(), ...( updates || {} )
      });
      return res.json({ success: true });
    }

    if (action === 'reject') {
      await db.collection('trendPosts').doc(postId).delete();
      return res.json({ success: true });
    }

    if (action === 'update') {
      await db.collection('trendPosts').doc(postId).update(updates);
      return res.json({ success: true });
    }

    if (action === 'getDrafts') {
      const snap = await db.collection('trendPosts')
        .where('approved', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json({ posts });
    }

    if (action === 'trigger') {
      // Manually trigger generation
      const genRes = await fetch(`https://ourlockets.com/api/generate`, {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      });
      const data = await genRes.json();
      return res.json(data);
    }

    return res.status(400).json({ error: 'unknown action' });
  } catch(e) {
    console.error('Admin error:', e);
    return res.status(500).json({ error: e.message });
  }
}
