// Daily cleanup — removes approved posts whose expiresAt has passed
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();
export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const now = Timestamp.now();

    // Find all posts with an expiresAt in the past
    const snap = await db.collection('trendPosts')
      .where('expiresAt', '<=', now)
      .limit(50)
      .get();

    if (snap.empty) {
      return res.status(200).json({ success: true, removed: 0, message: 'no expired posts found' });
    }

    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    return res.status(200).json({
      success: true,
      removed: snap.size,
      message: `🗑️ removed ${snap.size} expired posts`,
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
