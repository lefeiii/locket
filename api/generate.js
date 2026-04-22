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
  description: 'Save the trend posts you found',
  input_schema: {
    type: 'object',
    properties: {
      skip: {
        type: 'boolean',
        description: 'Set to true if nothing genuinely new is trending today in this category — saves money by not generating duplicate content',
      },
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
      skip: {
        type: 'boolean',
        description: 'Set to true if there is genuinely nothing new to report in this category today',
      },
    },
    required: [],
  },
};

const PROMPTS = [
  {
    id: 'drink',
    msg: (recent) => `Search TikTok, Instagram Reels, and food blogs for Starbucks drink hacks or secret menu items going viral RIGHT NOW in the last 48 hours. Focus on things trending on TikTok FYP.

${recent}

For each NEW drink (not in the recent list above) call save_posts with:
- title: drink name
- description: EXACT ordering instructions — base drink + each customization with exact amounts (pumps, milk type, toppings, ice level). Format: "Start with a [size] [base]. Ask for: [customization 1], [customization 2]..."
- originalPrice: the price on starbucks.com for this drink and size
- locketPrice: the hack/cheaper price (e.g. with Starbucks rewards, or cheaper dupe)
- savings: dollar amount saved
- where: "Starbucks app" or "Starbucks"
- link: https://www.starbucks.com/menu
- imageUrl: a direct .jpg or .png image URL from i.imgur.com, images.unsplash.com, or upload.wikimedia.org

If nothing genuinely new is trending today, set skip: true in save_posts.`,
  },
  {
    id: 'beauty',
    msg: (recent) => `Search TikTok, Instagram Reels, and beauty blogs for affordable beauty products or viral drugstore dupes trending RIGHT NOW in the last 48 hours. Look for things blowing up on TikTok BeautyTok.

${recent}

For each NEW product (not in the recent list above) call save_posts with:
- title: brand and product name
- description: one sentence — what it is and what it does
- originalPrice: the price on the brand's OFFICIAL website (not Amazon, not Target)
- locketPrice: drugstore/dupe price at the cheapest retailer
- savings: amount saved vs the original
- where: exact store name (Target, Ulta, Amazon, etc)
- link: direct product page URL
- imageUrl: direct .jpg or .png image from i.imgur.com, images.unsplash.com, or the brand's official CDN

If nothing genuinely new is trending today, set skip: true in save_posts.`,
  },
  {
    id: 'deals',
    msg: (recent) => `Search TikTok, Instagram, and deal sites for EXCLUSIVE or VIRAL sales and drops happening RIGHT NOW that girls 18-24 are talking about. Look for things like limited time student discounts, flash sales, brand drops, secret promo codes being shared on TikTok. NOT generic "store is having a sale" — find the ones people are actually rushing for.

${recent}

For each NEW deal (not in the recent list above) call save_posts with:
- title: brand + deal (e.g. "Starbucks $1 Bear Cup for Students Until April 25th")
- description: one sentence — what the deal is, any code needed, and deadline if applicable
- originalPrice: original item price from the brand's official website
- locketPrice: the sale/deal price
- savings: percent or dollar savings
- where: exact store name or app
- link: direct link to the sale or deal page
- imageUrl: direct .jpg or .png image from i.imgur.com, images.unsplash.com, or brand CDN

If nothing genuinely new or exciting is happening today, set skip: true in save_posts.`,
  },
  {
    id: 'worthy',
    msg: (recent) => `Search TikTok and Instagram for hyped products women 18-24 are currently debating buying — things that are viral RIGHT NOW. Look at TikTok reviews, "is it worth it" videos trending in the last 48 hours.

${recent}

For each NEW product (not in the recent list above) call save_posts with:
- title: "Worth It: [product]" OR "Skip It: [product]"
- description: one honest sentence explaining the verdict based on real reviews
- originalPrice: price on the brand's OFFICIAL website
- locketPrice: best price found online right now
- savings: savings vs official price, or "best price" if cheapest
- where: best place to buy it
- link: direct product URL
- imageUrl: direct .jpg or .png image from i.imgur.com, images.unsplash.com, or brand CDN

If nothing genuinely new is being hyped today, set skip: true in save_posts.`,
  },
];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let body = {};
  try { body = req.body || {}; } catch(_) {}
  const requestedCats = Array.isArray(body.categories) && body.categories.length > 0
    ? body.categories : null;

  const activePrompts = requestedCats
    ? PROMPTS.filter(p => requestedCats.includes(p.id))
    : PROMPTS;

  if (activePrompts.length === 0) {
    return res.status(400).json({ error: 'no valid categories selected' });
  }

  // Fetch recent posts (last 7 days) to avoid repeats
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSnap = await db.collection('trendPosts')
    .where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
    .limit(100)
    .get();

  const recentByCategory = {};
  recentSnap.docs.forEach(d => {
    const p = d.data();
    if (!recentByCategory[p.category]) recentByCategory[p.category] = [];
    if (p.title) recentByCategory[p.category].push(p.title);
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const allPosts = [];
  const errors = [];
  let skipped = 0;

  for (const cat of activePrompts) {
    try {
      const recentTitles = recentByCategory[cat.id] || [];
      const recentBlock = recentTitles.length > 0
        ? `IMPORTANT — these were already posted recently, do NOT repeat them:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
        : '';

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tools: [
          { type: 'web_search_20250305', name: 'web_search' },
          SAVE_TOOL,
        ],
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: cat.msg(recentBlock) }],
      });

      const saveCall = response.content.find(b => b.type === 'tool_use' && b.name === 'save_posts');
      if (!saveCall) {
        const tb = response.content.find(b => b.type === 'text');
        errors.push(`${cat.id}: no save_posts call. text=${tb?.text?.slice(0,80)}`);
        continue;
      }

      // If AI says nothing new, skip this category
      if (saveCall.input?.skip === true) {
        skipped++;
        continue;
      }

      const posts = saveCall.input?.posts || [];
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
        }
      });
    } catch(e) {
      errors.push(`${cat.id}: ${e.message}`);
    }
  }

  if (allPosts.length === 0 && skipped === 0) {
    return res.status(500).json({ error: 'no posts generated', details: errors });
  }

  // Save to Firestore
  try {
    const batch = db.batch();
    allPosts.forEach(post => batch.set(db.collection('trendPosts').doc(), post));
    await batch.commit();
  } catch(e) {
    return res.status(500).json({ error: 'firestore save failed: ' + e.message });
  }

  return res.status(200).json({
    success: true,
    drafted: allPosts.length,
    skipped,
    message: allPosts.length > 0
      ? `✨ drafted ${allPosts.length} posts!${skipped > 0 ? ` (${skipped} categories had nothing new)` : ''}`
      : `nothing new today — all ${skipped} categories are up to date!`,
    warnings: errors.length ? errors : undefined,
  });
}
