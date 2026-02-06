import { Router, Request, Response } from 'express';
import { pool } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Require authentication for all routes
router.use(authMiddleware);

/**
 * GET /api/membership/:libraryId
 * Check if current user is a member of the library
 */
router.get('/:libraryId', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user!.sub;
    
    const result = await pool.query(
      'SELECT * FROM library_members WHERE library_id = $1 AND user_id = $2',
      [libraryId, userId]
    );
    
    if (result.rows.length === 0) {
      res.json({ isMember: false, membership: null });
      return;
    }
    
    res.json({ isMember: true, membership: result.rows[0] });
  } catch (error) {
    console.error('Check membership error:', error);
    res.status(500).json({ error: 'Failed to check membership' });
  }
});

/**
 * POST /api/membership/:libraryId/join
 * Join a library as a member
 */
router.post('/:libraryId/join', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user!.sub;
    
    // Check if library exists and is active
    const libraryResult = await pool.query(
      'SELECT id, is_active, owner_id FROM libraries WHERE id = $1',
      [libraryId]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    if (!libraryResult.rows[0].is_active) {
      res.status(400).json({ error: 'Library is not active' });
      return;
    }
    
    // Check if user is already a member or owner
    if (libraryResult.rows[0].owner_id === userId) {
      res.status(400).json({ error: 'You are the owner of this library' });
      return;
    }
    
    const existingMembership = await pool.query(
      'SELECT id FROM library_members WHERE library_id = $1 AND user_id = $2',
      [libraryId, userId]
    );
    
    if (existingMembership.rows.length > 0) {
      res.status(400).json({ error: 'Already a member of this library' });
      return;
    }
    
    // Insert membership
    const result = await pool.query(
      `INSERT INTO library_members (library_id, user_id, role) 
       VALUES ($1, $2, 'member') 
       RETURNING *`,
      [libraryId, userId]
    );
    
    res.status(201).json({ success: true, membership: result.rows[0] });
  } catch (error) {
    console.error('Join library error:', error);
    res.status(500).json({ error: 'Failed to join library' });
  }
});

/**
 * POST /api/membership/:libraryId/leave
 * Leave a library
 */
router.post('/:libraryId/leave', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user!.sub;
    
    const result = await pool.query(
      'DELETE FROM library_members WHERE library_id = $1 AND user_id = $2 RETURNING id',
      [libraryId, userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Leave library error:', error);
    res.status(500).json({ error: 'Failed to leave library' });
  }
});

/**
 * GET /api/membership/:libraryId/members
 * Get all members of a library (for library owners/admins)
 */
router.get('/:libraryId/members', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    
    // Get explicit members
    const membersResult = await pool.query(`
      SELECT lm.*, up.display_name, up.username
      FROM library_members lm
      LEFT JOIN user_profiles up ON lm.user_id = up.user_id
      WHERE lm.library_id = $1
      ORDER BY lm.joined_at DESC
    `, [libraryId]);
    
    // Get library owner
    const libraryResult = await pool.query(
      'SELECT owner_id, created_at FROM libraries WHERE id = $1',
      [libraryId]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    const library = libraryResult.rows[0];
    
    // Get owner profile
    const ownerProfile = await pool.query(
      'SELECT display_name, username FROM user_profiles WHERE user_id = $1',
      [library.owner_id]
    );
    
    // Build response
    const members = [];
    
    // Add owner first if not already in members list
    const ownerInMembers = membersResult.rows.some(m => m.user_id === library.owner_id);
    if (!ownerInMembers) {
      members.push({
        id: `owner-${library.owner_id}`,
        library_id: libraryId,
        user_id: library.owner_id,
        role: 'owner',
        joined_at: library.created_at,
        display_name: ownerProfile.rows[0]?.display_name || null,
        username: ownerProfile.rows[0]?.username || null,
      });
    }
    
    // Add all members
    for (const member of membersResult.rows) {
      members.push({
        id: member.id,
        library_id: member.library_id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        display_name: member.display_name || null,
        username: member.username || null,
      });
    }
    
    res.json(members);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

/**
 * GET /api/membership/count/:libraryId
 * Get member count for a library
 */
router.get('/count/:libraryId', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM library_members WHERE library_id = $1',
      [libraryId]
    );
    
    // Add 1 for the owner
    const count = parseInt(result.rows[0].count, 10) + 1;
    
    res.json({ count });
  } catch (error) {
    console.error('Get member count error:', error);
    res.status(500).json({ error: 'Failed to get member count' });
  }
});

