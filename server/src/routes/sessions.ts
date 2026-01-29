import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = Router();

// =====================
// Get sessions for a game
// =====================

router.get('/game/:gameId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const sessionsResult = await pool.query(
      `SELECT gs.*, 
        (SELECT json_agg(gsp ORDER BY gsp.is_winner DESC, gsp.score DESC NULLS LAST)
         FROM game_session_players gsp WHERE gsp.session_id = gs.id) as players
       FROM game_sessions gs
       WHERE gs.game_id = $1
       ORDER BY gs.played_at DESC
       LIMIT $2 OFFSET $3`,
      [gameId, parseInt(limit as string), parseInt(offset as string)]
    );
    
    res.json(sessionsResult.rows);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// =====================
// Get session by ID
// =====================

router.get('/:sessionId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const sessionResult = await pool.query(
      'SELECT * FROM game_sessions WHERE id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    const playersResult = await pool.query(
      'SELECT * FROM game_session_players WHERE session_id = $1 ORDER BY is_winner DESC, score DESC NULLS LAST',
      [sessionId]
    );
    
    res.json({
      ...sessionResult.rows[0],
      players: playersResult.rows,
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// =====================
// Create session (play log)
// =====================

router.post('/', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      game_id: z.string().uuid(),
      played_at: z.string().datetime().optional(),
      duration_minutes: z.number().int().min(1).optional(),
      notes: z.string().max(1000).optional(),
      players: z.array(z.object({
        player_name: z.string().min(1).max(100),
        score: z.number().int().optional(),
        is_winner: z.boolean().optional(),
        is_first_play: z.boolean().optional(),
      })).min(1).max(20),
    });
    
    const data = schema.parse(req.body);
    
    // Verify game exists
    const gameResult = await pool.query('SELECT id FROM games WHERE id = $1', [data.game_id]);
    if (gameResult.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    
    // Create session
    const sessionResult = await pool.query(
      `INSERT INTO game_sessions (game_id, played_at, duration_minutes, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.game_id, data.played_at || new Date(), data.duration_minutes, data.notes]
    );
    
    const session = sessionResult.rows[0];
    
    // Add players
    for (const player of data.players) {
      await pool.query(
        `INSERT INTO game_session_players (session_id, player_name, score, is_winner, is_first_play)
         VALUES ($1, $2, $3, $4, $5)`,
        [session.id, player.player_name, player.score, player.is_winner || false, player.is_first_play || false]
      );
    }
    
    // Get players
    const playersResult = await pool.query(
      'SELECT * FROM game_session_players WHERE session_id = $1',
      [session.id]
    );
    
    res.status(201).json({
      ...session,
      players: playersResult.rows,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// =====================
// Update session
// =====================

router.put('/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { played_at, duration_minutes, notes } = req.body;
    
    // Verify session exists and user has access
    const sessionResult = await pool.query(
      `SELECT gs.*, l.owner_id
       FROM game_sessions gs
       JOIN games g ON g.id = gs.game_id
       JOIN libraries l ON l.id = g.library_id
       WHERE gs.id = $1`,
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    const session = sessionResult.rows[0];
    
    if (session.owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    const updateResult = await pool.query(
      `UPDATE game_sessions 
       SET played_at = COALESCE($1, played_at), 
           duration_minutes = COALESCE($2, duration_minutes),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [played_at, duration_minutes, notes, sessionId]
    );
    
    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// =====================
// Delete session
// =====================

router.delete('/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Verify ownership
    const sessionResult = await pool.query(
      `SELECT gs.*, l.owner_id
       FROM game_sessions gs
       JOIN games g ON g.id = gs.game_id
       JOIN libraries l ON l.id = g.library_id
       WHERE gs.id = $1`,
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    if (sessionResult.rows[0].owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    await pool.query('DELETE FROM game_sessions WHERE id = $1', [sessionId]);
    
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// =====================
// Get library session stats
// =====================

router.get('/stats/:libraryId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    
    const statsResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT gs.id) as total_sessions,
        COUNT(DISTINCT gsp.id) as total_player_entries,
        SUM(gs.duration_minutes) as total_play_time,
        COUNT(DISTINCT gs.game_id) as unique_games_played
       FROM game_sessions gs
       JOIN games g ON g.id = gs.game_id
       LEFT JOIN game_session_players gsp ON gsp.session_id = gs.id
       WHERE g.library_id = $1`,
      [libraryId]
    );
    
    const topGamesResult = await pool.query(
      `SELECT g.id, g.title, g.image_url, COUNT(gs.id) as play_count
       FROM games g
       JOIN game_sessions gs ON gs.game_id = g.id
       WHERE g.library_id = $1
       GROUP BY g.id
       ORDER BY play_count DESC
       LIMIT 10`,
      [libraryId]
    );
    
    res.json({
      ...statsResult.rows[0],
      top_games: topGamesResult.rows,
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
