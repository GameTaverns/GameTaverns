import { Router, Request, Response } from 'express';
import { requirePlatform } from '../middleware/tenant.js';
import { coreQuery, withCoreTransaction } from '../services/mariadb.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

// Platform routes don't require tenant context
router.use(requirePlatform);

/**
 * POST /api/platform/signup
 * Create a new user and their library
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, librarySlug } = req.body;
    
    // Validation
    if (!email || !password || !displayName || !librarySlug) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }
    
    // Validate library slug format
    const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!slugRegex.test(librarySlug) || librarySlug.length < 3 || librarySlug.length > 30) {
      res.status(400).json({ 
        error: 'Library URL must be 3-30 characters, lowercase letters, numbers, and hyphens only' 
      });
      return;
    }
    
    // Reserved slugs
    const reserved = ['www', 'api', 'admin', 'mail', 'app', 'help', 'support', 'blog'];
    if (reserved.includes(librarySlug)) {
      res.status(400).json({ error: 'This library URL is reserved' });
      return;
    }
    
    // Check if email exists
    const existingUsers = await coreQuery<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    
    if (existingUsers.length > 0) {
      res.status(400).json({ error: 'An account with this email already exists' });
      return;
    }
    
    // Check if slug exists
    const existingTenants = await coreQuery<mysql.RowDataPacket[]>(
      'SELECT id FROM tenants WHERE slug = ?',
      [librarySlug]
    );
    
    if (existingTenants.length > 0) {
      res.status(400).json({ error: 'This library URL is already taken' });
      return;
    }
    
    // Create user and tenant in transaction
    const result = await withCoreTransaction(async (conn) => {
      const userId = uuidv4();
      const tenantId = uuidv4();
      const passwordHash = await hashPassword(password);
      
      // Create user
      await conn.execute(
        `INSERT INTO users (id, email, password_hash, display_name, email_verified) 
         VALUES (?, ?, ?, ?, FALSE)`,
        [userId, email.toLowerCase(), passwordHash, displayName]
      );
      
      // Create tenant
      await conn.execute(
        `INSERT INTO tenants (id, slug, name, owner_id, status) 
         VALUES (?, ?, ?, ?, 'active')`,
        [tenantId, librarySlug, `${displayName}'s Library`, userId]
      );
      
      // Add user as tenant admin
      await conn.execute(
        `INSERT INTO tenant_members (id, tenant_id, user_id, role) 
         VALUES (?, ?, ?, 'owner')`,
        [uuidv4(), tenantId, userId]
      );
      
      return { userId, tenantId, librarySlug };
    });
    
    // Create tenant schema (run external script)
    try {
      // In production, this would be a proper provisioning system
      // For now, we'll create via SQL
      const schemaName = `tenant_${librarySlug}`;
      console.log(`Creating tenant schema: ${schemaName}`);
      
      // This should be replaced with actual schema creation
      // await execAsync(`./deploy/mariadb/03-create-tenant.sh ${librarySlug} ${email} "${displayName}"`);
    } catch (schemaError) {
      console.error('Schema creation error (continuing anyway):', schemaError);
    }
    
    // Generate token
    const token = signToken({
      sub: result.userId,
      email: email.toLowerCase(),
      role: 'user',
      tenantId: result.tenantId,
      tenantSlug: result.librarySlug,
    });
    
    res.status(201).json({
      user: {
        id: result.userId,
        email: email.toLowerCase(),
        displayName,
      },
      library: {
        slug: result.librarySlug,
        url: `https://${result.librarySlug}.gametaverns.com`,
      },
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * POST /api/platform/login
 * Login to the platform
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    // Find user
    const users = await coreQuery<mysql.RowDataPacket[]>(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    
    if (users.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    
    const user = users[0];
    
    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    
    // Get user's tenants
    const tenants = await coreQuery<mysql.RowDataPacket[]>(
      `SELECT t.id, t.slug, t.name, tm.role
       FROM tenants t
       JOIN tenant_members tm ON t.id = tm.tenant_id
       WHERE tm.user_id = ? AND t.status = 'active'`,
      [user.id]
    );
    
    // Get primary tenant (owner first, then first one)
    const primaryTenant = tenants.find(t => t.role === 'owner') || tenants[0];
    
    // Generate token
    const token = signToken({
      sub: user.id,
      email: user.email,
      role: 'user',
      tenantId: primaryTenant?.id,
      tenantSlug: primaryTenant?.slug,
    });
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
      libraries: tenants.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        role: t.role,
        url: `https://${t.slug}.gametaverns.com`,
      })),
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

/**
 * GET /api/platform/check-slug/:slug
 * Check if a library slug is available
 */
router.get('/check-slug/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Validate format
    const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!slugRegex.test(slug)) {
      res.json({ available: false, reason: 'invalid_format' });
      return;
    }
    
    // Check reserved
    const reserved = ['www', 'api', 'admin', 'mail', 'app', 'help', 'support', 'blog'];
    if (reserved.includes(slug)) {
      res.json({ available: false, reason: 'reserved' });
      return;
    }
    
    // Check database
    const existing = await coreQuery<mysql.RowDataPacket[]>(
      'SELECT id FROM tenants WHERE slug = ?',
      [slug]
    );
    
    res.json({ 
      available: existing.length === 0,
      reason: existing.length > 0 ? 'taken' : null,
    });
  } catch (error) {
    console.error('Slug check error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

/**
 * GET /api/platform/health
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await coreQuery<mysql.RowDataPacket[]>('SELECT 1');
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

export default router;
