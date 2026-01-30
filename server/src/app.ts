import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { tenantMiddleware } from './middleware/tenant.js';

// Routes
import authExtendedRoutes from './routes/authExtended.js';
import gamesRoutes from './routes/games.js';
import bggRoutes from './routes/bgg.js';
import ratingsRoutes from './routes/ratings.js';
import wishlistRoutes from './routes/wishlist.js';
import messagesRoutes from './routes/messages.js';
import adminRoutes from './routes/admin.js';
import imageProxyRoutes from './routes/imageProxy.js';
import tenantRoutes from './routes/tenant.js';
import platformRoutes from './routes/platform.js';
import pollsRoutes from './routes/polls.js';
import sessionsRoutes from './routes/sessions.js';
import eventsRoutes from './routes/events.js';
import profilesRoutes from './routes/profiles.js';
import uploadsRoutes from './routes/uploads.js';
import aiRoutes from './routes/ai.js';

export const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Let frontend handle CSP
}));

// CORS - support wildcard subdomains
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check against configured origins
    const allowed = config.corsOrigins.some(pattern => {
      if (pattern.includes('*')) {
        // Wildcard pattern like https://*.gametaverns.com
        const regex = new RegExp('^' + pattern.replace('*', '[^.]+') + '$');
        return regex.test(origin);
      }
      return pattern === origin;
    });
    
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
const uploadsPath = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadsPath)));

// Tenant resolution middleware (for multi-tenant mode)
if (config.isMariaDb) {
  app.use(tenantMiddleware);
}

// Rate limiting for all API routes
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    tenant: (req as any).tenant?.slug || null,
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: config.siteName,
    version: '2.0.0',
    features: config.features,
    multiTenant: config.isMariaDb,
    tenant: (req as any).tenant?.slug || null,
  });
});

// Public site settings (for frontend to fetch turnstile key, etc.)
app.get('/api/settings/public', async (req, res) => {
  try {
    // Import pool dynamically to avoid circular dependencies
    const { pool } = await import('./services/db.js');
    
    // Only expose safe, public settings
    const publicKeys = [
      'site_name', 'site_description', 'site_author',
      'turnstile_site_key', 
      'theme_primary_h', 'theme_primary_s', 'theme_primary_l',
      'theme_accent_h', 'theme_accent_s', 'theme_accent_l',
      'theme_background_h', 'theme_background_s', 'theme_background_l',
      'theme_card_h', 'theme_card_s', 'theme_card_l',
      'theme_sidebar_h', 'theme_sidebar_s', 'theme_sidebar_l',
      'theme_dark_primary_h', 'theme_dark_primary_s', 'theme_dark_primary_l',
      'theme_dark_accent_h', 'theme_dark_accent_s', 'theme_dark_accent_l',
      'theme_dark_background_h', 'theme_dark_background_s', 'theme_dark_background_l',
      'theme_dark_card_h', 'theme_dark_card_s', 'theme_dark_card_l',
      'theme_dark_sidebar_h', 'theme_dark_sidebar_s', 'theme_dark_sidebar_l',
      'theme_font_display', 'theme_font_body',
      'footer_text', 'twitter_handle', 'instagram_url', 'facebook_url', 'discord_url', 'contact_email',
      'feature_play_logs', 'feature_wishlist', 'feature_for_sale', 'feature_messaging',
      'feature_coming_soon', 'feature_demo_mode', 'feature_ratings', 'feature_events',
    ];
    
    const result = await pool.query(
      'SELECT key, value FROM site_settings WHERE key = ANY($1)',
      [publicKeys]
    );
    
    const settings: Record<string, string | null> = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Platform routes (signup, login, etc.) - for main domain
app.use('/api/platform', platformRoutes);

// Tenant routes (settings, stats) - for subdomains
app.use('/api/tenant', tenantRoutes);

// Auth routes (extended with email verification)
app.use('/api/auth', authExtendedRoutes);

// Compatibility alias: some frontends/proxies call auth routes without the /api prefix
// Keep this lightweight so both /api/auth/* and /auth/* work in self-hosted deployments.
app.use('/auth', authExtendedRoutes);

// Standard routes (work on both main domain and tenant subdomains)
app.use('/api/games', gamesRoutes);
app.use('/api/bgg', bggRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/image-proxy', imageProxyRoutes);

// New routes
app.use('/api/polls', pollsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/ai', aiRoutes);

// Catch-all for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
