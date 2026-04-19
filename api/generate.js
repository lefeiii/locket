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

export const maxDuration = 60;

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `You are a trend researcher for Locket, a curated app for women 18-24 who want to keep up with trends without overspending.

Use web search to find 12 real, current, specific trending items TODAY across these 4 categories (3 each):
- drink: Starbucks hacks, food/drink trends, secret menu items
- beauty: affordable dupes, viral products, Sephora finds  
- deals: sales, drops, limited time offers
- worthy: honest "worth it or skip it" verdicts on hyped products

Return ONLY a JSON array, nothing else, no markdown, no explanation:
[
  {
    "category": "drink",
    "title": "short punchy title",
    "description": "2-3 specific sentences",
    "originalPrice": "$XX or null",
    "locketPrice": "$XX or null",
    "savings": "save $XX or null",
    "where": "store or website name",
    "link": "https://... or null"
  }
]`
      }],
    });

    // Extract text from response — handle all content block types
    let rawText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        rawText += block.text;
      }
    }

    // Aggressively extract JSON array from whatever Claude returned
    let posts = [];
    
    // Try 1: direct parse
    try {
      const direct = rawText.trim();
      posts = JSON.parse(direct);
    } catch(_) {}

    // Try 2: extract JSON array between first [ and last ]
    if (!posts.length) {
      try {
        const start = rawText.indexOf('[');
        const end = rawText.lastIndexOf(']');
        if (start !== -1 && end > start) {
          posts = JSON.parse(rawText.slice(start, end + 1));
        }
      } catch(_) {}
    }

    // Try 3: extract from code block
    if (!posts.length) {
      try {
        const match = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
        if (match) posts = JSON.parse(match[1]);
      } catch(_) {}
    }

    // Validate posts
    posts = (Array.isArray(posts) ? posts : [])
      .filter(p => p && p.title && p.description && p.category);

    if (posts.length === 0) {
      return res.status(500).json({ 
        error: 'no valid posts extracted',
        raw: rawText.slice(0, 300)
      });
    }

    // Save to Firestore
    const batch = db.batch();
    const now = Timestamp.now();
    posts.forEach(post => {
      const ref = db.collection('trendPosts').doc();
      batch.set(ref, {
        category:      post.category || 'deals',
        title:         post.title || '',
        description:   post.description || '',
        originalPrice: post.originalPrice || null,
        locketPrice:   post.locketPrice || null,
        savings:       post.savings || null,
        where:         post.where || null,
        link:          post.link || null,
        imageUrl:      null,
        approved:      false,
        publishedAt:   null,
        createdAt:     now,
        draftedAt:     now,
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
