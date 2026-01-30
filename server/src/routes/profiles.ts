import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = Router();

// =====================
// Get current user's profile (MUST be before /:userId to avoid route capture)
// =====================

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT up.*, u.email
       FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       WHERE up.user_id = $1`,
      [req.user!.sub]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    
    // Get roles
    const rolesResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [req.user!.sub]
    );
    
    // Get libraries
    const librariesResult = await pool.query(
      'SELECT id, slug, name, is_active, is_premium FROM libraries WHERE owner_id = $1',
      [req.user!.sub]
    );
    
    res.json({
      ...result.rows[0],
      roles: rolesResult.rows.map(r => r.role),
      libraries: librariesResult.rows,
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// =====================
// Update profile
// =====================

router.put('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      display_name: z.string().max(100).optional().nullable(),
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().nullable(),
      bio: z.string().max(500).optional().nullable(),
      avatar_url: z.string().url().optional().nullable(),
    });
    
    const data = schema.parse(req.body);
    
    // Check username uniqueness if changing
    if (data.username) {
      const existing = await pool.query(
        'SELECT id FROM user_profiles WHERE LOWER(username) = LOWER($1) AND user_id != $2',
        [data.username, req.user!.sub]
      );
      
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }
    }
    
    const result = await pool.query(
      `UPDATE user_profiles 
       SET display_name = COALESCE($1, display_name),
           username = COALESCE($2, username),
           bio = COALESCE($3, bio),
           avatar_url = COALESCE($4, avatar_url),
           updated_at = NOW()
       WHERE user_id = $5
       RETURNING *`,
      [data.display_name, data.username, data.bio, data.avatar_url, req.user!.sub]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// =====================
// Link Discord account
// =====================

router.post('/me/discord', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { discord_user_id } = z.object({ discord_user_id: z.string() }).parse(req.body);
    
    // Check if Discord ID already linked to another account
    const existing = await pool.query(
      'SELECT id FROM user_profiles WHERE discord_user_id = $1 AND user_id != $2',
      [discord_user_id, req.user!.sub]
    );
    
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Discord account already linked to another user' });
      return;
    }
    
    await pool.query(
      'UPDATE user_profiles SET discord_user_id = $1, updated_at = NOW() WHERE user_id = $2',
      [discord_user_id, req.user!.sub]
    );
    
    res.json({ message: 'Discord account linked' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Link Discord error:', error);
    res.status(500).json({ error: 'Failed to link Discord account' });
  }
});

// =====================
// Unlink Discord account
// =====================

router.delete('/me/discord', authMiddleware, async (req: Request, res: Response) => {
  try {
    await pool.query(
      'UPDATE user_profiles SET discord_user_id = NULL, updated_at = NOW() WHERE user_id = $1',
      [req.user!.sub]
    );
    
    res.json({ message: 'Discord account unlinked' });
  } catch (error) {
    console.error('Unlink Discord error:', error);
    res.status(500).json({ error: 'Failed to unlink Discord account' });
  }
});

// =====================
// Check username availability
// =====================

router.get('/check/username/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      res.json({ available: false, reason: 'Invalid format' });
      return;
    }
    
    const result = await pool.query(
      'SELECT id FROM user_profiles WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    
    res.json({ available: result.rows.length === 0 });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// =====================
// Get user profile by ID (MUST be after specific routes like /me, /check)
// =====================

router.get('/:userId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT up.id, up.display_name, up.username, up.avatar_url, up.bio, up.created_at
       FROM user_profiles up
       WHERE up.user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
