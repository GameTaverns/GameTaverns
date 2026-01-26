import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { pool } from '../services/db.js';
import { ratingLimiter } from '../middleware/rateLimit.js';

const router = Router();

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] as string || req.socket.remoteAddress || 'unknown';
}

function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 32);
}

// Get rating summary (public)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT game_id, COUNT(*) as rating_count, ROUND(AVG(rating)::numeric, 1) as average_rating
      FROM game_ratings
      GROUP BY game_id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get ratings summary error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Get user's ratings
router.get('/', async (req: Request, res: Response) => {
  try {
    const { guestIdentifier } = req.query;
    
    if (!guestIdentifier || typeof guestIdentifier !== 'string') {
      res.status(400).json({ error: 'Guest identifier required' });
      return;
    }
    
    const result = await pool.query(
      'SELECT game_id, rating FROM game_ratings WHERE guest_identifier = $1',
      [guestIdentifier]
    );
    
    res.json({ ratings: result.rows });
  } catch (error) {
    console.error('Get user ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Rate a game
router.post('/', ratingLimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      gameId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      guestIdentifier: z.string().min(1).max(100),
      deviceFingerprint: z.string().optional(),
    });
    
    const { gameId, rating, guestIdentifier, deviceFingerprint } = schema.parse(req.body);
    
    const clientIP = getClientIP(req);
    const hashedIP = hashIP(clientIP);
    
    // Check for duplicate (same IP + fingerprint combination)
    if (deviceFingerprint) {
      const duplicate = await pool.query(
        `SELECT id FROM game_ratings 
         WHERE game_id = $1 AND ip_address = $2 AND device_fingerprint = $3`,
        [gameId, hashedIP, deviceFingerprint]
      );
      
      if (duplicate.rows.length > 0) {
        res.status(409).json({ error: 'You have already rated this game' });
        return;
      }
    }
    
    // Upsert rating
    const result = await pool.query(
      `INSERT INTO game_ratings (game_id, rating, guest_identifier, ip_address, device_fingerprint)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (game_id, guest_identifier) 
       DO UPDATE SET rating = $2, updated_at = NOW()
       RETURNING id, rating`,
      [gameId, rating, guestIdentifier, hashedIP, deviceFingerprint]
    );
    
    res.json({ success: true, rating: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Rate game error:', error);
    res.status(500).json({ error: 'Failed to rate game' });
  }
});

export default router;
