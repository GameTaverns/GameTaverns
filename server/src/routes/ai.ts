import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { config } from '../config.js';

const router = Router();

// =====================
// AI Configuration Check
// =====================

function getAIConfig() {
  const perplexityKey = config.perplexityApiKey;
  const openaiKey = config.openaiApiKey;
  const firecrawlKey = config.firecrawlApiKey;
  
  return {
    hasAI: !!(perplexityKey || openaiKey),
    hasFirecrawl: !!firecrawlKey,
    provider: perplexityKey ? 'perplexity' : openaiKey ? 'openai' : null,
  };
}

async function aiComplete(messages: Array<{ role: string; content: string }>, maxTokens = 1000): Promise<{ success: boolean; content?: string; error?: string }> {
  const { hasAI, provider } = getAIConfig();
  
  if (!hasAI) {
    return { success: false, error: 'AI service not configured' };
  }
  
  try {
    if (provider === 'perplexity') {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages,
          max_tokens: maxTokens,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Perplexity API error:', response.status, error);
        return { success: false, error: `AI request failed: ${response.status}` };
      }
      
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return { success: true, content: data.choices?.[0]?.message?.content };
    } else {
      // OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: maxTokens,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error:', response.status, error);
        return { success: false, error: `AI request failed: ${response.status}` };
      }
      
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return { success: true, content: data.choices?.[0]?.message?.content };
    }
  } catch (error) {
    console.error('AI request error:', error);
    return { success: false, error: 'AI request failed' };
  }
}

// =====================
// Status endpoint
// =====================

router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const aiConfig = getAIConfig();
  res.json({
    ai: {
      configured: aiConfig.hasAI,
      provider: aiConfig.provider,
    },
    firecrawl: {
      configured: aiConfig.hasFirecrawl,
    },
  });
});

// =====================
// Import Game from URL (Firecrawl + AI)
// =====================

const DIFFICULTY_LEVELS = ['1 - Light', '2 - Medium Light', '3 - Medium', '4 - Medium Heavy', '5 - Heavy'];
const PLAY_TIME_OPTIONS = ['0-15 Minutes', '15-30 Minutes', '30-45 Minutes', '45-60 Minutes', '60+ Minutes', '2+ Hours', '3+ Hours'];
const GAME_TYPE_OPTIONS = ['Board Game', 'Card Game', 'Dice Game', 'Party Game', 'War Game', 'Miniatures', 'RPG', 'Other'];

