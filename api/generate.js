// Vercel Cron Job — runs every morning at 8am ET
// Calls Claude with web search to draft 12 trend posts → saves to Firestore as drafts

import Anthropic from '@anthropic-ai/sdk';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Init Firebase Admin (uses service account from env vars)
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

const CATEGORIES = [
  { id: 'drink',  label: 'Starbucks & food/drink trends',   count: 3 },
  { id: 'beauty', label: 'affordable beauty & dupes',        count: 3 },
  { id: 'deals',  label: 'deals, drops & sales',             count: 3 },
  { id: 'worthy', label: 'worth it or skip it verdicts',     count: 3 },
];

const SYSTEM_PROMPT = `You are a trend researcher for Locket, a curated discovery app for young women (18-24) who want to keep up with trends without overspending. Your job is to find REAL, CURRENT, SPECIFIC trending items.

For each post, find something genuinely trending RIGHT NOW — specific product names, actual prices, real stores. Not generic advice.

Respond ONLY with valid JSON, no markdown, no explanation. Format:
{
  "posts": [
    {
      "category": "drink|beauty|deals|worthy",
      "title": "short punchy title (max 8 words)",
      "description": "2-3 sentences. specific, honest, helpful. no fluff.",
      "originalPrice": "$XX (what it normally costs, or null)",
      "locketPrice": "$XX (dupe/hack/sale price, or null)",
      "savings": "save $XX or XX% off (or null)",
      "where": "where to find it — store name, website, or how to order",
      "link": "direct URL if available (or null)",
      "imageUrl": null
    }
  ]
}`;

export default async function handler(req, res) {
  // Verify this is called by Vercel Cron (or us for testing)
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const allPosts = [];

  for (const cat of CATEGORIES) {
    try {
      const userMsg = `Find ${cat.count} specific, currently trending ${cat.label} items that girls aged 18-24 would care about TODAY. Use web search to find real current trends, actual product names, real prices. Be specific — name the exact product, exact price, exact store.`;

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMsg }],
      });

      // Extract text content from response
      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock) continue;

      let parsed;
      try {
        const clean = textBlock.text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch(e) {
        console.error('JSON parse error for', cat.id, e);
        continue;
      }

      const posts = parsed.posts || [];
      posts.forEach(p => {
        if (p.title && p.description) {
          allPosts.push({ ...p, category: cat.id });
        }
      });
    } catch(e) {
      console.error('Generation error for', cat.id, e);
    }
  }

  // Save all drafted posts to Firestore
  const batch = db.batch();
  const now = Timestamp.now();

  allPosts.forEach(post => {
    const ref = db.collection('trendPosts').doc();
    batch.set(ref, {
      ...post,
      approved: false,
      publishedAt: null,
      createdAt: now,
      draftedAt: now,
    });
  });

  await batch.commit();

  return res.status(200).json({
    success: true,
    drafted: allPosts.length,
    message: `Drafted ${allPosts.length} posts for review`,
  });
}
