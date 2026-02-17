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
    let result = await pool.query(
      `SELECT up.*, u.email,
              a.id as achievement_id, a.name as achievement_name, 
              a.icon as achievement_icon, a.tier as achievement_tier
       FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       LEFT JOIN achievements a ON a.id = up.featured_achievement_id
       WHERE up.user_id = $1`,
      [req.user!.sub]
    );
    
    // Auto-create profile if it doesn't exist
    if (result.rows.length === 0) {
      // Get user email to derive default display_name
      const userResult = await pool.query(
        'SELECT email FROM users WHERE id = $1',
        [req.user!.sub]
      );
      
      if (userResult.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      const email = userResult.rows[0].email;
      const defaultDisplayName = email.split('@')[0];
      
      // Create profile
      await pool.query(
        'INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [req.user!.sub, defaultDisplayName]
      );
      
      // Re-fetch with achievement join
      result = await pool.query(
        `SELECT up.*, u.email,
                a.id as achievement_id, a.name as achievement_name, 
                a.icon as achievement_icon, a.tier as achievement_tier
         FROM user_profiles up
         JOIN users u ON u.id = up.user_id
         LEFT JOIN achievements a ON a.id = up.featured_achievement_id
         WHERE up.user_id = $1`,
        [req.user!.sub]
      );
      
      if (result.rows.length === 0) {
        res.status(500).json({ error: 'Failed to create profile' });
        return;
      }
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
    
    // Build featured_achievement object if exists
    const row = result.rows[0];
    const featured_achievement = row.achievement_id ? {
      id: row.achievement_id,
      name: row.achievement_name,
      icon: row.achievement_icon,
      tier: row.achievement_tier,
    } : null;
    
    // Remove the flat achievement fields from the response
    const { achievement_id, achievement_name, achievement_icon, achievement_tier, ...profileData } = row;
    
    res.json({
      ...profileData,
      featured_achievement,
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
      featured_achievement_id: z.string().uuid().optional().nullable(),
      banner_url: z.string().url().optional().nullable(),
      banner_gradient: z.string().max(200).optional().nullable(),
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
    
    // Validate that featured_achievement_id is an achievement the user has earned
    if (data.featured_achievement_id) {
      const hasAchievement = await pool.query(
        'SELECT 1 FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
        [req.user!.sub, data.featured_achievement_id]
      );
      
      if (hasAchievement.rows.length === 0) {
        res.status(400).json({ error: 'You can only feature achievements you have earned' });
        return;
      }
    }
    
    // Build dynamic update - handle null explicitly for fields that can be cleared
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.display_name !== undefined) {
      updateFields.push(`display_name = $${paramIndex++}`);
      values.push(data.display_name);
    }
    if (data.username !== undefined) {
      updateFields.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.bio !== undefined) {
      updateFields.push(`bio = $${paramIndex++}`);
      values.push(data.bio);
    }
    if (data.avatar_url !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatar_url);
    }
    if (data.featured_achievement_id !== undefined) {
      updateFields.push(`featured_achievement_id = $${paramIndex++}`);
      values.push(data.featured_achievement_id);
    }
    if (data.banner_url !== undefined) {
      updateFields.push(`banner_url = $${paramIndex++}`);
      values.push(data.banner_url);
    }
    if (data.banner_gradient !== undefined) {
      updateFields.push(`banner_gradient = $${paramIndex++}`);
      values.push(data.banner_gradient);
    }

    if (updateFields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updateFields.push('updated_at = NOW()');
    values.push(req.user!.sub);

    const result = await pool.query(
      `UPDATE user_profiles 
       SET ${updateFields.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
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
