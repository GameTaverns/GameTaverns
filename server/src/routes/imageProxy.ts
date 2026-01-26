import { Router, Request, Response } from 'express';
import { imageLimiter } from '../middleware/rateLimit.js';

const router = Router();

const ALLOWED_HOSTS = new Set(['cf.geekdo-images.com']);

router.get('/', imageLimiter, async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).send('URL parameter required');
      return;
    }
    
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      res.status(400).send('Invalid URL');
      return;
    }
    
    if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
      res.status(403).send('Host not allowed');
      return;
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GameHaven/2.0 (Image Proxy)',
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      res.status(response.status).send('Failed to fetch image');
      return;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).send('Proxy error');
  }
});

export default router;
