import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';

const router = Router();

// Get all games (public)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { search, type, minPlayers, maxPlayers, forSale, comingSoon, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT g.*, p.name as publisher_name
      FROM games g
      LEFT JOIN publishers p ON g.publisher_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND g.title ILIKE $${paramCount}`;
      params.push(`%${search}%`);
    }
    
    if (type) {
      paramCount++;
      query += ` AND g.game_type = $${paramCount}`;
      params.push(type);
    }
    
    if (minPlayers) {
      paramCount++;
      query += ` AND g.max_players >= $${paramCount}`;
      params.push(parseInt(minPlayers as string));
    }
    
    if (maxPlayers) {
      paramCount++;
      query += ` AND g.min_players <= $${paramCount}`;
      params.push(parseInt(maxPlayers as string));
    }
    
    if (forSale === 'true') {
      query += ' AND g.is_for_sale = true';
    }
    
    if (comingSoon === 'true') {
      query += ' AND g.is_coming_soon = true';
    }
    
    query += ' ORDER BY g.title ASC';
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset as string));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get single game by ID or slug
router.get('/:idOrSlug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    
    // Check if it's a UUID or slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    
    const query = `
      SELECT g.*, p.name as publisher_name
      FROM games g
      LEFT JOIN publishers p ON g.publisher_id = p.id
      WHERE ${isUuid ? 'g.id' : 'g.slug'} = $1
    `;
    
    const result = await pool.query(query, [idOrSlug]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    
    // Get mechanics
    const mechanicsResult = await pool.query(
      `SELECT m.id, m.name FROM mechanics m
       JOIN game_mechanics gm ON m.id = gm.mechanic_id
       WHERE gm.game_id = $1`,
      [result.rows[0].id]
    );
    
    res.json({
      ...result.rows[0],
      mechanics: mechanicsResult.rows,
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Create game (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const gameSchema = z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      image_url: z.string().url().optional(),
      min_players: z.number().int().min(1).optional(),
      max_players: z.number().int().min(1).optional(),
      play_time: z.string().optional(),
      difficulty: z.string().optional(),
      game_type: z.string().optional(),
      publisher_id: z.string().uuid().optional(),
      is_for_sale: z.boolean().optional(),
      sale_price: z.number().optional(),
      is_coming_soon: z.boolean().optional(),
      is_expansion: z.boolean().optional(),
      parent_game_id: z.string().uuid().optional(),
      bgg_id: z.string().optional(),
    });
    
    const data = gameSchema.parse(req.body);
    
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(data);
    
    const result = await pool.query(
      `INSERT INTO games (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Update game (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id') {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    }
    
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }
    
    paramCount++;
    values.push(id);
    
    const result = await pool.query(
      `UPDATE games SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Delete game (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM games WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    
    res.json({ message: 'Game deleted' });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

export default router;
