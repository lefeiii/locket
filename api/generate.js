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

function cleanText(str) {
  if (!str) return null;
  return str.replace(/<cite[^>]*>/gi,'').replace(/<\/cite>/gi,'').replace(/\[\d+\]/g,'').trim() || null;
}

function validUrl(url) {
  return url && typeof url === 'string' && url.startsWith('http') ? url : null;
}

const SAVE_TOOL = {
  name: 'save_posts',
  description: 'Save the 3 trend posts you researched',
  input_schema: {
    type: 'object',
    properties: {
      posts: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['title','description','originalPrice','locketPrice','savings','where','link','imageUrl'],
          properties: {
            title:         { type: 'string' },
            description:   { type: 'string' },
            originalPrice: { type: 'string' },
            locketPrice:   { type: 'string' },
            savings:       { type: 'string' },
            where:         { type: 'string' },
            link:          { type: 'string' },
            imageUrl:      { type: 'string' },
          },
        },
      },
    },
    required: ['posts'],
  },
};

const PROMPTS = [
  {
    id: 'drink',
    msg: `Search for 3 trending Starbucks drink hacks or secret menu items popular with women 18-24 right now.
For each drink call save_posts with:
- title: drink name
- description: exact ordering instructions (base drink + each customization with amounts)
- originalPrice: normal Starbucks price
- locketPrice: hack/cheaper price
- savings: dollar amount saved
- where: "Starbucks"
- link: https://www.starbucks.com/menu
- imageUrl: find a direct .jpg or .png image of this drink from starbucks.com or a food blog`,
  },
  {
    id: 'beauty',
    msg: `Search for 3 affordable beauty dupes or viral drugstore products trending for women 18-24 right now.
For each product call save_posts with:
- title: brand and product name
- description: one sentence what it is and what it does
- originalPrice: high-end original price
- locketPrice: dupe/drugstore price
- savings: amount saved
- where: store name (Target, Ulta, Amazon etc)
- link: direct product page URL
- imageUrl: direct .jpg or .png image URL from the brand, Target, Ulta, or Amazon product page`,
  },
  {
    id: 'deals',
    msg: `Search for 3 real sales or deals active RIGHT NOW that women 18-24 would care about (fashion, beauty, lifestyle).
For each deal call save_posts with:
- title: brand name and deal description
- description: one sentence what is on sale and any promo code
- originalPrice: typical item price before sale
- locketPrice: sale price
- savings: percent or dollar savings
- where: store name
- link: direct sale page URL
- imageUrl: find a direct image URL related to this deal. Use images from: i.imgur.com, upload.wikimedia.org, images.unsplash.com, or cdn.pixabay.com. Must be a direct image URL ending in .jpg .png or .webp`,
  },
  {
    id: 'worthy',
    msg: `Search for 3 hyped products women 18-24 are debating buying. Give an honest worth it or skip it verdict for each.
For each call save_posts with:
- title: start with "Worth It: " or "Skip It: " then the product name
- description: one honest sentence explaining the verdict
- originalPrice: full retail price
- locketPrice: best price available online
- savings: savings vs retail or "best price"
- where: best place to buy
- link: direct product URL
- imageUrl: find a direct image URL of this product. Use images from: i.imgur.com, upload.wikimedia.org, images.unsplash.com, or cdn.pixabay.com. Must be a direct image URL ending in .jpg .png or .webp`,
  },
];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Filter to only requested categories (or all if none specified)
  let body = {};
  try { body = req.body || {}; } catch(_) {}
  const requestedCats = Array.isArray(body.categories) && body.categories.length > 0
    ? body.categories
    : null; // null = all categories

  const activePrompts = requestedCats
    ? PROMPTS.filter(p => requestedCats.includes(p.id))
    : PROMPTS;

  if (activePrompts.length === 0) {
    return res.status(400).json({ error: 'no valid categories selected' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const allPosts = [];
  const errors = [];

  for (const cat of activePrompts) {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tools: [
          { type: 'web_search_20250305', name: 'web_search' },
          SAVE_TOOL,
        ],
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: cat.msg }],
      });

      // Find the save_posts tool call
      const saveCall = response.content.find(b => b.type === 'tool_use' && b.name === 'save_posts');
      
      if (!saveCall) {
        // Fallback: maybe it returned text — log what we got
        const textBlock = response.content.find(b => b.type === 'text');
        errors.push(`${cat.id}: no save_posts call. stop_reason=${response.stop_reason}. text=${textBlock?.text?.slice(0,100)}`);
        continue;
      }

      const posts = saveCall.input?.posts || [];
      let added = 0;
      posts.forEach(p => {
        if (p.title && p.description) {
          allPosts.push({
            category:      cat.id,
            title:         cleanText(p.title),
            description:   cleanText(p.description),
            originalPrice: cleanText(p.originalPrice),
            locketPrice:   cleanText(p.locketPrice),
            savings:       cleanText(p.savings),
            where:         cleanText(p.where),
            link:          validUrl(p.link),
            imageUrl:      validUrl(p.imageUrl),
            approved:      false,
            publishedAt:   null,
            createdAt:     Timestamp.now(),
            draftedAt:     Timestamp.now(),
          });
          added++;
        }
      });
      if (added === 0) errors.push(`${cat.id}: save_posts called but 0 valid posts`);

    } catch (e) {
      errors.push(`${cat.id}: ${e.message}`);
    }
  }

  if (allPosts.length === 0) {
    return res.status(500).json({ 
      error: 'no posts generated',
      details: errors,
    });
  }

  // Save to Firestore
  try {
    const batch = db.batch();
    allPosts.forEach(post => {
      batch.set(db.collection('trendPosts').doc(), post);
    });
    await batch.commit();
  } catch (e) {
    return res.status(500).json({ error: 'firestore save failed: ' + e.message });
  }

  return res.status(200).json({
    success: true,
    drafted: allPosts.length,
    message: `✨ drafted ${allPosts.length} posts!`,
    warnings: errors.length ? errors : undefined,
  });
}
