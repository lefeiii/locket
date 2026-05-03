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
      posts: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
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
            expiresAt:     { type: 'string', description: 'ISO date YYYY-MM-DD if this deal has a known end date, otherwise omit' },
          },
        },
      },
      skip: {
        type: 'boolean',
        description: 'Set to true if there is genuinely nothing new to report today',
      },
    },
    required: ['posts'],
  },
};

const PROMPTS = [
  {
    id: 'drink',
    msg: (recent, ctx={}) => `You are a Starbucks expert finding viral drink hacks for women 18-24.
${ctx.isSaturday ? `TODAY IS SATURDAY STARBIES DAY 🩷☕ — Find 5 of the best Starbucks drinks trending right now. This is a special weekly themed drop for girls who go to Starbucks on Saturdays after a week of school. Make them feel like they're in on a secret.` : 'Find 4 trending Starbucks drinks.'}

STEP 1: Search TikTok and Instagram for Starbucks drinks going viral RIGHT NOW in the last 48 hours.

STEP 2: For each drink you find, go to starbucks.com/menu and find the EXACT price for that drink size. Do not estimate — look it up directly.

STEP 3: Calculate the hack price accurately. If using Starbucks Rewards, find the actual stars/redemption cost. If it's a DIY dupe, find the actual ingredient cost.

${recent}

Find 4 drinks if today is Saturday (it's a special Starbies day!), otherwise find 3. For each NEW drink (not in recent list) call save_posts with:
- title: the drink name (clear and specific)
- description: EXACT ordering instructions — "Start with a [Venti/Grande/etc] [base drink]. Ask for: [each customization with exact pumps/amounts/specifics]."
- originalPrice: the price you found on starbucks.com for this exact drink and size (e.g. "$7.45"). ONLY use starbucks.com prices.
- locketPrice: the actual hack price with your working (e.g. "$4.25 with Gold Stars" or "$3.50 DIY at home")
- savings: calculated difference (e.g. "save $3.20")
- where: "Starbucks app" or "Starbucks"
- link: the direct starbucks.com menu URL for this drink if it exists, otherwise "https://www.starbucks.com/menu"
- imageUrl: search for a direct image URL of this specific drink ending in .jpg or .png from starbucks.com, starbuckscdn.com, or a well-known food blog

PRICING ACCURACY IS CRITICAL. Double-check every price before saving. If you cannot verify a price with certainty, do not include that post.

If nothing genuinely new is trending today, set skip: true.`,
  },
  {
    id: 'beauty',
    msg: (recent, ctx={}) => `You are a beauty expert finding viral makeup, skincare, and haircare finds for women 18-24. STRICTLY makeup, skincare, and haircare — no clothing, accessories, or food.

STEP 1: Search TikTok BeautyTok and Instagram Reels for makeup/skincare/haircare products going viral RIGHT NOW in the last 48 hours.

STEP 2: For the original (high-end) product — go directly to the brand's official website and find the exact current price. Screenshot mentally and confirm the number.

STEP 3: For the dupe/affordable version — go to the retailer's product page (Target.com, Ulta.com, Amazon.com) and find the exact listed price right now. Confirm it is currently in stock at that price.

${recent}

Find 4 products today. For each NEW product (not in recent list) call save_posts with:
- title: "Brand + Product Name" or "Brand Dupe for [High-End Product]"
- description: one clear sentence — what it is, what it does, why people love it
- originalPrice: the price you found on the BRAND'S OWN WEBSITE (e.g. Charlotte Tilbury's site, not Sephora). Format: "$XX.XX at [Brand Name]"
- locketPrice: the exact price you found on the retailer page right now. Format: "$XX.XX at Target" or "$XX.XX on Amazon"
- savings: calculated difference (e.g. "save $35.00")
- where: exact retailer name (Target, Ulta, Amazon, Drugstore, etc)
- link: direct URL to the affordable product's page on the retailer site
- imageUrl: direct .jpg or .png image URL of the product from the retailer or brand's CDN

PRICING ACCURACY IS CRITICAL. Go to the actual product pages and read the prices. Do not guess or estimate. If you cannot verify both prices with certainty, do not include that post.

If nothing genuinely new is trending today in beauty, set skip: true.`,
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

  // Saturday Starbies — drinks only on Saturdays with special messaging
  const isSaturday = new Date().getDay() === 6;

  const activePrompts = requestedCats
    ? PROMPTS.filter(p => requestedCats.includes(p.id))
    : isSaturday
      ? PROMPTS.filter(p => p.id === 'drink')  // Saturdays = drinks only
      : PROMPTS;

  // Flag for Saturday so prompt knows
  const context = { isSaturday };

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
        ? `IMPORTANT — already posted recently, do NOT repeat:\n${recentTitles.map(t => `- ${t}`).join('\n')}`
        : '';

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        tools: [
          { type: 'web_search_20250305', name: 'web_search' },
          SAVE_TOOL,
        ],
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: cat.msg(recentBlock, context) }],
      });

      const saveCall = response.content.find(b => b.type === 'tool_use' && b.name === 'save_posts');
      if (!saveCall) {
        const tb = response.content.find(b => b.type === 'text');
        errors.push(`${cat.id}: no save_posts call. text=${tb?.text?.slice(0,80)}`);
        continue;
      }

      if (saveCall.input?.skip === true) {
        skipped++;
        continue;
      }

      const posts = saveCall.input?.posts || [];
      posts.forEach(p => {
        if (p.title && p.description) {
          let expiresAt = null;
          if (p.expiresAt) {
            try {
              const d = new Date(p.expiresAt);
              if (!isNaN(d.getTime())) expiresAt = Timestamp.fromDate(d);
            } catch(_) {}
          }
          allPosts.push({
            category:      cat.id,
            isSaturdayStarbies: context.isSaturday && cat.id === 'drink',
            title:         cleanText(p.title),
            description:   cleanText(p.description),
            originalPrice: cleanText(p.originalPrice),
            locketPrice:   cleanText(p.locketPrice),
            savings:       cleanText(p.savings),
            where:         cleanText(p.where),
            link:          validUrl(p.link),
            imageUrl:      validUrl(p.imageUrl),
            expiresAt,
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
      ? `✨ drafted ${allPosts.length} posts!${skipped > 0 ? ` (${skipped} had nothing new)` : ''}`
      : `nothing new today!`,
    warnings: errors.length ? errors : undefined,
  });
}
