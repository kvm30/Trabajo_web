const pool = require('../config/db');

const ElectionModel = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT e.id, e.title, e.description,
             CASE
               WHEN e.status = 'closed' OR e.ends_at <= NOW() THEN 'closed'
               WHEN e.starts_at > NOW() THEN 'draft'
               WHEN e.starts_at IS NOT NULL AND EXISTS (
                 SELECT 1 FROM candidates c WHERE c.election_id = e.id
               ) THEN 'open'
               WHEN e.starts_at IS NOT NULL THEN 'draft'
               ELSE e.status
             END AS status,
             e.created_at, e.starts_at, e.ends_at,
             (SELECT COUNT(*)::int FROM votes v WHERE v.election_id = e.id) AS total_votes,
             (SELECT COUNT(*)::int FROM candidates c WHERE c.election_id = e.id) AS total_candidates,
             (SELECT COUNT(*)::int FROM voter_participation vp WHERE vp.election_id = e.id) AS participation_count,
             (SELECT COUNT(*)::int FROM users u WHERE u.role = 'voter') AS eligible_voters,
             (SELECT COALESCE(
               json_agg(json_build_object(
                 'id', candidate_results.id,
                 'name', candidate_results.name,
                 'votes', candidate_results.votes
               ) ORDER BY candidate_results.id),
               '[]'::json
             )
             FROM (
               SELECT c.id, c.name, COUNT(v.id)::int AS votes
               FROM candidates c
               LEFT JOIN votes v ON v.candidate_id = c.id
               WHERE c.election_id = e.id
               GROUP BY c.id
             ) AS candidate_results) AS candidates
      FROM elections e ORDER BY e.id DESC`);
    return rows.map((row) => ({
      ...row,
      participation_rate: row.eligible_voters
        ? Math.round((row.participation_count / row.eligible_voters) * 10000) / 100
        : 0,
    }));
  },

  async participationSummary() {
    const { rows } = await pool.query(`
      SELECT e.id, e.title, e.status, e.starts_at, e.ends_at,
             (SELECT COUNT(*)::int FROM votes v WHERE v.election_id = e.id) AS total_votes,
             (SELECT COUNT(*)::int FROM voter_participation vp WHERE vp.election_id = e.id) AS participation_count,
             (SELECT COUNT(*)::int FROM users u WHERE u.role = 'voter') AS eligible_voters
      FROM elections e
      ORDER BY e.id DESC`);
    const elections = rows.map((row) => ({
      ...row,
      participation_rate: row.eligible_voters
        ? Math.round((row.participation_count / row.eligible_voters) * 10000) / 100
        : 0,
    }));
    const participationCount = elections.reduce((total, election) => total + election.participation_count, 0);
    const eligibleVotes = elections.reduce((total, election) => total + election.eligible_voters, 0);
    return {
      election_count: elections.length,
      total_votes: elections.reduce((total, election) => total + election.total_votes, 0),
      participation_count: participationCount,
      eligible_votes: eligibleVotes,
      participation_rate: eligibleVotes
        ? Math.round((participationCount / eligibleVotes) * 10000) / 100
        : 0,
      elections,
    };
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.description,
              CASE
                WHEN e.status = 'closed' OR e.ends_at <= NOW() THEN 'closed'
                WHEN e.starts_at > NOW() THEN 'draft'
                WHEN e.starts_at IS NOT NULL AND EXISTS (
                  SELECT 1 FROM candidates c WHERE c.election_id = e.id
                ) THEN 'open'
                WHEN e.starts_at IS NOT NULL THEN 'draft'
                ELSE e.status
              END AS status,
              e.created_at, e.starts_at, e.ends_at
       FROM elections e WHERE e.id = $1`, [id]);
    return rows[0] || null;
  },

  async create({ title, description, starts_at: startsAt, ends_at: endsAt }, userId) {
    const { rows } = await pool.query(
      `INSERT INTO elections (title, description, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || null, startsAt || null, endsAt || null, userId]);
    return rows[0];
  },

  async setSchedule(id, startsAt, endsAt) {
    const { rows } = await pool.query(
      `UPDATE elections
       SET starts_at = $2, ends_at = $3
       WHERE id = $1 AND status = 'draft'
         AND NOT EXISTS (SELECT 1 FROM votes WHERE election_id = $1)
       RETURNING *`,
      [id, startsAt, endsAt]);
    return rows[0] || null;
  },

  async setStatus(id, status) {
    const { rows } = await pool.query(
      'UPDATE elections SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return rows[0] || null;
  },

  async refreshScheduledStatuses() {
    const opened = await pool.query(
      `UPDATE elections SET status = 'open'
       WHERE status = 'draft' AND starts_at IS NOT NULL AND starts_at <= NOW()
         AND (ends_at IS NULL OR ends_at > NOW())
         AND EXISTS (SELECT 1 FROM candidates c WHERE c.election_id = elections.id)
       RETURNING id`);
    const closed = await pool.query(
      `UPDATE elections SET status = 'closed'
       WHERE status IN ('draft', 'open') AND ends_at IS NOT NULL AND ends_at <= NOW()
       RETURNING id`);
    return [...opened.rows, ...closed.rows].map((row) => row.id);
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
