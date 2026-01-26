import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gamehaven',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  sessionSecret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
  
  // Site
  siteName: process.env.SITE_NAME || 'Game Haven',
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
  
  // AI (BYOK)
  aiProvider: process.env.AI_PROVIDER as 'openai' | 'gemini' | undefined,
  aiApiKey: process.env.AI_API_KEY,
  
  // Email
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  
  // Security
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
  piiEncryptionKey: process.env.PII_ENCRYPTION_KEY,
  
  // Features
  features: {
    playLogs: process.env.FEATURE_PLAY_LOGS !== 'false',
    wishlist: process.env.FEATURE_WISHLIST !== 'false',
    forSale: process.env.FEATURE_FOR_SALE !== 'false',
    messaging: process.env.FEATURE_MESSAGING !== 'false',
    ratings: process.env.FEATURE_RATINGS !== 'false',
    ai: !!process.env.AI_API_KEY,
  },
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
