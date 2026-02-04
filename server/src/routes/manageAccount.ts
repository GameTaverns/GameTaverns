import { Router, Response } from 'express';
import { pool } from '../services/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

type ActionType = 'clear_library' | 'delete_library' | 'delete_account';

interface ManageAccountRequest {
  action: ActionType;
  libraryId?: string;
  confirmationText: string;
}

// Manage account actions (clear library, delete library, delete account)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { action, libraryId, confirmationText }: ManageAccountRequest = req.body;

    if (!action || !confirmationText) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // Get user info for account deletion verification
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    const userEmail = userResult.rows[0].email;

    switch (action) {
      case 'clear_library': {
        if (!libraryId) {
          res.status(400).json({ success: false, error: 'Library ID required' });
          return;
        }

        // Get library and verify ownership
        const libraryResult = await pool.query(
          'SELECT id, name, owner_id FROM libraries WHERE id = $1',
          [libraryId]
        );

        if (libraryResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Library not found' });
          return;
        }

        const library = libraryResult.rows[0];

        if (library.owner_id !== userId) {
          res.status(403).json({ success: false, error: 'Not authorized' });
          return;
        }

        // Verify confirmation text matches library name
        if (confirmationText.toLowerCase() !== library.name.toLowerCase()) {
          res.status(400).json({ success: false, error: 'Confirmation text does not match library name' });
          return;
        }

        // Delete all games for this library (cascades to related tables)
        await pool.query('DELETE FROM games WHERE library_id = $1', [libraryId]);

        // Delete import jobs
        await pool.query('DELETE FROM import_jobs WHERE library_id = $1', [libraryId]);

        console.log(`Cleared all games from library ${libraryId}`);

        res.json({ 
          success: true, 
          message: 'Library games cleared successfully' 
        });
        return;
      }

      case 'delete_library': {
        if (!libraryId) {
          res.status(400).json({ success: false, error: 'Library ID required' });
          return;
        }

        // Get library and verify ownership
        const libraryResult = await pool.query(
          'SELECT id, name, owner_id FROM libraries WHERE id = $1',
          [libraryId]
        );

        if (libraryResult.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Library not found' });
          return;
        }

        const library = libraryResult.rows[0];

        if (library.owner_id !== userId) {
          res.status(403).json({ success: false, error: 'Not authorized' });
          return;
        }

        // Verify confirmation text matches library name
        if (confirmationText.toLowerCase() !== library.name.toLowerCase()) {
          res.status(400).json({ success: false, error: 'Confirmation text does not match library name' });
          return;
        }

        // Delete in order to respect foreign keys
        await pool.query('DELETE FROM library_settings WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM library_suspensions WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM library_members WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM library_followers WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM library_events WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM game_polls WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM import_jobs WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM games WHERE library_id = $1', [libraryId]);
        await pool.query('DELETE FROM libraries WHERE id = $1', [libraryId]);

        console.log(`Deleted library ${libraryId}`);

        res.json({ 
          success: true, 
          message: 'Library deleted successfully' 
        });
        return;
      }

      case 'delete_account': {
        // Check if user is an admin - admins cannot delete their own accounts
        const adminCheck = await pool.query(
          "SELECT role FROM user_roles WHERE user_id = $1 AND role = 'admin'",
          [userId]
        );

        if (adminCheck.rows.length > 0) {
          res.status(403).json({ 
            success: false, 
            error: 'Administrators cannot delete their own accounts. Please have another admin remove your admin role first.' 
          });
          return;
        }

        // Verify confirmation text matches email
        if (confirmationText.toLowerCase() !== userEmail.toLowerCase()) {
          res.status(400).json({ success: false, error: 'Confirmation text does not match email address' });
          return;
        }

        // Get all user's libraries
        const userLibraries = await pool.query(
          'SELECT id FROM libraries WHERE owner_id = $1',
          [userId]
        );

        // Delete all user's libraries and their data
        for (const lib of userLibraries.rows) {
          await pool.query('DELETE FROM library_settings WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM library_suspensions WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM library_members WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM library_followers WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM library_events WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM game_polls WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM import_jobs WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM games WHERE library_id = $1', [lib.id]);
          await pool.query('DELETE FROM libraries WHERE id = $1', [lib.id]);
        }

        // Delete user-related data
        await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM notification_log WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_totp_settings WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM email_confirmation_tokens WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

        // Finally, delete the user
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        console.log(`Deleted account for user ${userId}`);

        res.json({ 
          success: true, 
          message: 'Account deleted successfully' 
        });
        return;
      }

      default:
        res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Manage account error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
