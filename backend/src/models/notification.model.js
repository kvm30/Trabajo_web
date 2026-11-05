const pool = require('../config/db');

const NotificationModel = {
  async create({ userId = null, type, title, message, electionId = null }) {
    const { rows } = await pool.query(`
      INSERT INTO notifications (user_id, type, title, message, election_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, type, election_id) WHERE user_id IS NOT NULL DO NOTHING
      RETURNING *`, [userId, type, title, message, electionId]);
    return rows[0] || null;
  },

  async createForAll(type, title, message, electionId) {
    const { rows } = await pool.query(`
      INSERT INTO notifications (user_id, type, title, message, election_id)
      SELECT id, $1, $2, $3, $4 FROM users WHERE active = TRUE
      ON CONFLICT (user_id, type, election_id) DO NOTHING
      RETURNING id`, [type, title, message, electionId]);
    return rows.length;
  },

  async createForAdmins(type, title, message, electionId, excludeUserId = null) {
    const { rows } = await pool.query(`
      INSERT INTO notifications (user_id, type, title, message, election_id)
      SELECT id, $1, $2, $3, $4 FROM users
      WHERE active = TRUE AND role = 'admin' AND ($5::int IS NULL OR id <> $5)
      ON CONFLICT (user_id, type, election_id) DO NOTHING
      RETURNING id`, [type, title, message, electionId, excludeUserId]);
    return rows.length;
  },

  async listForUser(userId, role) {
    const { rows } = await pool.query(`
      SELECT n.* FROM notifications n
      WHERE n.user_id = $1 OR (n.user_id IS NULL AND n.audience = $2)
      ORDER BY n.created_at DESC, n.id DESC LIMIT 50`, [userId, role]);
    return rows;
  },

  async unreadCount(userId, role) {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int AS count FROM notifications n
      WHERE (n.user_id = $1 OR (n.user_id IS NULL AND n.audience = $2)) AND n.read_at IS NULL`,
    [userId, role]);
    return rows[0].count;
  },

  async markRead(userId, id = null) {
    if (id) {
      await pool.query(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`, [id, userId]);
    } else {
      await pool.query(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL`, [userId]);
    }
  },

  async findDueReminders() {
    const { rows } = await pool.query(`
      SELECT e.id, e.title, e.ends_at
      FROM elections e
      WHERE e.status = 'open'
        AND e.ends_at IS NOT NULL
        AND e.ends_at > CURRENT_TIMESTAMP
        AND e.ends_at <= CURRENT_TIMESTAMP + INTERVAL '1 hour'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.election_id = e.id AND n.type = 'closing-soon'
        )`);
    return rows;
  },
};

module.exports = NotificationModel;
