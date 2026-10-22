const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const PasswordResetModel = {
  async save(userId, tokenHash, expiresAt) {
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at`,
      [userId, tokenHash, expiresAt]
    );
  },

  async updatePassword(tokenHash, password) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT user_id FROM password_reset_tokens
         WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
         FOR UPDATE`,
        [tokenHash]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return false;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await client.query('UPDATE users SET password = $1 WHERE id = $2', [
        hashedPassword,
        rows[0].user_id,
      ]);
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [
        rows[0].user_id,
      ]);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = PasswordResetModel;
