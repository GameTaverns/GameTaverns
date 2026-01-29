import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple .env locations (production installs to /opt/gametaverns/.env)
dotenvConfig({ path: path.resolve(__dirname, '../../.env') }); // server/.env (dev)
dotenvConfig({ path: path.resolve(__dirname, '../../../.env') }); // /opt/gametaverns/.env (prod)
dotenvConfig(); // CWD fallback

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database - PostgreSQL (Supabase/legacy)
  databaseUrl: process.env.DATABASE_URL,
  
  // Database - MariaDB (standalone multi-tenant)
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || '3306', 10),
  dbUser: process.env.DB_USER || 'gametaverns_app',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'gametaverns_core',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  sessionSecret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
  piiEncryptionKey: process.env.PII_ENCRYPTION_KEY || '',
  
  // Site
  siteName: process.env.SITE_NAME || 'GameTaverns',
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
  
  // AI Services (Platform-level keys)
  perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY || '',
  
  // Legacy AI (BYOK)
  aiProvider: process.env.AI_PROVIDER as 'openai' | 'gemini' | undefined,
  aiApiKey: process.env.AI_API_KEY,
  
  // Email (SMTP)
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@gametaverns.com',
  },
  
  // Security
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // Features
  features: {
    playLogs: process.env.FEATURE_PLAY_LOGS !== 'false',
    wishlist: process.env.FEATURE_WISHLIST !== 'false',
    forSale: process.env.FEATURE_FOR_SALE !== 'false',
    messaging: process.env.FEATURE_MESSAGING !== 'false',
    ratings: process.env.FEATURE_RATINGS !== 'false',
    ai: !!process.env.AI_API_KEY,
  },
  
  // Platform (multi-tenant)
  platformAdmins: process.env.PLATFORM_ADMINS?.split(',') || [],
  reservedSlugs: [
    'www', 'api', 'admin', 'mail', 'app', 'help', 'support', 'blog',
    ...(process.env.RESERVED_SLUGS?.split(',') || []),
  ],
  
  // Discord Integration
  discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
  discordClientId: process.env.DISCORD_CLIENT_ID || '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  
  // External services
  bggApiUrl: process.env.BGG_API_URL || 'https://boardgamegeek.com/xmlapi2',
  
  // Feature detection
  isMariaDb: !!process.env.DB_HOST || process.env.DATABASE_URL?.includes('mysql'),
  isStandalone: process.env.STANDALONE === 'true' || process.env.VITE_STANDALONE === 'true',
};

// Validate required config in production
export function validateConfig(): void {
  if (config.nodeEnv === 'production') {
    if (config.jwtSecret === 'dev-secret-change-in-production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    if (config.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
  }
}
