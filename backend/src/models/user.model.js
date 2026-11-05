const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserModel = {
  async findAll() {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, active, created_at FROM users ORDER BY id'
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, active, created_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async setRole(id, role) {
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, active, created_at',
      [role, id]
    );
    return rows[0] || null;
  },

  async setActive(id, active) {
    const { rows } = await pool.query(
      'UPDATE users SET active = $1 WHERE id = $2 RETURNING id, name, email, role, active, created_at',
      [active, id]
    );
    return rows[0] || null;
  },

  async findPasswordById(id) {
    const { rows } = await pool.query('SELECT password FROM users WHERE id = $1', [id]);
    return rows[0]?.password || null;
  },

  async findByEmailExceptId(email, id) {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
      [email, id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  },

  async create({ name, email, password }) {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashed]
    );
    return rows[0];
  },

  async findExistingEmails(emails) {
    if (!emails.length) return [];
    const { rows } = await pool.query(
      'SELECT LOWER(email) AS email FROM users WHERE LOWER(email) = ANY($1::text[])',
      [emails]
    );
    return rows.map((row) => row.email);
  },

  async createInvitedVoters(users, actorId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const user of users) {
        const password = crypto.randomBytes(48).toString('base64url');
        const passwordHash = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const { rows } = await client.query(
          `INSERT INTO users (name, email, password, role)
           VALUES ($1, $2, $3, 'voter')
           RETURNING id, name, email`,
          [user.name, user.email, passwordHash]
        );
        await client.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '48 hours')`,
          [rows[0].id, tokenHash]
        );
        created.push({ ...rows[0], token });
      }
      await client.query(
        `INSERT INTO admin_audit_log (actor_id, action, entity_type, summary)
         VALUES ($1, 'voters.imported', 'users', $2)`,
        [actorId, `Importó ${created.length} cuentas votantes`]
      );
      await client.query('COMMIT');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id, { name, email }) {
    const { rows } = await pool.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, role, active, created_at',
      [name, email, id]
    );
    return rows[0] || null;
  },

  async updatePassword(id, password) {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id',
      [hashed, id]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rows } = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = UserModel;
