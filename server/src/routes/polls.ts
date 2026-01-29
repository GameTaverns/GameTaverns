import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { notifyPollCreated, notifyPollClosed } from '../services/discord.js';

const router = Router();

// =====================
// Get polls for a library
// =====================

router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { library_id, status } = req.query;
    
    if (!library_id) {
      res.status(400).json({ error: 'library_id is required' });
      return;
    }
    
    let query = `
      SELECT gp.*, 
        (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = gp.id) as total_votes,
        (SELECT COUNT(*) FROM game_night_rsvps gnr WHERE gnr.poll_id = gp.id) as rsvp_count
      FROM game_polls gp
      WHERE gp.library_id = $1
    `;
    const params: any[] = [library_id];
    
    if (status) {
      query += ` AND gp.status = $2`;
      params.push(status);
    }
    
    query += ' ORDER BY gp.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

// =====================
// Get poll by ID or share token
// =====================

router.get('/:idOrToken', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { idOrToken } = req.params;
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrToken);
    
    const pollResult = await pool.query(
      `SELECT gp.*, l.name as library_name, l.slug as library_slug
       FROM game_polls gp
       JOIN libraries l ON l.id = gp.library_id
       WHERE ${isUuid ? 'gp.id' : 'gp.share_token'} = $1`,
      [idOrToken]
    );
    
    if (pollResult.rows.length === 0) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }
    
    const poll = pollResult.rows[0];
    
    // Get options with vote counts
    const optionsResult = await pool.query(
      `SELECT po.id, po.game_id, po.display_order, g.title, g.image_url,
        (SELECT COUNT(*) FROM poll_votes pv WHERE pv.option_id = po.id) as vote_count
       FROM poll_options po
       JOIN games g ON g.id = po.game_id
       WHERE po.poll_id = $1
       ORDER BY po.display_order`,
      [poll.id]
    );
    
    // Get RSVPs if game night
    let rsvps = [];
    if (poll.poll_type === 'game_night') {
      const rsvpResult = await pool.query(
        'SELECT * FROM game_night_rsvps WHERE poll_id = $1 ORDER BY created_at',
        [poll.id]
      );
      rsvps = rsvpResult.rows;
    }
    
    res.json({
      ...poll,
      options: optionsResult.rows,
      rsvps,
    });
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

