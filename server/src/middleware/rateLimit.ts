import rateLimit from 'express-rate-limit';

// Login rate limiter - strict
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// BGG lookup rate limiter
export const bggLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Rate limit exceeded, please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Image proxy rate limiter - more lenient
export const imageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rating rate limiter
export const ratingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Rating limit exceeded, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message rate limiter
export const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Message limit exceeded, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});
