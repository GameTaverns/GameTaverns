import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = Router();

// =====================
// Get events for a library
// =====================

router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { library_id, upcoming_only } = req.query;
    
    if (!library_id) {
      res.status(400).json({ error: 'library_id is required' });
      return;
    }
    
    let query = `
      SELECT * FROM library_events
      WHERE library_id = $1
    `;
    const params: any[] = [library_id];
    
    if (upcoming_only === 'true') {
      query += ` AND event_date >= date_trunc('day', NOW())`;
    }
    
    query += ' ORDER BY event_date ASC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// =====================
// Get calendar events (combined view)
// =====================

router.get('/calendar', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { library_id, start_date, end_date } = req.query;
    
    if (!library_id) {
      res.status(400).json({ error: 'library_id is required' });
      return;
    }
    
    const startFilter = start_date ? new Date(start_date as string) : new Date();
    startFilter.setHours(0, 0, 0, 0);
    
    const endFilter = end_date ? new Date(end_date as string) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    
    const result = await pool.query(
      `SELECT * FROM library_calendar_events
       WHERE library_id = $1 AND event_date >= $2 AND event_date <= $3
       ORDER BY event_date ASC`,
      [library_id, startFilter, endFilter]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// =====================
// Get event by ID
// =====================

router.get('/:eventId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM library_events WHERE id = $1',
      [eventId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// =====================
// Create event
// =====================

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      library_id: z.string().uuid(),
      title: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      event_date: z.string().datetime(),
      event_location: z.string().max(255).optional(),
    });
    
    const data = schema.parse(req.body);
    
    // Verify user owns library
    const libraryResult = await pool.query(
      'SELECT owner_id FROM libraries WHERE id = $1',
      [data.library_id]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    if (libraryResult.rows[0].owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    const result = await pool.query(
      `INSERT INTO library_events (library_id, title, description, event_date, event_location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.library_id, data.title, data.description, data.event_date, data.event_location, req.user!.sub]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// =====================
// Update event
// =====================

router.put('/:eventId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { title, description, event_date, event_location } = req.body;
    
    // Verify ownership
    const eventResult = await pool.query(
      `SELECT le.*, l.owner_id
       FROM library_events le
       JOIN libraries l ON l.id = le.library_id
       WHERE le.id = $1`,
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    
    if (eventResult.rows[0].owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    const result = await pool.query(
      `UPDATE library_events 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           event_date = COALESCE($3, event_date),
           event_location = COALESCE($4, event_location),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [title, description, event_date, event_location, eventId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// =====================
// Delete event
// =====================

router.delete('/:eventId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    
    // Verify ownership
    const eventResult = await pool.query(
      `SELECT le.*, l.owner_id
       FROM library_events le
       JOIN libraries l ON l.id = le.library_id
       WHERE le.id = $1`,
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    
    if (eventResult.rows[0].owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    await pool.query('DELETE FROM library_events WHERE id = $1', [eventId]);
    
    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
