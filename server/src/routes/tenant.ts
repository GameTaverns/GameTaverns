import { Router, Request, Response } from 'express';
import { requireTenant } from '../middleware/tenant.js';
import { tenantQuery } from '../services/mariadb.js';
import mysql from 'mysql2/promise';

const router = Router();

// All routes require tenant context
router.use(requireTenant);

/**
 * GET /api/tenant
 * Get current tenant information
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant!;
    
    // Get tenant settings
    const settings = await tenantQuery<mysql.RowDataPacket[]>(
      tenant.slug,
      'SELECT key_name, value, value_type FROM settings'
    );
    
    // Get feature flags
    const flags = await tenantQuery<mysql.RowDataPacket[]>(
      tenant.slug,
      'SELECT key_name, enabled, config FROM feature_flags'
    );
    
    // Convert to objects
    const settingsObj: Record<string, any> = {};
    for (const row of settings) {
      settingsObj[row.key_name] = parseSettingValue(row.value, row.value_type);
    }
    
    const flagsObj: Record<string, any> = {};
    for (const row of flags) {
      flagsObj[row.key_name] = {
        enabled: row.enabled,
        config: row.config,
      };
    }
    
    res.json({
      slug: tenant.slug,
      settings: settingsObj,
      features: flagsObj,
    });
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    res.status(500).json({ error: 'Failed to fetch library info' });
  }
});

/**
 * GET /api/tenant/stats
 * Get library statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant!;
    
    const [stats] = await tenantQuery<mysql.RowDataPacket[]>(
      tenant.slug,
      `SELECT 
        (SELECT COUNT(*) FROM games WHERE is_expansion = FALSE) as total_games,
        (SELECT COUNT(*) FROM games WHERE is_expansion = TRUE) as total_expansions,
        (SELECT COUNT(*) FROM games WHERE is_for_sale = TRUE) as games_for_sale,
        (SELECT COUNT(*) FROM game_sessions) as total_plays,
        (SELECT COUNT(*) FROM game_wishlist) as wishlist_votes,
        (SELECT COUNT(*) FROM game_messages WHERE is_read = FALSE) as unread_messages`
    );
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching tenant stats:', error);
    res.status(500).json({ error: 'Failed to fetch library stats' });
  }
});

/**
 * PUT /api/tenant/settings
 * Update tenant settings (admin only)
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant!;
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Invalid settings data' });
      return;
    }
    
    const pool = req.tenantPool!;
    
    for (const [key, value] of Object.entries(settings)) {
      const valueType = typeof value === 'boolean' ? 'boolean' 
        : typeof value === 'number' ? 'number'
        : typeof value === 'object' ? 'json'
        : 'string';
      
      const stringValue = valueType === 'json' ? JSON.stringify(value) : String(value);
      
      await pool.execute(
        `INSERT INTO settings (key_name, value, value_type) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = ?, updated_at = CURRENT_TIMESTAMP`,
        [key, stringValue, valueType, stringValue]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * PUT /api/tenant/features/:flagName
 * Toggle a feature flag (admin only)
 */
router.put('/features/:flagName', async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant!;
    const { flagName } = req.params;
    const { enabled, config } = req.body;
    
    const pool = req.tenantPool!;
    
    await pool.execute(
      `INSERT INTO feature_flags (key_name, enabled, config) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled = ?, config = ?, updated_at = CURRENT_TIMESTAMP`,
      [flagName, enabled, JSON.stringify(config), enabled, JSON.stringify(config)]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

// Helper to parse setting values
function parseSettingValue(value: string, valueType: string): any {
  switch (valueType) {
    case 'boolean':
      return value === 'true';
    case 'number':
      return Number(value);
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

export default router;
