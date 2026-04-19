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
  { id: 'drink',  label: 'Starbucks & food/drink trends' },
  { id: 'beauty', label: 'affordable beauty & dupes' },
  { id: 'deals',  label: 'current deals & drops' },
  { id: 'worthy', label: 'worth it or skip it products' },
];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const allPosts = [];

    for (const cat of CATEGORIES) {
      try {
        // Use tool_use to force structured output — most reliable approach
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
            },
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
                      },
                      required: ['title', 'description', 'where'],
                    },
                    minItems: 2,
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
            content: `Search the web and find 3 specific, real, currently trending ${cat.label} items for women aged 18-24 today. Then call save_posts with what you found.`,
          }],
        });

        // Extract the save_posts tool call result
        for (const block of response.content) {
          if (block.type === 'tool_use' && block.name === 'save_posts') {
            const posts = block.input?.posts || [];
            posts.forEach(p => {
              if (p.title && p.description) {
                allPosts.push({ ...p, category: cat.id });
              }
            });
            break;
          }
        }
      } catch (catErr) {
        console.error(`Error for ${cat.id}:`, catErr.message);
        // Continue to next category even if one fails
      }
    }

    if (allPosts.length === 0) {
      return res.status(500).json({ error: 'no posts generated — all categories failed' });
    }

    // Save to Firestore
    const batch = db.batch();
    const now = Timestamp.now();
    allPosts.forEach(post => {
      const ref = db.collection('trendPosts').doc();
      batch.set(ref, {
        category:      post.category,
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
      drafted: allPosts.length,
      message: `✨ drafted ${allPosts.length} posts for review!`,
    });

  } catch (e) {
    console.error('Generate error:', e);
    return res.status(500).json({ error: e.message });
  }
}
