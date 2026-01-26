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

// List users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.created_at,
             ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
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
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    
    const passwordHash = await hashPassword(password);
    
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
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
    
    // Prevent self-deletion
    if (id === req.user!.sub) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
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
