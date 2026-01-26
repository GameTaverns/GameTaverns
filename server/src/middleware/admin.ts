import { Request, Response, NextFunction } from 'express';
import { pool } from '../services/db.js';

export async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  
  try {
    const result = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
      [req.user.sub, 'admin']
    );
    
    if (result.rows.length === 0) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}
