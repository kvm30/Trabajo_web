const pool = require('../config/db');

const ElectionModel = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT e.id, e.title, e.description, e.status, e.starts_at, e.ends_at, e.created_at,
             (SELECT COUNT(*)::int FROM votes v WHERE v.election_id = e.id) AS total_votes,
             (SELECT COUNT(*)::int FROM candidates c WHERE c.election_id = e.id) AS total_candidates,
             COALESCE((
               SELECT JSON_AGG(json_build_object('id', c.id, 'name', c.name, 'description', c.description) ORDER BY c.id)
               FROM candidates c WHERE c.election_id = e.id
             ), '[]'::json) AS candidates
      FROM elections e ORDER BY e.id DESC`);
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, title, description, status, starts_at, ends_at, created_at FROM elections WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create({ title, description, starts_at, ends_at }, userId) {
    const { rows } = await pool.query(
      'INSERT INTO elections (title, description, starts_at, ends_at, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description || null, starts_at, ends_at, userId]);
    return rows[0];
  },

  async update(id, { title, description, starts_at, ends_at }) {
    const { rows } = await pool.query(
      `UPDATE elections SET title = $1, description = $2, starts_at = $3, ends_at = $4
       WHERE id = $5 AND status = 'draft' RETURNING *`,
      [title, description || null, starts_at, ends_at, id]
    );
    return rows[0] || null;
  },

  async remove(id) {
    const { rows } = await pool.query(
      "DELETE FROM elections WHERE id = $1 AND status = 'draft' RETURNING id",
      [id]
    );
    return rows[0] || null;
  },

  async duplicate(id, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const source = await client.query('SELECT title, description, starts_at, ends_at FROM elections WHERE id = $1 AND status = $2', [id, 'draft']);
      if (!source.rows[0]) return null;
      const duration = new Date(source.rows[0].ends_at) - new Date(source.rows[0].starts_at);
      const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + duration);
      const created = await client.query(
        `INSERT INTO elections (title, description, starts_at, ends_at, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [`${source.rows[0].title} (copia)`, source.rows[0].description, startsAt, endsAt, userId]
      );
      await client.query(
        `INSERT INTO candidates (election_id, name, description)
         SELECT $1, name, description FROM candidates WHERE election_id = $2`,
        [created.rows[0].id, id]
      );
      await client.query('COMMIT');
      return created.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateCandidate(candidateId, electionId, { name, description }) {
    const { rows } = await pool.query(
      `UPDATE candidates c SET name = $1, description = $2
       FROM elections e WHERE c.id = $3 AND c.election_id = $4 AND e.id = $4 AND e.status = 'draft'
       RETURNING c.*`,
      [name, description || null, candidateId, electionId]
    );
    return rows[0] || null;
  },

  async removeCandidate(candidateId, electionId) {
    const { rows } = await pool.query(
      `DELETE FROM candidates c USING elections e
       WHERE c.id = $1 AND c.election_id = $2 AND e.id = $2 AND e.status = 'draft'
       RETURNING c.*`,
      [candidateId, electionId]
    );
    return rows[0] || null;
  },

  async setStatus(id, status) {
    const { rows } = await pool.query(
      'UPDATE elections SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return rows[0] || null;
  },

  async reconcileSchedule() {
    const { rows } = await pool.query(`
      UPDATE elections e
      SET status = CASE
        WHEN e.ends_at IS NOT NULL AND e.ends_at <= CURRENT_TIMESTAMP THEN 'closed'
        WHEN e.status = 'draft'
          AND e.starts_at IS NOT NULL
          AND e.starts_at <= CURRENT_TIMESTAMP
          AND (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id) > 0
        THEN 'open'
        ELSE e.status
      END
      WHERE e.status IN ('draft', 'open')
        AND (
          (e.ends_at IS NOT NULL AND e.ends_at <= CURRENT_TIMESTAMP)
          OR (
            e.status = 'draft'
            AND e.starts_at IS NOT NULL
            AND e.starts_at <= CURRENT_TIMESTAMP
            AND (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id) > 0
          )
        )
      RETURNING id, status`);
    return rows;
  },

  async countCandidates(electionId) {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM candidates WHERE election_id = $1',
      [electionId]
    );
    return rows[0].total;
  },

  async addCandidate(electionId, { name, description }) {
    const { rows } = await pool.query(
      'INSERT INTO candidates (election_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [electionId, name, description || null]);
    return rows[0];
  },

  async results(electionId) {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.description, COUNT(v.id)::int AS votes
      FROM candidates c LEFT JOIN votes v ON v.candidate_id = c.id
      WHERE c.election_id = $1 GROUP BY c.id ORDER BY c.id`, [electionId]);
    const total = rows.reduce((s, r) => s + r.votes, 0);
    return { total, candidates: rows };
  },

  async hasVoted(electionId, userId) {
    const { rows } = await pool.query(
      'SELECT 1 FROM voter_participation WHERE election_id = $1 AND user_id = $2', [electionId, userId]);
    return rows.length > 0;
  },
};

module.exports = ElectionModel;
