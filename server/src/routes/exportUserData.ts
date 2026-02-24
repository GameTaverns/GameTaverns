import { Router, Response } from 'express';
import { pool } from '../services/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Gather all user data in parallel
    const [
      userResult,
      profileResult,
      rolesResult,
      librariesResult,
      achievementsResult,
      activityResult,
      loansLenderResult,
      loansBorrowerResult,
      messagesResult,
      forumThreadsResult,
      forumRepliesResult,
      notificationsResult,
      curatedListsResult,
      sessionsResult,
      eloResult,
      membershipsResult,
    ] = await Promise.all([
      pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [userId]),
      pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM user_roles WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM libraries WHERE owner_id = $1', [userId]),
      pool.query(`SELECT ua.*, a.name, a.slug, a.description, a.icon 
        FROM user_achievements ua LEFT JOIN achievements a ON a.id = ua.achievement_id 
        WHERE ua.user_id = $1`, [userId]),
      pool.query('SELECT * FROM activity_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000', [userId]),
      pool.query('SELECT gl.*, g.title as game_title FROM game_loans gl LEFT JOIN games g ON g.id = gl.game_id WHERE gl.lender_user_id = $1', [userId]),
      pool.query('SELECT gl.*, g.title as game_title FROM game_loans gl LEFT JOIN games g ON g.id = gl.game_id WHERE gl.borrower_user_id = $1', [userId]),
      pool.query('SELECT * FROM game_messages WHERE sender_user_id = $1 ORDER BY created_at DESC LIMIT 1000', [userId]),
      pool.query('SELECT * FROM forum_threads WHERE author_id = $1', [userId]),
      pool.query('SELECT * FROM forum_replies WHERE author_id = $1', [userId]),
      pool.query('SELECT * FROM notification_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500', [userId]),
      pool.query('SELECT * FROM curated_lists WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM game_sessions WHERE logged_by = $1', [userId]),
      pool.query('SELECT * FROM player_elo_ratings WHERE user_id = $1', [userId]),
      pool.query('SELECT lm.*, l.name as library_name, l.slug as library_slug FROM library_members lm LEFT JOIN libraries l ON l.id = lm.library_id WHERE lm.user_id = $1', [userId]),
    ]);

    // Get games for owned libraries
    const libraryIds = librariesResult.rows.map((l: any) => l.id);
    let games: any[] = [];
    let gameAdminData: any[] = [];
    if (libraryIds.length > 0) {
      const gamesResult = await pool.query('SELECT * FROM games WHERE library_id = ANY($1)', [libraryIds]);
      games = gamesResult.rows;
      
      const gameIds = games.map((g: any) => g.id);
      if (gameIds.length > 0) {
        const adminDataResult = await pool.query('SELECT * FROM game_admin_data WHERE game_id = ANY($1)', [gameIds]);
        gameAdminData = adminDataResult.rows;
      }
    }

    // Get curated list items
    const listIds = curatedListsResult.rows.map((l: any) => l.id);
    let listItems: any[] = [];
    if (listIds.length > 0) {
      const itemsResult = await pool.query('SELECT * FROM curated_list_items WHERE list_id = ANY($1)', [listIds]);
      listItems = itemsResult.rows;
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      user: userResult.rows[0] || null,
      profile: profileResult.rows[0] || null,
      roles: rolesResult.rows,
      libraries: librariesResult.rows,
      games,
      game_admin_data: gameAdminData,
      memberships: membershipsResult.rows,
      achievements: achievementsResult.rows,
      activity_feed: activityResult.rows,
      loans_as_lender: loansLenderResult.rows,
      loans_as_borrower: loansBorrowerResult.rows,
      messages: messagesResult.rows,
      forum_threads: forumThreadsResult.rows,
      forum_replies: forumRepliesResult.rows,
      notifications: notificationsResult.rows,
      curated_lists: curatedListsResult.rows.map((list: any) => ({
        ...list,
        items: listItems.filter((item: any) => item.list_id === list.id),
      })),
      game_sessions: sessionsResult.rows,
      elo_ratings: eloResult.rows,
    };

    res.setHeader('Content-Disposition', `attachment; filename="gametaverns-data-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export user data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
