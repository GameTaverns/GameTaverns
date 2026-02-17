import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { hashPassword } from '../utils/password.js';

const router = Router();

// All routes require admin
router.use(authMiddleware, adminMiddleware);

// List users with profile data
router.get('/users', async (req: Request, res: Response) => {
  try {
    // Use user_profiles as the base and LEFT JOIN users to catch all accounts
    // This ensures users who have a profile but a missing users row (or vice versa) still appear
    const result = await pool.query(`
      SELECT COALESCE(u.id, up.user_id) as id,
             u.email,
             COALESCE(u.created_at, up.created_at) as created_at,
             u.last_sign_in_at,
             u.email_confirmed_at,
             up.display_name, up.username,
             ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL) as roles
      FROM user_profiles up
      FULL OUTER JOIN auth.users u ON u.id = up.user_id
      LEFT JOIN user_roles ur ON COALESCE(u.id, up.user_id) = ur.user_id
      WHERE COALESCE(u.id, up.user_id) IS NOT NULL
      GROUP BY u.id, up.user_id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, up.created_at, up.display_name, up.username
      ORDER BY COALESCE(u.created_at, up.created_at) DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user
router.post('/users', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email().max(255),
      password: z.string().min(8).max(128),
      role: z.enum(['admin', 'moderator', 'user']).optional(),
    });
    
    const { email, password, role } = schema.parse(req.body);
    
    // Check if exists
    const existing = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    
    const passwordHash = await hashPassword(password);
    
    const userResult = await pool.query(
      'INSERT INTO auth.users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email.toLowerCase(), passwordHash]
    );
    
    const user = userResult.rows[0];
    
    // Add role if specified
    if (role) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [user.id, role]
      );
    }
    
    res.status(201).json({ ...user, role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user role
router.put('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      role: z.enum(['admin', 'moderator', 'user']),
    });
    
    const { role } = schema.parse(req.body);
    
    // Remove existing roles
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    
    // Add new role
    await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [id, role]);
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`[Admin] Deleting user ${id}`);
    
    // Prevent self-deletion
    if (id === req.user!.sub) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }
    
    // Best-effort cleanup of dependent rows.
    // In the supabase-selfhosted schema, user_profiles.user_id may not be a FK to users,
    // so deleting from users does NOT necessarily remove the profile row. That can leave
    // UNIQUE(username) stuck and block re-signups.
    console.log(`[Admin] Deleting user_roles for ${id}`);
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    
    console.log(`[Admin] Deleting library_members for ${id}`);
    await pool.query('DELETE FROM library_members WHERE user_id = $1', [id]);
    
    console.log(`[Admin] Deleting library_followers for ${id}`);
    await pool.query('DELETE FROM library_followers WHERE follower_user_id = $1', [id]);
    
    console.log(`[Admin] Deleting notification_preferences for ${id}`);
    await pool.query('DELETE FROM notification_preferences WHERE user_id = $1', [id]);
    
    console.log(`[Admin] Deleting user_totp_settings for ${id}`);
    await pool.query('DELETE FROM user_totp_settings WHERE user_id = $1', [id]);
    
    console.log(`[Admin] Deleting email_confirmation_tokens for ${id}`);
    await pool.query('DELETE FROM email_confirmation_tokens WHERE user_id = $1', [id]);
    
    console.log(`[Admin] Deleting password_reset_tokens for ${id}`);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [id]);
    
    console.log(`[Admin] Deleting user_profiles for ${id}`);
    const profileResult = await pool.query('DELETE FROM user_profiles WHERE user_id = $1 RETURNING username', [id]);
    console.log(`[Admin] Deleted profile rows:`, profileResult.rowCount, profileResult.rows);

    console.log(`[Admin] Deleting auth.users row for ${id}`);
    const userResult = await pool.query('DELETE FROM auth.users WHERE id = $1 RETURNING email', [id]);
    console.log(`[Admin] Deleted user rows:`, userResult.rowCount, userResult.rows);
    
    console.log(`[Admin] User ${id} deleted successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// AI description condensing (BYOK)
router.post('/condense', async (req: Request, res: Response) => {
  if (!config.features.ai || !config.aiApiKey) {
    res.status(400).json({ error: 'AI features not configured' });
    return;
  }
  
  try {
    const schema = z.object({
      batchSize: z.number().int().min(1).max(20).optional(),
      offset: z.number().int().min(0).optional(),
    });
    
    const { batchSize = 10, offset = 0 } = schema.parse(req.body);
    
    // Get games with long descriptions
    const gamesResult = await pool.query(`
      SELECT id, title, description
      FROM games
      WHERE description IS NOT NULL AND LENGTH(description) > 800
      ORDER BY title
      LIMIT $1 OFFSET $2
    `, [batchSize, offset]);
    
    if (gamesResult.rows.length === 0) {
      res.json({ success: true, message: 'No more games to process', updated: 0 });
      return;
    }
    
    let updated = 0;
    const errors: string[] = [];
    
    for (const game of gamesResult.rows) {
      try {
        const apiUrl = config.aiProvider === 'gemini'
          ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent'
          : 'https://api.openai.com/v1/chat/completions';
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        let body: any;
        
        if (config.aiProvider === 'gemini') {
          headers['x-goog-api-key'] = config.aiApiKey!;
          body = {
            contents: [{
              parts: [{ text: `Condense this game description for "${game.title}" to 150-200 words:\n\n${game.description}` }]
            }]
          };
        } else {
          headers['Authorization'] = `Bearer ${config.aiApiKey}`;
          body = {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a board game description editor. Condense descriptions to 150-200 words while keeping essential gameplay info.' },
              { role: 'user', content: `Condense this description for "${game.title}":\n\n${game.description}` }
            ],
            max_tokens: 500,
          };
        }
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            errors.push(`Rate limited at ${game.title}`);
            break;
          }
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json() as any;
        
        let newDescription: string;
        if (config.aiProvider === 'gemini') {
          newDescription = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          newDescription = data.choices?.[0]?.message?.content;
        }
        
        if (newDescription) {
          await pool.query(
            'UPDATE games SET description = $1, updated_at = NOW() WHERE id = $2',
            [newDescription.trim(), game.id]
          );
          updated++;
        }
        
        // Rate limit ourselves
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        errors.push(`${game.title}: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Condense error:', error);
    res.status(500).json({ error: 'Condensing failed' });
  }
});

// Get platform analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    // Get user counts
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM user_profiles');
    const totalUsers = parseInt(totalUsersResult.rows[0]?.count || '0', 10);

    // Get users created in last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const usersThisWeekResult = await pool.query(
      'SELECT COUNT(*) as count FROM user_profiles WHERE created_at >= $1',
      [weekAgo.toISOString()]
    );
    const usersThisWeek = parseInt(usersThisWeekResult.rows[0]?.count || '0', 10);

    // Get library counts
    const totalLibrariesResult = await pool.query('SELECT COUNT(*) as count FROM libraries');
    const totalLibraries = parseInt(totalLibrariesResult.rows[0]?.count || '0', 10);

    const activeLibrariesResult = await pool.query(
      'SELECT COUNT(*) as count FROM libraries WHERE is_active = true'
    );
    const activeLibraries = parseInt(activeLibrariesResult.rows[0]?.count || '0', 10);

    const premiumLibrariesResult = await pool.query(
      'SELECT COUNT(*) as count FROM libraries WHERE is_premium = true'
    );
    const premiumLibraries = parseInt(premiumLibrariesResult.rows[0]?.count || '0', 10);

    const librariesThisWeekResult = await pool.query(
      'SELECT COUNT(*) as count FROM libraries WHERE created_at >= $1',
      [weekAgo.toISOString()]
    );
    const librariesThisWeek = parseInt(librariesThisWeekResult.rows[0]?.count || '0', 10);

    res.json({
      totalUsers,
      totalLibraries,
      activeLibraries,
      premiumLibraries,
      usersThisWeek,
      librariesThisWeek,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get all libraries for admin panel
router.get('/libraries', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT l.id, l.name, l.slug, l.description, l.is_active, l.is_premium, l.created_at, l.owner_id,
             up.display_name as owner_display_name
      FROM libraries l
      LEFT JOIN user_profiles up ON l.owner_id = up.user_id
      ORDER BY l.created_at DESC
    `);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      is_active: row.is_active,
      is_premium: row.is_premium,
      created_at: row.created_at,
      owner_display_name: row.owner_display_name || 'Unknown',
    })));
  } catch (error) {
    console.error('List libraries error:', error);
    res.status(500).json({ error: 'Failed to fetch libraries' });
  }
});

