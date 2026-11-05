const pool = require('../config/db');

const AdminAuditModel = {
  async record(actorId, action, entityType, entityId, summary) {
    await pool.query(
      `INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, entityType, entityId == null ? null : String(entityId), summary]
    );
  },

  async latest(limit = 100) {
    const { rows } = await pool.query(
      `SELECT log.id, log.action, log.entity_type, log.entity_id, log.summary, log.created_at,
              users.name AS actor_name, users.email AS actor_email
       FROM admin_audit_log log
       LEFT JOIN users ON users.id = log.actor_id
       ORDER BY log.created_at DESC, log.id DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },
};

module.exports = AdminAuditModel;