router.post('/import-game', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      url: z.string().url(),
      library_id: z.string().uuid().optional(),
      is_coming_soon: z.boolean().optional(),
      is_for_sale: z.boolean().optional(),
      sale_price: z.number().optional(),
      sale_condition: z.string().optional(),
      is_expansion: z.boolean().optional(),
      parent_game_id: z.string().uuid().optional(),
      location_room: z.string().optional(),
      location_shelf: z.string().optional(),
      location_misc: z.string().optional(),
    });
    
    const data = schema.parse(req.body);
    const userId = req.user!.sub;
    
    // Get user's library if not specified
    let libraryId = data.library_id;
    if (!libraryId) {
      const libResult = await pool.query(
        'SELECT id FROM libraries WHERE owner_id = $1',
        [userId]
      );
      if (libResult.rows.length === 0) {
        res.status(400).json({ success: false, error: 'No library specified and user has no library' });
        return;
      }
      libraryId = libResult.rows[0].id;
    }
    
    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT id FROM libraries WHERE id = $1 AND owner_id = $2',
      [libraryId, userId]
    );
    
    // Also check admin
    const adminCheck = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
      [userId, 'admin']
    );
    
    if (ownerCheck.rows.length === 0 && adminCheck.rows.length === 0) {
      res.status(403).json({ success: false, error: 'Not authorized for this library' });
      return;
    }
    
    // Check Firecrawl config
    if (!config.firecrawlApiKey) {
      res.status(503).json({ success: false, error: 'Import service not configured (missing FIRECRAWL_API_KEY)' });
      return;
    }
    
    // Check AI config
    const aiConfig = getAIConfig();
    if (!aiConfig.hasAI) {
      res.status(503).json({ success: false, error: 'AI service not configured (missing PERPLEXITY_API_KEY or OPENAI_API_KEY)' });
      return;
    }
    
    // Step 1: Scrape with Firecrawl
    console.log('Scraping URL:', data.url);
    
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: data.url,
        formats: ['markdown', 'rawHtml'],
        onlyMainContent: true,
      }),
    });
    
    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('Firecrawl error:', scrapeResponse.status, errorText);
      res.status(502).json({ success: false, error: `Failed to scrape page: ${scrapeResponse.status}` });
      return;
    }
    
    const scrapeData = await scrapeResponse.json() as { data?: { markdown?: string; rawHtml?: string }; markdown?: string; rawHtml?: string };
    const markdown = scrapeData.data?.markdown || scrapeData.markdown;
    const rawHtml = scrapeData.data?.rawHtml || scrapeData.rawHtml || '';
    
    if (!markdown) {
      res.status(400).json({ success: false, error: 'Could not extract content from the page' });
      return;
    }
    
    // Extract images from HTML
    const imageRegex = /https?:\/\/cf\.geekdo-images\.com[^\s"'<>]+/g;
    const allImageMatches = rawHtml.match(imageRegex) || [];
    const uniqueImages = [...new Set(allImageMatches)] as string[];
    const filteredImages = uniqueImages.filter(img => !/crop100|square30|100x100|_thumb|_avatar/i.test(img));
    const sortedImages = filteredImages.sort((a, b) => {
      const getPriority = (url: string) => {
        if (/_itemrep/i.test(url)) return 0;
        if (/_imagepage/i.test(url)) return 1;
        return 2;
      };
      return getPriority(a) - getPriority(b);
    });
    const mainImage = sortedImages[0] || null;
    
    // Step 2: Extract with AI
    console.log('Extracting game data with AI...');
    
    const aiResult = await aiComplete([
      {
        role: 'system',
        content: `You are a board game data extraction expert. Extract structured game information from the provided content.
        
Return a JSON object with these fields:
- title (string, required)
- description (string, 150-200 words with markdown formatting)
- difficulty (one of: ${DIFFICULTY_LEVELS.join(', ')})
- play_time (one of: ${PLAY_TIME_OPTIONS.join(', ')})
- game_type (one of: ${GAME_TYPE_OPTIONS.join(', ')})
- min_players (number)
- max_players (number)
- suggested_age (string like "10+")
- mechanics (array of strings like "Worker Placement", "Set Collection")
- publisher (string)
- is_expansion (boolean)
- base_game_title (string, if is_expansion is true)

Return ONLY valid JSON, no markdown code blocks.`,
      },
      {
        role: 'user',
        content: `Extract game data from this page:\n\nURL: ${data.url}\n\nContent:\n${markdown.slice(0, 15000)}`,
      },
    ], 1500);
    
    if (!aiResult.success || !aiResult.content) {
      console.error('AI extraction failed:', aiResult.error);
      res.status(500).json({ success: false, error: 'Failed to extract game data' });
      return;
    }
    
    // Parse AI response
    let extracted;
    try {
      // Clean up response - remove markdown code blocks if present
      let content = aiResult.content.trim();
      if (content.startsWith('```json')) content = content.slice(7);
      if (content.startsWith('```')) content = content.slice(3);
      if (content.endsWith('```')) content = content.slice(0, -3);
      extracted = JSON.parse(content.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResult.content);
      res.status(500).json({ success: false, error: 'Failed to parse game data' });
      return;
    }
    
    if (!extracted.title) {
      res.status(400).json({ success: false, error: 'Could not find game title' });
      return;
    }
    
    // Extract BGG ID from URL
    const bggIdMatch = data.url.match(/boardgame\/(\d+)/);
    const bggId = bggIdMatch?.[1] || null;
    
    // Check for duplicates
    if (bggId) {
      const dupCheck = await pool.query(
        'SELECT id, title FROM games WHERE bgg_id = $1 AND library_id = $2',
        [bggId, libraryId]
      );
      if (dupCheck.rows.length > 0) {
        res.status(409).json({ 
          success: false, 
          error: `Game already exists: ${dupCheck.rows[0].title}`,
          existingId: dupCheck.rows[0].id,
        });
        return;
      }
    }
    
    // Handle mechanics
    const mechanicIds: string[] = [];
    if (extracted.mechanics && Array.isArray(extracted.mechanics)) {
      for (const mechanicName of extracted.mechanics) {
        const existing = await pool.query(
          'SELECT id FROM mechanics WHERE name = $1',
          [mechanicName]
        );
        if (existing.rows.length > 0) {
          mechanicIds.push(existing.rows[0].id);
        } else {
          const created = await pool.query(
            'INSERT INTO mechanics (name) VALUES ($1) RETURNING id',
            [mechanicName]
          );
          mechanicIds.push(created.rows[0].id);
        }
      }
    }
    
    // Handle publisher
    let publisherId: string | null = null;
    if (extracted.publisher) {
      const existingPub = await pool.query(
        'SELECT id FROM publishers WHERE name = $1',
        [extracted.publisher]
      );
      if (existingPub.rows.length > 0) {
        publisherId = existingPub.rows[0].id;
      } else {
        const createdPub = await pool.query(
          'INSERT INTO publishers (name) VALUES ($1) RETURNING id',
          [extracted.publisher]
        );
        publisherId = createdPub.rows[0].id;
      }
    }
    
    // Handle parent game for expansions
    let parentGameId = data.parent_game_id || null;
    if (extracted.is_expansion && extracted.base_game_title && !parentGameId) {
      const parentSearch = await pool.query(
        'SELECT id FROM games WHERE library_id = $1 AND LOWER(title) = LOWER($2) AND is_expansion = false',
        [libraryId, extracted.base_game_title]
      );
      if (parentSearch.rows.length > 0) {
        parentGameId = parentSearch.rows[0].id;
      }
    }
    
    // Insert the game
    const insertResult = await pool.query(
      `INSERT INTO games (
        library_id, title, description, image_url, min_players, max_players,
        difficulty, play_time, game_type, suggested_age, publisher_id,
        bgg_id, bgg_url, is_expansion, parent_game_id,
        is_coming_soon, is_for_sale, sale_price, sale_condition,
        location_room, location_shelf, location_misc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        libraryId,
        extracted.title,
        extracted.description || null,
        mainImage,
        extracted.min_players || 1,
        extracted.max_players || 4,
        extracted.difficulty || '3 - Medium',
        extracted.play_time || '45-60 Minutes',
        extracted.game_type || 'Board Game',
        extracted.suggested_age || '10+',
        publisherId,
        bggId,
        data.url.includes('boardgamegeek.com') ? data.url : null,
        data.is_expansion ?? extracted.is_expansion ?? false,
        parentGameId,
        data.is_coming_soon ?? false,
        data.is_for_sale ?? false,
        data.sale_price || null,
        data.sale_condition || null,
        data.location_room || null,
        data.location_shelf || null,
        data.location_misc || null,
      ]
    );
    
    const game = insertResult.rows[0];
    
    // Link mechanics
    for (const mechId of mechanicIds) {
      await pool.query(
        'INSERT INTO game_mechanics (game_id, mechanic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [game.id, mechId]
      );
    }
    
    console.log('Game imported:', game.title);
    
    res.status(201).json({ success: true, game });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Import game error:', error);
    res.status(500).json({ success: false, error: 'Import failed' });
  }
});

// =====================
// Condense Descriptions (Admin only)
// =====================

router.post('/condense-descriptions', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      batchSize: z.number().min(1).max(50).optional(),
      offset: z.number().min(0).optional(),
    });
    
    const { batchSize = 10, offset = 0 } = schema.parse(req.body);
    
    const aiConfig = getAIConfig();
    if (!aiConfig.hasAI) {
      res.status(503).json({ success: false, error: 'AI service not configured' });
      return;
    }
    
    // Get games with long descriptions
    const gamesResult = await pool.query(
      `SELECT id, title, description FROM games 
       WHERE description IS NOT NULL 
       AND LENGTH(description) > 800
       ORDER BY title
       LIMIT $1 OFFSET $2`,
      [batchSize, offset]
    );
    
    if (gamesResult.rows.length === 0) {
      res.json({ success: true, message: 'No more games to process', updated: 0 });
      return;
    }
    
    let updated = 0;
    const errors: string[] = [];
    
    for (const game of gamesResult.rows) {
      try {
        console.log(`Processing: ${game.title}`);
        
        const aiResult = await aiComplete([
          {
            role: 'system',
            content: `You are a board game description editor. Condense the given description into a CONCISE format:

1. Opening: 2-3 sentences about the game theme
2. "## Quick Gameplay Overview" header
3. Bullet points:
   - **Goal:** One sentence
   - **Each Round:** 3-4 bullet points with bold labels
   - **Winner:** One sentence

TOTAL: 150-200 words MAX. Keep it scannable.`,
          },
          {
            role: 'user',
            content: `Condense this game description for "${game.title}":\n\n${game.description}`,
          },
        ], 500);
        
        if (!aiResult.success || !aiResult.content) {
          errors.push(`Failed to process ${game.title}`);
          continue;
        }
        
        await pool.query(
          'UPDATE games SET description = $1, updated_at = NOW() WHERE id = $2',
          [aiResult.content.trim(), game.id]
        );
        
        updated++;
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        errors.push(`Error processing ${game.title}`);
      }
    }
    
    res.json({
      success: true,
      updated,
      processed: gamesResult.rows.length,
      nextOffset: offset + batchSize,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Condense descriptions error:', error);
    res.status(500).json({ success: false, error: 'Processing failed' });
  }
});

export default router;