// =====================
// FOLLOWING ROUTES
// =====================

/**
 * POST /api/membership/:libraryId/follow
 * Follow a library
 */
router.post('/:libraryId/follow', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user!.sub;
    
    // Check if library exists and is active
    const libraryResult = await pool.query(
      'SELECT id, is_active FROM libraries WHERE id = $1',
      [libraryId]
    );
    
    if (libraryResult.rows.length === 0) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    if (!libraryResult.rows[0].is_active) {
      res.status(400).json({ error: 'Library is not active' });
      return;
    }
    
    // Check if already following
    const existingFollow = await pool.query(
      'SELECT id FROM library_followers WHERE library_id = $1 AND follower_user_id = $2',
      [libraryId, userId]
    );
    
    if (existingFollow.rows.length > 0) {
      res.status(400).json({ error: 'Already following this library' });
      return;
    }
    
    // Insert follow
    const result = await pool.query(
      `INSERT INTO library_followers (library_id, follower_user_id) 
       VALUES ($1, $2) 
       RETURNING *`,
      [libraryId, userId]
    );
    
    res.status(201).json({ success: true, follow: result.rows[0] });
  } catch (error) {
    console.error('Follow library error:', error);
    res.status(500).json({ error: 'Failed to follow library' });
  }
});

/**
 * POST /api/membership/:libraryId/unfollow
 * Unfollow a library
 */
router.post('/:libraryId/unfollow', async (req: Request, res: Response) => {
  try {
    const { libraryId } = req.params;
    const userId = req.user!.sub;
    
    const result = await pool.query(
      'DELETE FROM library_followers WHERE library_id = $1 AND follower_user_id = $2 RETURNING id',
      [libraryId, userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not following this library' });
      return;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow library error:', error);
    res.status(500).json({ error: 'Failed to unfollow library' });
  }
});

/**
 * GET /api/membership/following
 * Get libraries the current user follows
 */
router.get('/user/following', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    const result = await pool.query(
      'SELECT library_id FROM library_followers WHERE follower_user_id = $1',
      [userId]
    );
    
    res.json(result.rows.map(r => r.library_id));
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

/**
 * GET /api/membership/user/memberships
 * Get all libraries the current user is a member of
 */
router.get('/user/memberships', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    // Get memberships with library info
    const membershipsResult = await pool.query(`
      SELECT lm.id, lm.role, lm.joined_at, 
             l.id as library_id, l.name, l.slug, l.description
      FROM library_members lm
      JOIN libraries l ON lm.library_id = l.id
      WHERE lm.user_id = $1
      ORDER BY lm.joined_at DESC
    `, [userId]);
    
    // Get owned library
    const ownedResult = await pool.query(
      'SELECT id, name, slug, description, created_at FROM libraries WHERE owner_id = $1',
      [userId]
    );
    
    const results = [];
    
    // Add owned library first
    if (ownedResult.rows.length > 0) {
      const owned = ownedResult.rows[0];
      const alreadyMember = membershipsResult.rows.some(m => m.library_id === owned.id);
      if (!alreadyMember) {
        results.push({
          id: `owned-${owned.id}`,
          role: 'owner',
          joined_at: owned.created_at,
          library: {
            id: owned.id,
            name: owned.name,
            slug: owned.slug,
            description: owned.description,
          },
        });
      }
    }
    
    // Add memberships
    for (const m of membershipsResult.rows) {
      results.push({
        id: m.id,
        role: m.role,
        joined_at: m.joined_at,
        library: {
          id: m.library_id,
          name: m.name,
          slug: m.slug,
          description: m.description,
        },
      });
    }
    
    res.json(results);
  } catch (error) {
    console.error('Get memberships error:', error);
    res.status(500).json({ error: 'Failed to get memberships' });
  }
});

export default router;
