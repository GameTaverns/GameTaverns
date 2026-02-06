import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Require authentication for all routes
router.use(authMiddleware);

/**
 * GET /api/library-settings/:libraryId
 * Get library settings (public read for feature flags)
 */
router.get('/:libraryId', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM library_settings WHERE library_id = $1',
      [libraryId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Library settings not found' });
      return;
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get library settings error:', error);
    res.status(500).json({ error: 'Failed to fetch library settings' });
  }
});

/**
 * PUT /api/library-settings/:libraryId
 * Update library settings (owner only)
 */
router.put('/:libraryId', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user!.sub;
    
    // Verify ownership
    const libraryResult = await pool.query(
      'SELECT owner_id FROM libraries WHERE id = $1',
      [libraryId]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    if (libraryResult.rows[0].owner_id !== userId) {
      // Check if user is admin
      const adminCheck = await pool.query(
        "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'",
        [userId]
      );
      
      if (adminCheck.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized to update this library' });
        return;
      }
    }
    
    // Build dynamic update query from request body
    const allowedFields = [
      'allow_lending',
      'contact_email',
      'discord_url',
      'discord_webhook_url',
      'discord_events_channel_id',
      'discord_notifications',
      'facebook_url',
      'instagram_url',
      'twitter_handle',
      'footer_text',
      'lending_terms',
      'logo_url',
      'background_image_url',
      'background_overlay_opacity',
      'is_discoverable',
      'turnstile_site_key',
      // Feature flags
      'feature_play_logs',
      'feature_wishlist',
      'feature_for_sale',
      'feature_messaging',
      'feature_coming_soon',
      'feature_ratings',
      'feature_events',
      'feature_achievements',
      'feature_lending',
      // Theme colors (light mode)
      'theme_primary_h',
      'theme_primary_s',
      'theme_primary_l',
      'theme_accent_h',
      'theme_accent_s',
      'theme_accent_l',
      'theme_background_h',
      'theme_background_s',
      'theme_background_l',
      'theme_card_h',
      'theme_card_s',
      'theme_card_l',
      'theme_sidebar_h',
      'theme_sidebar_s',
      'theme_sidebar_l',
      // Theme colors (dark mode)
      'theme_dark_primary_h',
      'theme_dark_primary_s',
      'theme_dark_primary_l',
      'theme_dark_accent_h',
      'theme_dark_accent_s',
      'theme_dark_accent_l',
      'theme_dark_background_h',
      'theme_dark_background_s',
      'theme_dark_background_l',
      'theme_dark_card_h',
      'theme_dark_card_s',
      'theme_dark_card_l',
      'theme_dark_sidebar_h',
      'theme_dark_sidebar_s',
      'theme_dark_sidebar_l',
      // Theme fonts
      'theme_font_display',
      'theme_font_body',
    ];
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }
    
    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(libraryId);
    
    const query = `
      UPDATE library_settings 
      SET ${updates.join(', ')} 
      WHERE library_id = $${paramIndex}
      RETURNING library_id
    `;
    
    const updateResult = await pool.query(query, values);
    
    if (updateResult.rows.length === 0) {
      res.status(404).json({ error: 'Library settings not found' });
      return;
    }
    
    res.json({ success: true, library_id: updateResult.rows[0].library_id });
  } catch (error) {
    console.error('Update library settings error:', error);
    res.status(500).json({ error: 'Failed to update library settings' });
  }
});

/**
 * PUT /api/library-settings/:libraryId/features
 * Update feature flags specifically (owner only)
 */
router.put('/:libraryId/features', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user!.sub;
    
    // Verify ownership
    const libraryResult = await pool.query(
      'SELECT owner_id FROM libraries WHERE id = $1',
      [libraryId]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    if (libraryResult.rows[0].owner_id !== userId) {
      // Check if user is admin
      const adminCheck = await pool.query(
        "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'",
        [userId]
      );
      
      if (adminCheck.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized to update this library' });
        return;
      }
    }
    
    // Validate and update feature flags
    const featureSchema = z.object({
      feature_play_logs: z.boolean().optional(),
      feature_wishlist: z.boolean().optional(),
      feature_for_sale: z.boolean().optional(),
      feature_messaging: z.boolean().optional(),
      feature_coming_soon: z.boolean().optional(),
      feature_ratings: z.boolean().optional(),
      feature_events: z.boolean().optional(),
      feature_achievements: z.boolean().optional(),
      feature_lending: z.boolean().optional(),
      allow_lending: z.boolean().optional(),
    });
    
    const features = featureSchema.parse(req.body);
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(features)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (updates.length === 0) {
      res.status(400).json({ error: 'No features to update' });
      return;
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(libraryId);
    
    const query = `
      UPDATE library_settings 
      SET ${updates.join(', ')} 
      WHERE library_id = $${paramIndex}
      RETURNING library_id
    `;
    
    const updateResult = await pool.query(query, values);
    
    if (updateResult.rows.length === 0) {
      res.status(404).json({ error: 'Library settings not found' });
      return;
    }
    
    res.json({ success: true, library_id: updateResult.rows[0].library_id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid feature flags', details: error.errors });
      return;
    }
    console.error('Update feature flags error:', error);
    res.status(500).json({ error: 'Failed to update feature flags' });
  }
});

export default router;
