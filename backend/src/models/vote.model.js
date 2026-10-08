const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const { GENESIS, makeReceipt, chainHash } = require('../utils/crypto');

const VoteModel = {
  // Todo en UNA transacción: o se registra participación + voto + cadena, o nada.
  async cast({ electionId, candidateId, userId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serializa los votos de una misma elección para que la cadena de hashes no se bifurque.
      await client.query('SELECT pg_advisory_xact_lock($1)', [electionId]);

      const el = (await client.query('SELECT status FROM elections WHERE id = $1', [electionId])).rows[0];
      if (!el) throw new HttpError(404, 'Elección no encontrada');
      if (el.status !== 'open') throw new HttpError(400, 'La elección no está abierta');

      const cand = await client.query(
        'SELECT 1 FROM candidates WHERE id = $1 AND election_id = $2', [candidateId, electionId]);
      if (!cand.rows.length) throw new HttpError(400, 'Candidato inválido para esta elección');

      const part = await client.query(
        `INSERT INTO voter_participation (election_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING user_id`, [electionId, userId]);
      if (!part.rows.length) throw new HttpError(409, 'Ya votaste en esta elección');

      const last = await client.query(
        'SELECT chain_hash FROM votes WHERE election_id = $1 ORDER BY id DESC LIMIT 1', [electionId]);
      const prev = last.rows[0]?.chain_hash || GENESIS;
      const receipt = makeReceipt(electionId, candidateId);
      const chain = chainHash(prev, receipt, electionId, candidateId);

      // Nótese: aquí NO se guarda userId. El voto queda anónimo.
      const ins = await client.query(
        `INSERT INTO votes (election_id, candidate_id, receipt_hash, prev_hash, chain_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING created_at`,
        [electionId, candidateId, receipt, prev, chain]);
      const pos = (await client.query(
        'SELECT COUNT(*)::int AS n FROM votes WHERE election_id = $1', [electionId])).rows[0].n;

      await client.query('COMMIT');
      return { receipt_hash: receipt, chain_hash: chain, position: pos, created_at: ins.rows[0].created_at };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async verify(receiptHash) {
    const { rows } = await pool.query(`
      SELECT v.election_id, e.title AS election_title, v.chain_hash, v.created_at,
             (SELECT COUNT(*)::int FROM votes x WHERE x.election_id = v.election_id AND x.id <= v.id) AS position
      FROM votes v JOIN elections e ON e.id = v.election_id
      WHERE v.receipt_hash = $1`, [receiptHash]);
    return rows[0] || null;
  },

  // Lista pública de la cadena: comprobantes + hashes, sin ninguna identidad ni candidato.
  async chain(electionId) {
    const { rows } = await pool.query(
      `SELECT id, receipt_hash, prev_hash, chain_hash, created_at
       FROM votes WHERE election_id = $1 ORDER BY id`, [electionId]);
    return rows;
  },

  // Recalcula toda la cadena; si algún voto fue alterado/borrado/insertado, se detecta.
  async integrity(electionId) {
    const { rows } = await pool.query(
      `SELECT id, candidate_id, receipt_hash, prev_hash, chain_hash
       FROM votes WHERE election_id = $1 ORDER BY id`, [electionId]);
    let prev = GENESIS;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const expected = chainHash(prev, r.receipt_hash, electionId, r.candidate_id);
      if (r.prev_hash !== prev || r.chain_hash !== expected) {
        return { valid: false, checked: i, total: rows.length, broken_at_position: i + 1 };
      }
      prev = r.chain_hash;
    }
    return { valid: true, checked: rows.length, total: rows.length, head_hash: prev };
  },
};

module.exports = VoteModel;
