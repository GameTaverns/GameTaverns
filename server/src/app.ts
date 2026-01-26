import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { apiLimiter } from './middleware/rateLimit.js';

// Routes
import authRoutes from './routes/auth.js';
import gamesRoutes from './routes/games.js';
import bggRoutes from './routes/bgg.js';
import ratingsRoutes from './routes/ratings.js';
import wishlistRoutes from './routes/wishlist.js';
import messagesRoutes from './routes/messages.js';
import adminRoutes from './routes/admin.js';
import imageProxyRoutes from './routes/imageProxy.js';

export const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Let frontend handle CSP
}));

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for all API routes
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: config.siteName,
    version: '2.0.0',
    features: config.features,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/bgg', bggRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/image-proxy', imageProxyRoutes);

// Catch-all for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