// Suspend library
router.post('/libraries/:id/suspend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason?.trim()) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }
    
    // Update library status
    await pool.query('UPDATE libraries SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    
    // Create suspension record
    await pool.query(
      'INSERT INTO library_suspensions (library_id, action, reason, performed_by) VALUES ($1, $2, $3, $4)',
      [id, 'suspended', reason, req.user!.sub]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Suspend library error:', error);
    res.status(500).json({ error: 'Failed to suspend library' });
  }
});

// Unsuspend library
router.post('/libraries/:id/unsuspend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Update library status
    await pool.query('UPDATE libraries SET is_active = true, updated_at = NOW() WHERE id = $1', [id]);
    
    // Create unsuspension record
    await pool.query(
      'INSERT INTO library_suspensions (library_id, action, performed_by) VALUES ($1, $2, $3)',
      [id, 'unsuspended', req.user!.sub]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Unsuspend library error:', error);
    res.status(500).json({ error: 'Failed to unsuspend library' });
  }
});

// Update library premium status
router.put('/libraries/:id/premium', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_premium } = req.body;
    
    await pool.query('UPDATE libraries SET is_premium = $1, updated_at = NOW() WHERE id = $2', [is_premium, id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update premium error:', error);
    res.status(500).json({ error: 'Failed to update premium status' });
  }
});

// Get library suspension history
router.get('/libraries/:id/suspensions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT ls.id, ls.library_id, ls.action, ls.reason, ls.performed_by, ls.created_at,
             up.display_name as performer_name
      FROM library_suspensions ls
      LEFT JOIN user_profiles up ON ls.performed_by = up.user_id
      WHERE ls.library_id = $1
      ORDER BY ls.created_at DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get suspension history error:', error);
    res.status(500).json({ error: 'Failed to fetch suspension history' });
  }
});

// Get site settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT key, value FROM site_settings');
    const settings: Record<string, string | null> = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update site setting
router.put('/settings/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
