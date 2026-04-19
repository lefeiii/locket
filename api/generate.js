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
    prompt: `Find 3 currently trending Starbucks or food/drink items for women 18-24.
For each drink/food item you MUST provide:
- title: the name of the drink or item (e.g. "Brown Sugar Oat Shaken Espresso Hack")
- description: EXACT ordering instructions — start with the base drink, then list every customization with exact amounts (e.g. "Start with a Venti Iced Brown Sugar Oat Shaken Espresso. Ask for: oat milk, 3 pumps brown sugar syrup, 1 pump vanilla, light ice, sweet cream cold foam on top.")
- originalPrice: the normal Starbucks price for this size (e.g. "$8.45")
- locketPrice: the price after hack/discount or dupe cost (e.g. "$5.25 with rewards" or "$4.00 dupe at home")
- savings: calculated difference (e.g. "save $3.20")
- where: "Starbucks" or specific location/app
- link: direct link to the Starbucks menu item or ordering app if available, otherwise "https://www.starbucks.com/menu"`,
  },
  {
    id: 'beauty',
    prompt: `Find 3 currently trending affordable beauty products or dupes for women 18-24.
For each item you MUST provide:
- title: product name and brand (e.g. "e.l.f. Halo Glow Liquid Filter Dupe")
- description: ONE clear sentence describing what the product is and does (e.g. "A drugstore dupe for the Charlotte Tilbury Flawless Filter that gives skin a luminous, blurred finish.")
- originalPrice: price of the high-end original (e.g. "$49.00 for Charlotte Tilbury")
- locketPrice: price of the dupe/affordable version (e.g. "$14.00 at Target")
- savings: calculated difference (e.g. "save $35.00")
- where: exact store name (e.g. "Target", "Ulta", "Amazon")
- link: direct link to the product page (not the homepage — the actual product URL)`,
  },
  {
    id: 'deals',
    prompt: `Find 3 real active sales or deals happening RIGHT NOW that women 18-24 would care about (fashion, beauty, lifestyle).
For each deal you MUST provide:
- title: brand name + deal (e.g. "Aritzia Extra 30% Off Sale Section")
- description: ONE sentence on what's on sale and any code needed (e.g. "Extra 30% off already-reduced styles — no code needed, applied at checkout.")
- originalPrice: example original item price (e.g. "$98.00")
- locketPrice: example sale price after discount (e.g. "$45.00")
- savings: calculated savings or percentage (e.g. "save 54%")
- where: store name
- link: direct link to the sale page`,
  },
  {
    id: 'worthy',
    prompt: `Find 3 currently hyped products that women 18-24 are debating — give an honest "worth it or skip it" verdict.
For each item you MUST provide:
- title: "Worth It: [product]" or "Skip It: [product]" (e.g. "Worth It: Stanley Quencher 30oz")
- description: ONE honest sentence on why it's worth it or not (e.g. "Genuinely keeps drinks cold for 12+ hours and fits most car cupholders — the hype is real.")
- originalPrice: full retail price (e.g. "$45.00")
- locketPrice: best price available / where to get it cheaper (e.g. "$38.00 on Amazon")
- savings: savings if applicable (e.g. "save $7.00") or "best price" if no cheaper option
- where: where to buy it
- link: direct product link`,
  },
];

function cleanText(str) {
  if (!str) return str;
  // Strip <cite> tags and their content markers
  return str
    .replace(/<cite[^>]*>/gi, '')
    .replace(/<\/cite>/gi, '')
    .replace(/\[\d+\]/g, '')
    .trim();
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
                        title:         { type: 'string', description: 'Short punchy title' },
                        description:   { type: 'string', description: 'Detailed description per category rules' },
                        originalPrice: { type: 'string', description: 'Original price, e.g. $49.00' },
                        locketPrice:   { type: 'string', description: 'Sale/dupe price, e.g. $14.00' },
                        savings:       { type: 'string', description: 'Calculated savings, e.g. save $35.00' },
                        where:         { type: 'string', description: 'Store or website name' },
                        link:          { type: 'string', description: 'Direct URL to product page' },
                      },
                      required: ['title', 'description', 'originalPrice', 'locketPrice', 'savings', 'where', 'link'],
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
          messages: [{
            role: 'user',
            content: cat.prompt,
          }],
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
                  link:          p.link && p.link.startsWith('http') ? p.link : null,
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
      batch.set(ref, { ...post, imageUrl: null, approved: false, publishedAt: null, createdAt: now, draftedAt: now });
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
