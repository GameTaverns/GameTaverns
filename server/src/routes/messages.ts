import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { pool } from '../services/db.js';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { messageLimiter } from '../middleware/rateLimit.js';

const router = Router();

const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string | null {
  if (!config.piiEncryptionKey || config.piiEncryptionKey.length < 32) {
    console.warn('PII encryption key not configured');
    return null;
  }
  
  const key = createHash('sha256').update(config.piiEncryptionKey).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encrypted: string): string | null {
  if (!config.piiEncryptionKey || config.piiEncryptionKey.length < 32) {
    return null;
  }
  
  try {
    const [ivHex, authTagHex, data] = encrypted.split(':');
    const key = createHash('sha256').update(config.piiEncryptionKey).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch {
    return null;
  }
}

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] as string || req.socket.remoteAddress || 'unknown';
}

// Send message (public, rate limited)
router.post('/', messageLimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      gameId: z.string().uuid(),
      senderName: z.string().min(1).max(100),
      senderEmail: z.string().email().max(255),
      message: z.string().min(1).max(1000),
      turnstileToken: z.string().optional(),
    });
    
    const { gameId, senderName, senderEmail, message, turnstileToken } = schema.parse(req.body);
    
    // Verify Turnstile if configured
    if (config.turnstileSecretKey && turnstileToken) {
      const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${config.turnstileSecretKey}&response=${turnstileToken}`,
      });
      
      const verifyResult = await verifyResponse.json() as { success: boolean };
      if (!verifyResult.success) {
        res.status(400).json({ error: 'Captcha verification failed' });
        return;
      }
    }
    
    // Verify game exists and is for sale
    const game = await pool.query('SELECT id, is_for_sale FROM games WHERE id = $1', [gameId]);
    if (game.rows.length === 0) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }
    if (!game.rows[0].is_for_sale) {
      res.status(400).json({ error: 'Game is not for sale' });
      return;
    }
    
    const clientIP = getClientIP(req);
    
    // Encrypt PII
    const encryptedName = encrypt(senderName);
    const encryptedEmail = encrypt(senderEmail);
    const encryptedMessage = encrypt(message);
    const encryptedIP = encrypt(clientIP);
    
    await pool.query(
      `INSERT INTO game_messages (game_id, sender_name_encrypted, sender_email_encrypted, message_encrypted, sender_ip_encrypted)
       VALUES ($1, $2, $3, $4, $5)`,
      [gameId, encryptedName, encryptedEmail, encryptedMessage, encryptedIP]
    );
    
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages (admin only)
router.get('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT m.*, g.title as game_title
      FROM game_messages m
      JOIN games g ON m.game_id = g.id
      ORDER BY m.created_at DESC
      LIMIT 100
    `);
    
    // Decrypt messages
    const messages = result.rows.map(row => ({
      id: row.id,
      gameId: row.game_id,
      gameTitle: row.game_title,
      senderName: row.sender_name_encrypted ? decrypt(row.sender_name_encrypted) : null,
      senderEmail: row.sender_email_encrypted ? decrypt(row.sender_email_encrypted) : null,
      message: row.message_encrypted ? decrypt(row.message_encrypted) : null,
      senderIP: row.sender_ip_encrypted ? decrypt(row.sender_ip_encrypted) : null,
      isRead: row.is_read,
      createdAt: row.created_at,
    }));
    
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark as read (admin only)
router.put('/:id/read', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await pool.query('UPDATE game_messages SET is_read = true WHERE id = $1', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Delete message (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM game_messages WHERE id = $1', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