// =====================
// Create poll
// =====================

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      library_id: z.string().uuid(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      poll_type: z.enum(['quick', 'game_night']).default('quick'),
      max_votes_per_user: z.number().int().min(1).max(10).optional(),
      show_results_before_close: z.boolean().optional(),
      voting_ends_at: z.string().datetime().optional(),
      event_date: z.string().datetime().optional(),
      event_location: z.string().optional(),
      game_ids: z.array(z.string().uuid()).min(1).max(20),
    });
    
    const data = schema.parse(req.body);
    
    // Verify user owns library
    const libraryResult = await pool.query(
      'SELECT l.*, ls.discord_webhook_url FROM libraries l LEFT JOIN library_settings ls ON ls.library_id = l.id WHERE l.id = $1',
      [data.library_id]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    const library = libraryResult.rows[0];
    
    if (library.owner_id !== req.user!.sub) {
      // Check if admin
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    // Create poll
    const pollResult = await pool.query(
      `INSERT INTO game_polls (library_id, title, description, poll_type, max_votes_per_user, 
        show_results_before_close, voting_ends_at, event_date, event_location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.library_id,
        data.title,
        data.description,
        data.poll_type,
        data.max_votes_per_user || 1,
        data.show_results_before_close || false,
        data.voting_ends_at,
        data.event_date,
        data.event_location,
        req.user!.sub,
      ]
    );
    
    const poll = pollResult.rows[0];
    
    // Create options
    for (let i = 0; i < data.game_ids.length; i++) {
      await pool.query(
        'INSERT INTO poll_options (poll_id, game_id, display_order) VALUES ($1, $2, $3)',
        [poll.id, data.game_ids[i], i]
      );
    }
    
    // Send Discord notification
    if (library.discord_webhook_url) {
      const pollUrl = `${library.slug ? `https://${library.slug}.gametaverns.com` : ''}/poll/${poll.share_token}`;
      await notifyPollCreated(library.discord_webhook_url, library.name, data.title, pollUrl, data.event_date);
    }
    
    res.status(201).json(poll);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// =====================
// Vote on poll
// =====================

router.post('/:pollId/vote', async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const schema = z.object({
      option_id: z.string().uuid(),
      voter_identifier: z.string(),
      voter_name: z.string().optional(),
    });
    
    const { option_id, voter_identifier, voter_name } = schema.parse(req.body);
    
    // Check poll is open
    const pollResult = await pool.query(
      `SELECT gp.*, 
        (SELECT COUNT(*) FROM poll_votes WHERE poll_id = gp.id AND voter_identifier = $2) as user_votes
       FROM game_polls gp WHERE gp.id = $1`,
      [pollId, voter_identifier]
    );
    
    if (pollResult.rows.length === 0) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }
    
    const poll = pollResult.rows[0];
    
    if (poll.status !== 'open') {
      res.status(400).json({ error: 'Poll is closed' });
      return;
    }
    
    if (poll.voting_ends_at && new Date(poll.voting_ends_at) < new Date()) {
      res.status(400).json({ error: 'Voting has ended' });
      return;
    }
    
    if (poll.user_votes >= poll.max_votes_per_user) {
      res.status(400).json({ error: `Maximum ${poll.max_votes_per_user} vote(s) allowed` });
      return;
    }
    
    // Verify option belongs to poll
    const optionResult = await pool.query(
      'SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2',
      [option_id, pollId]
    );
    
    if (optionResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid option' });
      return;
    }
    
    // Insert vote
    await pool.query(
      `INSERT INTO poll_votes (poll_id, option_id, voter_identifier, voter_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (poll_id, option_id, voter_identifier) DO NOTHING`,
      [pollId, option_id, voter_identifier, voter_name]
    );
    
    res.json({ message: 'Vote recorded' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// =====================
// Remove vote
// =====================

router.delete('/:pollId/vote', async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const { option_id, voter_identifier } = req.body;
    
    await pool.query(
      'DELETE FROM poll_votes WHERE poll_id = $1 AND option_id = $2 AND voter_identifier = $3',
      [pollId, option_id, voter_identifier]
    );
    
    res.json({ message: 'Vote removed' });
  } catch (error) {
    console.error('Remove vote error:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// =====================
// RSVP to game night
// =====================

router.post('/:pollId/rsvp', async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const schema = z.object({
      guest_identifier: z.string(),
      guest_name: z.string().optional(),
      status: z.enum(['going', 'maybe', 'not_going']).default('going'),
    });
    
    const data = schema.parse(req.body);
    
    await pool.query(
      `INSERT INTO game_night_rsvps (poll_id, guest_identifier, guest_name, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (poll_id, guest_identifier) 
       DO UPDATE SET guest_name = $3, status = $4, updated_at = NOW()`,
      [pollId, data.guest_identifier, data.guest_name, data.status]
    );
    
    res.json({ message: 'RSVP recorded' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('RSVP error:', error);
    res.status(500).json({ error: 'Failed to record RSVP' });
  }
});

// =====================
// Close poll
// =====================

router.post('/:pollId/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    
    // Get poll with library
    const pollResult = await pool.query(
      `SELECT gp.*, l.owner_id, l.name as library_name, ls.discord_webhook_url
       FROM game_polls gp
       JOIN libraries l ON l.id = gp.library_id
       LEFT JOIN library_settings ls ON ls.library_id = l.id
       WHERE gp.id = $1`,
      [pollId]
    );
    
    if (pollResult.rows.length === 0) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }
    
    const poll = pollResult.rows[0];
    
    // Verify ownership
    if (poll.owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    // Update status
    await pool.query('UPDATE game_polls SET status = $1 WHERE id = $2', ['closed', pollId]);
    
    // Get winner for notification
    const winnerResult = await pool.query(
      `SELECT g.title, COUNT(pv.id) as votes
       FROM poll_options po
       JOIN games g ON g.id = po.game_id
       LEFT JOIN poll_votes pv ON pv.option_id = po.id
       WHERE po.poll_id = $1
       GROUP BY po.id, g.title
       ORDER BY votes DESC
       LIMIT 1`,
      [pollId]
    );
    
    if (poll.discord_webhook_url && winnerResult.rows.length > 0) {
      const winner = winnerResult.rows[0];
      await notifyPollClosed(
        poll.discord_webhook_url,
        poll.library_name,
        poll.title,
        winner.title,
        parseInt(winner.votes)
      );
    }
    
    res.json({ message: 'Poll closed' });
  } catch (error) {
    console.error('Close poll error:', error);
    res.status(500).json({ error: 'Failed to close poll' });
  }
});

// =====================
// Delete poll
// =====================

router.delete('/:pollId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    
    // Verify ownership
    const pollResult = await pool.query(
      'SELECT gp.*, l.owner_id FROM game_polls gp JOIN libraries l ON l.id = gp.library_id WHERE gp.id = $1',
      [pollId]
    );
    
    if (pollResult.rows.length === 0) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }
    
    if (pollResult.rows[0].owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    await pool.query('DELETE FROM game_polls WHERE id = $1', [pollId]);
    
    res.json({ message: 'Poll deleted' });
  } catch (error) {
    console.error('Delete poll error:', error);
    res.status(500).json({ error: 'Failed to delete poll' });
  }
});

export default router;
