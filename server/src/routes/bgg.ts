import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { bggLimiter } from '../middleware/rateLimit.js';
import { pool } from '../services/db.js';

const router = Router();

// BGG API utilities
async function fetchBggSearch(query: string): Promise<any[]> {
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('BGG search failed');
  
  const text = await response.text();
  // Simple XML parsing for search results
  const items: any[] = [];
  const regex = /<item type="boardgame" id="(\d+)">\s*<name type="primary" value="([^"]+)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    items.push({ bggId: match[1], name: match[2] });
  }
  return items.slice(0, 10);
}

async function fetchBggDetails(bggId: string): Promise<any> {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('BGG fetch failed');
  
  const text = await response.text();
  
  // Extract data from XML
  const getValue = (tag: string) => {
    const match = text.match(new RegExp(`<${tag}[^>]*value="([^"]*)"`, 'i'));
    return match ? match[1] : null;
  };
  
  const getContent = (tag: string) => {
    const match = text.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
    return match ? match[1] : null;
  };
  
  const imageMatch = text.match(/<image>([^<]+)<\/image>/);
  const descMatch = text.match(/<description>([^]*?)<\/description>/);
  
  return {
    bggId,
    title: getValue('name') || 'Unknown',
    description: descMatch ? descMatch[1].replace(/&#10;/g, '\n').substring(0, 5000) : null,
    imageUrl: imageMatch ? imageMatch[1] : null,
    minPlayers: parseInt(getValue('minplayers') || '1'),
    maxPlayers: parseInt(getValue('maxplayers') || '4'),
    playingTime: parseInt(getValue('playingtime') || '60'),
    yearPublished: getValue('yearpublished'),
    bggUrl: `https://boardgamegeek.com/boardgame/${bggId}`,
  };
}

// Search BGG (public, rate limited)
router.post('/lookup', bggLimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      query: z.string().min(1).max(100),
    });
    
    const { query } = schema.parse(req.body);
    const results = await fetchBggSearch(query);
    
    res.json({ success: true, results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid query' });
      return;
    }
    console.error('BGG lookup error:', error);
    res.status(500).json({ success: false, error: 'BGG search failed' });
  }
});

// Import from BGG (admin only)
router.post('/import', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      bggId: z.string().min(1),
    });
    
    const { bggId } = schema.parse(req.body);
    
    // Check if already imported
    const existing = await pool.query('SELECT id FROM games WHERE bgg_id = $1', [bggId]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, error: 'Game already imported', gameId: existing.rows[0].id });
      return;
    }
    
    const details = await fetchBggDetails(bggId);
    
    // Map play time to enum
    let playTime = '45-60 Minutes';
    if (details.playingTime <= 15) playTime = '0-15 Minutes';
    else if (details.playingTime <= 30) playTime = '15-30 Minutes';
    else if (details.playingTime <= 45) playTime = '30-45 Minutes';
    else if (details.playingTime <= 60) playTime = '45-60 Minutes';
    else if (details.playingTime <= 120) playTime = '60+ Minutes';
    else if (details.playingTime <= 180) playTime = '2+ Hours';
    else playTime = '3+ Hours';
    
    const result = await pool.query(
      `INSERT INTO games (title, description, image_url, min_players, max_players, play_time, bgg_id, bgg_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [details.title, details.description, details.imageUrl, details.minPlayers, details.maxPlayers, playTime, bggId, details.bggUrl]
    );
    
    res.status(201).json({ success: true, game: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid BGG ID' });
      return;
    }
    console.error('BGG import error:', error);
    res.status(500).json({ success: false, error: 'Import failed' });
  }
});

// Bulk import (admin only)
router.post('/bulk-import', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      bggIds: z.array(z.string()).min(1).max(50),
    });
    
    const { bggIds } = schema.parse(req.body);
    
    const results = { imported: 0, skipped: 0, errors: [] as string[] };
    
    for (const bggId of bggIds) {
      try {
        // Check if exists
        const existing = await pool.query('SELECT id FROM games WHERE bgg_id = $1', [bggId]);
        if (existing.rows.length > 0) {
          results.skipped++;
          continue;
        }
        
        const details = await fetchBggDetails(bggId);
        
        let playTime = '45-60 Minutes';
        if (details.playingTime <= 15) playTime = '0-15 Minutes';
        else if (details.playingTime <= 30) playTime = '15-30 Minutes';
        else if (details.playingTime <= 45) playTime = '30-45 Minutes';
        else if (details.playingTime <= 60) playTime = '45-60 Minutes';
        else if (details.playingTime <= 120) playTime = '60+ Minutes';
        else if (details.playingTime <= 180) playTime = '2+ Hours';
        else playTime = '3+ Hours';
        
        await pool.query(
          `INSERT INTO games (title, description, image_url, min_players, max_players, play_time, bgg_id, bgg_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [details.title, details.description, details.imageUrl, details.minPlayers, details.maxPlayers, playTime, bggId, details.bggUrl]
        );
        
        results.imported++;
        
        // Rate limit ourselves
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        results.errors.push(`${bggId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    
    res.json({ success: true, ...results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }
    console.error('Bulk import error:', error);
    res.status(500).json({ success: false, error: 'Bulk import failed' });
  }
});

export default router;
