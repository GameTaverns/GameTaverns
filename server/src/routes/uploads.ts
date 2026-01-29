import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = Router();

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// =====================
// Upload image (base64)
// =====================

router.post('/image', authMiddleware, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      data: z.string(), // base64
      filename: z.string(),
      folder: z.string().optional(),
    });
    
    const { data, filename, folder } = schema.parse(req.body);
    
    // Parse base64
    const matches = data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: 'Invalid base64 data' });
      return;
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    
    if (!ALLOWED_TYPES.includes(mimeType)) {
      res.status(400).json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' });
      return;
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (buffer.length > MAX_SIZE) {
      res.status(400).json({ error: 'File too large. Maximum size: 5MB' });
      return;
    }
    
    // Generate unique filename
    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const hash = crypto.randomBytes(8).toString('hex');
    const safeFilename = `${Date.now()}-${hash}.${ext}`;
    
    // Create subfolder if specified
    const uploadFolder = folder ? path.join(UPLOAD_DIR, folder) : UPLOAD_DIR;
    if (!fs.existsSync(uploadFolder)) {
      fs.mkdirSync(uploadFolder, { recursive: true });
    }
    
    const filePath = path.join(uploadFolder, safeFilename);
    fs.writeFileSync(filePath, buffer);
    
    // Return public URL
    const publicPath = folder ? `/${folder}/${safeFilename}` : `/${safeFilename}`;
    const url = `/uploads${publicPath}`;
    
    res.json({ url, filename: safeFilename });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// =====================
// Upload library logo
// =====================

router.post('/library/:libraryId/logo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    
    // Verify ownership
    const libraryResult = await pool.query(
      'SELECT owner_id FROM libraries WHERE id = $1',
      [libraryId]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    if (libraryResult.rows[0].owner_id !== req.user!.sub) {
      const roleResult = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [req.user!.sub, 'admin']
      );
      if (roleResult.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    }
    
    const { data } = z.object({ data: z.string() }).parse(req.body);
    
    // Parse base64
    const matches = data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: 'Invalid base64 data' });
      return;
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    
    if (!ALLOWED_TYPES.includes(mimeType)) {
      res.status(400).json({ error: 'Invalid file type' });
      return;
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (buffer.length > MAX_SIZE) {
      res.status(400).json({ error: 'File too large' });
      return;
    }
    
    // Save to library-logos folder
    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${libraryId}.${ext}`;
    const logosDir = path.join(UPLOAD_DIR, 'library-logos');
    
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }
    
    const filePath = path.join(logosDir, filename);
    fs.writeFileSync(filePath, buffer);
    
    const logoUrl = `/uploads/library-logos/${filename}`;
    
    // Update library settings
    await pool.query(
      'UPDATE library_settings SET logo_url = $1, updated_at = NOW() WHERE library_id = $2',
      [logoUrl, libraryId]
    );
    
    res.json({ url: logoUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// =====================
// Delete uploaded file
// =====================

router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { url } = z.object({ url: z.string() }).parse(req.body);
    
    // Extract path from URL
    const urlPath = url.replace('/uploads', '');
    const filePath = path.join(UPLOAD_DIR, urlPath);
    
    // Security: ensure path is within uploads directory
    const resolvedPath = path.resolve(filePath);
    const uploadsPath = path.resolve(UPLOAD_DIR);
    
    if (!resolvedPath.startsWith(uploadsPath)) {
      res.status(403).json({ error: 'Invalid path' });
      return;
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
