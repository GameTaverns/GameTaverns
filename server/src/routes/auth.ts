import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }
    
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    
    const passwordHash = await hashPassword(password);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email.toLowerCase(), passwordHash]
    );
    
    const user = result.rows[0];
    const token = signToken({ sub: user.id, email: user.email });
    
    res.status(201).json({
      user: { id: user.id, email: user.email },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const user = result.rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    // Get user role
    const roleResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role LIMIT 1',
      [user.id]
    );
    const role = roleResult.rows[0]?.role || 'user';
    
    const token = signToken({ sub: user.id, email: user.email, role });
    
    res.json({
      user: { id: user.id, email: user.email, role },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [req.user!.sub]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const user = result.rows[0];
    
    // Get role
    const roleResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [user.id]
    );
    const roles = roleResult.rows.map(r => r.role);
    
    res.json({
      ...user,
      roles,
      isAdmin: roles.includes('admin'),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8).max(128),
    });
    
    const { currentPassword, newPassword } = schema.parse(req.body);
    
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }
    
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.sub]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const valid = await verifyPassword(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    
    const newHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user!.sub]
    );
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
