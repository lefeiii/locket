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

const CATEGORIES = [
  {
    id: 'drink',
    prompt: `Find 3 currently trending Starbucks or food/drink hacks for women 18-24 today.
For EACH item provide:
- title: the drink name (e.g. "Brown Sugar Oat Shaken Espresso Hack")
- description: EXACT ordering instructions — base drink + every customization with exact amounts (pumps, toppings, milk type, ice level). Format: "Start with a [size] [base drink]. Ask for: [customization 1], [customization 2]..."
- originalPrice: normal retail price (e.g. "$8.45")
- locketPrice: hack/dupe price (e.g. "$5.25 with rewards")
- savings: calculated difference (e.g. "save $3.20")
- where: "Starbucks app" or store name
- link: direct menu link (e.g. "https://www.starbucks.com/menu")
- imageUrl: a working direct image URL of this exact drink from Starbucks website, their CDN, or a food blog. Must end in .jpg, .png, or .webp`,
  },
  {
    id: 'beauty',
    prompt: `Find 3 trending affordable beauty products or dupes for women 18-24 today.
For EACH item provide:
- title: brand + product name (e.g. "e.l.f. Halo Glow Liquid Filter")
- description: ONE sentence — what it is and what it does (e.g. "Drugstore dupe for Charlotte Tilbury Flawless Filter that gives skin a glowy, blurred finish.")
- originalPrice: high-end original price (e.g. "$49.00")
- locketPrice: dupe/affordable price (e.g. "$14.00 at Target")
- savings: calculated (e.g. "save $35.00")
- where: exact store (e.g. "Target", "Ulta", "Amazon")
- link: direct product page URL (not homepage)
- imageUrl: working direct image URL of this exact product from the brand website, Ulta, Sephora, Target, or Amazon product page. Must end in .jpg, .png, or .webp`,
  },
  {
    id: 'deals',
    prompt: `Find 3 real active sales happening RIGHT NOW that women 18-24 would love (fashion, beauty, lifestyle).
For EACH item provide:
- title: brand + deal (e.g. "Aritzia Extra 30% Off Sale")
- description: ONE sentence — what's on sale and any promo code (e.g. "Extra 30% off sale styles, no code needed, applied at checkout.")
- originalPrice: example item original price (e.g. "$98.00")
- locketPrice: example item sale price (e.g. "$45.00")
- savings: calculated savings or percentage (e.g. "save 54%")
- where: store name
- link: direct sale page URL
- imageUrl: a working image URL showing a product from this sale or the brand's logo/banner. Must end in .jpg, .png, or .webp`,
  },
  {
    id: 'worthy',
    prompt: `Find 3 currently hyped products for women 18-24 — give an honest worth it or skip it verdict.
For EACH item provide:
- title: "Worth It: [product]" OR "Skip It: [product]" (e.g. "Worth It: Stanley Quencher 30oz")
- description: ONE honest sentence why (e.g. "Keeps drinks cold 12+ hours and fits car cupholders — the hype is real.")
- originalPrice: full retail price (e.g. "$45.00")
- locketPrice: best price you found (e.g. "$38.00 on Amazon")
- savings: savings vs retail (e.g. "save $7.00") or "best price" if cheapest
- where: where to buy
- link: direct product URL
- imageUrl: working direct image URL of this exact product. Must end in .jpg, .png, or .webp`,
  },
];

function cleanText(str) {
  if (!str) return null;
  return str
    .replace(/<cite[^>]*>/gi, '')
    .replace(/<\/cite>/gi, '')
    .replace(/\[\d+\]/g, '')
    .trim();
}

function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http')) return false;
  // Must look like a real image URL
  const lower = url.toLowerCase();
  return lower.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/) !== null ||
         lower.includes('/images/') ||
         lower.includes('/media/') ||
         lower.includes('cdn') ||
         lower.includes('image');
}

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const allPosts = [];

    for (const cat of CATEGORIES) {
      try {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          tools: [
            { type: 'web_search_20250305', name: 'web_search' },
            {
              name: 'save_posts',
              description: 'Save the trend posts you found',
              input_schema: {
                type: 'object',
                properties: {
                  posts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title:         { type: 'string' },
                        description:   { type: 'string' },
                        originalPrice: { type: 'string' },
                        locketPrice:   { type: 'string' },
                        savings:       { type: 'string' },
                        where:         { type: 'string' },
                        link:          { type: 'string' },
                        imageUrl:      { type: 'string', description: 'Direct image URL ending in .jpg/.png/.webp' },
                      },
                      required: ['title', 'description', 'originalPrice', 'locketPrice', 'savings', 'where', 'link', 'imageUrl'],
                    },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ['posts'],
              },
            },
          ],
          tool_choice: { type: 'any' },
          messages: [{ role: 'user', content: cat.prompt }],
        });

        for (const block of response.content) {
          if (block.type === 'tool_use' && block.name === 'save_posts') {
            const posts = block.input?.posts || [];
            posts.forEach(p => {
              if (p.title && p.description) {
                allPosts.push({
                  category:      cat.id,
                  title:         cleanText(p.title),
                  description:   cleanText(p.description),
                  originalPrice: cleanText(p.originalPrice) || null,
                  locketPrice:   cleanText(p.locketPrice) || null,
                  savings:       cleanText(p.savings) || null,
                  where:         cleanText(p.where) || null,
                  link:          p.link?.startsWith('http') ? p.link : null,
                  imageUrl:      isValidImageUrl(p.imageUrl) ? p.imageUrl : null,
                });
              }
            });
            break;
          }
        }
      } catch (catErr) {
        console.error(`Error for ${cat.id}:`, catErr.message);
      }
    }

    if (allPosts.length === 0) {
      return res.status(500).json({ error: 'no posts generated' });
    }

    const batch = db.batch();
    const now = Timestamp.now();
    allPosts.forEach(post => {
      const ref = db.collection('trendPosts').doc();
      batch.set(ref, { ...post, approved: false, publishedAt: null, createdAt: now, draftedAt: now });
    });
    await batch.commit();

    return res.status(200).json({
      success: true,
      drafted: allPosts.length,
      message: `✨ drafted ${allPosts.length} posts for review!`,
    });

  } catch (e) {
    console.error('Generate error:', e);
    return res.status(500).json({ error: e.message });
  }
}
