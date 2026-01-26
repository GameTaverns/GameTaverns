import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';

const router = Router();

// Get wishlist summary (public)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT game_id, COUNT(*) as vote_count,
             COUNT(CASE WHEN guest_name IS NOT NULL THEN 1 END) as named_votes
      FROM game_wishlist
      GROUP BY game_id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get wishlist summary error:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist summary' });
  }
});

// Get user's wishlist
router.get('/', async (req: Request, res: Response) => {
  try {
    const { guestIdentifier } = req.query;
    
    if (!guestIdentifier || typeof guestIdentifier !== 'string') {
      res.status(400).json({ error: 'Guest identifier required' });
      return;
    }
    
    const result = await pool.query(
      'SELECT game_id, guest_name FROM game_wishlist WHERE guest_identifier = $1',
      [guestIdentifier]
    );
    
    res.json({ votes: result.rows });
  } catch (error) {
    console.error('Get user wishlist error:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// Add to wishlist
router.post('/', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      gameId: z.string().uuid(),
      guestIdentifier: z.string().min(1).max(100),
      guestName: z.string().max(100).optional(),
    });
    
    const { gameId, guestIdentifier, guestName } = schema.parse(req.body);
    
    // Check if already in wishlist
    const existing = await pool.query(
      'SELECT id FROM game_wishlist WHERE game_id = $1 AND guest_identifier = $2',
      [gameId, guestIdentifier]
    );
    
    if (existing.rows.length > 0) {
      // Update guest name if provided
      if (guestName) {
        await pool.query(
          'UPDATE game_wishlist SET guest_name = $1 WHERE game_id = $2 AND guest_identifier = $3',
          [guestName, gameId, guestIdentifier]
        );
      }
      res.json({ success: true, message: 'Already in wishlist' });
      return;
    }
    
    await pool.query(
      'INSERT INTO game_wishlist (game_id, guest_identifier, guest_name) VALUES ($1, $2, $3)',
      [gameId, guestIdentifier, guestName || null]
    );
    
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Add to wishlist error:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// Remove from wishlist
router.delete('/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { guestIdentifier } = req.query;
    
    if (!guestIdentifier || typeof guestIdentifier !== 'string') {
      res.status(400).json({ error: 'Guest identifier required' });
      return;
    }
    
    await pool.query(
      'DELETE FROM game_wishlist WHERE game_id = $1 AND guest_identifier = $2',
      [gameId, guestIdentifier]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

export default router;
