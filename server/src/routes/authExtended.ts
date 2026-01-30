import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { sendEmail, buildVerificationEmail, buildPasswordResetEmail, isEmailConfigured } from '../services/email.js';
import { generateToken } from '../services/encryption.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// =====================
// Get Current User (for session validation)
// =====================

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, email_verified FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const user = userResult.rows[0];
    
    // Get roles
    const roleResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [userId]
    );
    
    const roles = roleResult.rows.map(r => r.role);
    const isAdmin = roles.includes('admin');
    
    // Get profile
    const profileResult = await pool.query(
      'SELECT display_name, username, avatar_url FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = profileResult.rows[0] || {};
    
    res.json({
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      roles,
      isAdmin,
      displayName: profile.display_name,
      username: profile.username,
      avatarUrl: profile.avatar_url,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// =====================
// Registration with Email Verification
// =====================

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  displayName: z.string().max(100).optional(),
});

router.post('/register', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = registerSchema.parse(req.body);
    
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }
    
    const normalizedEmail = email.toLowerCase();
    
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    
    const passwordHash = await hashPassword(password);
    
    // Create user (email_verified defaults to false)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, email_verified) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, email_verified, created_at`,
      [normalizedEmail, passwordHash, !isEmailConfigured()] // Auto-verify if no email configured
    );
    
    const user = result.rows[0];
    
    // Update display name in profile if provided
    if (displayName) {
      await pool.query(
        'UPDATE user_profiles SET display_name = $1 WHERE user_id = $2',
        [displayName, user.id]
      );
    }
    
    // Send verification email if SMTP is configured
    if (isEmailConfigured()) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await pool.query(
        `INSERT INTO email_confirmation_tokens (user_id, email, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, normalizedEmail, token, expiresAt]
      );
      
      const emailContent = buildVerificationEmail(normalizedEmail, token);
      await sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
      });
      
      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        requiresVerification: true,
      });
    } else {
      // No email configured - auto-login
      const token = signToken({ sub: user.id, email: user.email });
      res.status(201).json({
        user: { id: user.id, email: user.email },
        token,
        requiresVerification: false,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// =====================
// Email Verification
// =====================

router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    
    // Find valid token
    const tokenResult = await pool.query(
      `SELECT * FROM email_confirmation_tokens 
       WHERE token = $1 AND confirmed_at IS NULL AND expires_at > NOW()`,
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Mark email as verified
    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [tokenData.user_id]);
    
    // Mark token as used
    await pool.query(
      'UPDATE email_confirmation_tokens SET confirmed_at = NOW() WHERE id = $1',
      [tokenData.id]
    );
    
    // Get user for login
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [tokenData.user_id]
    );
    
    const user = userResult.rows[0];
    const authToken = signToken({ sub: user.id, email: user.email });
    
    res.json({
      message: 'Email verified successfully',
      user: { id: user.id, email: user.email },
      token: authToken,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification email
router.post('/resend-verification', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    
    const normalizedEmail = email.toLowerCase();
    
    // Find user
    const userResult = await pool.query(
      'SELECT id, email, email_verified FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    if (userResult.rows.length === 0) {
      // Don't reveal if user exists
      res.json({ message: 'If an account exists, a verification email has been sent.' });
      return;
    }
    
    const user = userResult.rows[0];
    
    if (user.email_verified) {
      res.json({ message: 'Email is already verified. You can log in.' });
      return;
    }
    
    if (!isEmailConfigured()) {
      res.status(400).json({ error: 'Email service not configured' });
      return;
    }
    
    // Invalidate old tokens
    await pool.query(
      'DELETE FROM email_confirmation_tokens WHERE user_id = $1 AND confirmed_at IS NULL',
      [user.id]
    );
    
    // Create new token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await pool.query(
      `INSERT INTO email_confirmation_tokens (user_id, email, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, normalizedEmail, token, expiresAt]
    );
    
    const emailContent = buildVerificationEmail(normalizedEmail, token);
    await sendEmail({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    
    res.json({ message: 'Verification email sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// =====================
// Password Reset
// =====================

router.post('/forgot-password', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    
    const normalizedEmail = email.toLowerCase();
    
    // Always return success (don't reveal if user exists)
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [normalizedEmail]
    );
    
    if (userResult.rows.length > 0 && isEmailConfigured()) {
      const user = userResult.rows[0];
      
      // Invalidate old tokens
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
        [user.id]
      );
      
      // Create reset token (1 hour expiry)
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, email, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, normalizedEmail, token, expiresAt]
      );
      
      const emailContent = buildPasswordResetEmail(normalizedEmail, token);
      await sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
      });
    }
    
    res.json({ message: 'If an account exists, a password reset email has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/verify-reset-token', async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    
    const tokenResult = await pool.query(
      `SELECT email FROM password_reset_tokens 
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      res.status(400).json({ valid: false, error: 'Invalid or expired token' });
      return;
    }
    
    res.json({ valid: true, email: tokenResult.rows[0].email });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string().min(8).max(128),
    });
    
    const { token, newPassword } = schema.parse(req.body);
    
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      res.status(400).json({ error: strength.message });
      return;
    }
    
    // Find valid token
    const tokenResult = await pool.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Update password
    const passwordHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, tokenData.user_id]
    );
    
    // Mark token as used
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenData.id]
    );
    
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// =====================
// Login (with verification check)
// =====================

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      email: z.string(),
      password: z.string(),
    });
    
    const { email, password } = schema.parse(req.body);
    
    // Check if input is username or email
    const isEmail = email.includes('@');
    let normalizedEmail = email.toLowerCase();
    
    if (!isEmail) {
      // Resolve username to email
      const usernameResult = await pool.query(
        'SELECT u.email FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE LOWER(p.username) = $1',
        [normalizedEmail]
      );
      
      if (usernameResult.rows.length === 0) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      
      normalizedEmail = usernameResult.rows[0].email;
    }
    
    const result = await pool.query(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
      [normalizedEmail]
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
    
    // Check if email is verified
    if (!user.email_verified && isEmailConfigured()) {
      res.status(403).json({ 
        error: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email,
      });
      return;
    }
    
    // Get user role
    const roleResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role LIMIT 1',
      [user.id]
    );
    const role = roleResult.rows[0]?.role || 'user';
    
    // Get profile
    const profileResult = await pool.query(
      'SELECT display_name, username, avatar_url FROM user_profiles WHERE user_id = $1',
      [user.id]
    );
    const profile = profileResult.rows[0] || {};
    
    const token = signToken({ sub: user.id, email: user.email, role });
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role,
        displayName: profile.display_name,
        username: profile.username,
        avatarUrl: profile.avatar_url,
      },
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

export default router;
