const pool = require('../config/db');

const ElectionModel = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT e.id, e.title, e.description, e.status, e.created_at,
             (SELECT COUNT(*)::int FROM votes v WHERE v.election_id = e.id) AS total_votes
      FROM elections e ORDER BY e.id DESC`);
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, title, description, status, created_at FROM elections WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create({ title, description }, userId) {
    const { rows } = await pool.query(
      'INSERT INTO elections (title, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [title, description || null, userId]);
    return rows[0];
  },

  async setStatus(id, status) {
    const { rows } = await pool.query(
      'UPDATE elections SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return rows[0] || null;
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
