import Anthropic from '@anthropic-ai/sdk';
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

// Tell Vercel to allow up to 60 seconds for this function
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a trend researcher for Locket, a curated discovery app for young women (18-24) who want to keep up with trends without overspending. Find REAL, CURRENT, SPECIFIC trending items using web search.

Respond ONLY with valid JSON, no markdown. Format:
{
  "posts": [
    {
      "category": "drink|beauty|deals|worthy",
      "title": "short punchy title (max 8 words)",
      "description": "2-3 sentences. specific, honest, helpful.",
      "originalPrice": "$XX or null",
      "locketPrice": "$XX (dupe/hack/sale price) or null",
      "savings": "save $XX or XX% off or null",
      "where": "store name or website",
      "link": "direct URL or null",
      "imageUrl": null
    }
  ]
}`;

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Single call for all categories — faster, avoids timeout
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Find 3 posts for each of these 4 categories (12 total) trending TODAY for girls 18-24:
1. drink — Starbucks hacks, food/drink trends, secret menu items
2. beauty — affordable dupes, viral products, Sephora finds
3. deals — sales, drops, limited time offers worth knowing about
4. worthy — honest "worth it or skip it" verdicts on hyped products

Be specific: real product names, actual prices, real stores. Use web search.`
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(500).json({ error: 'no text response from Claude' });
    }

    let parsed;
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      console.error('JSON parse error:', e, textBlock.text.slice(0, 200));
      return res.status(500).json({ error: 'JSON parse failed', raw: textBlock.text.slice(0, 200) });
    }

    const posts = (parsed.posts || []).filter(p => p.title && p.description);

    if (posts.length === 0) {
      return res.status(500).json({ error: 'no valid posts generated' });
    }

    // Save to Firestore
    const batch = db.batch();
    const now = Timestamp.now();
    posts.forEach(post => {
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
      drafted: posts.length,
      message: `✨ drafted ${posts.length} posts for review!`,
    });

  } catch(e) {
    console.error('Generate error:', e);
    return res.status(500).json({ error: e.message });
  }
}
