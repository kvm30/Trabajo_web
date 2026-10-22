const pool = require('../config/db');
const { sendElectionNotificationEmail } = require('../utils/email');

const notificationDetails = {
  opened: {
    subject: (title) => `La elección ya está abierta: ${title}`,
    message: (title, url) => `La elección "${title}" ya está abierta. Puedes participar desde: ${url}`,
  },
  closing_soon: {
    subject: (title) => `La elección cierra en una hora: ${title}`,
    message: (title, url, election) => (
      `La elección "${title}" cerrará a las ${new Date(election.ends_at).toLocaleString('es')}. `
      + `Consulta la elección: ${url}`
    ),
  },
  results: {
    subject: (title) => `Resultados publicados: ${title}`,
    message: (title, url, election) => {
      const results = election.candidates
        .map((candidate) => `${candidate.name}: ${candidate.votes} votos`)
        .join('\n');
      return `Resultados de "${title}" (${election.total_votes} votos):\n${results || 'Sin votos'}\n\n${url}`;
    },
  },
};

const NotificationModel = {
  async enqueue(electionId, eventType) {
    if (!notificationDetails[eventType]) {
      throw new Error(`Tipo de notificación no válido: ${eventType}`);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const election = await client.query('SELECT id FROM elections WHERE id = $1', [electionId]);
      if (!election.rows.length) {
        await client.query('ROLLBACK');
        return false;
      }

      const participationFilter = eventType === 'opened'
        ? 'NOT EXISTS'
        : 'EXISTS';
      const { rows: recipientRows } = await client.query(
        `SELECT u.email
         FROM users u
         WHERE u.role = 'voter'
           AND u.email IS NOT NULL
           AND ${participationFilter} (
             SELECT 1 FROM voter_participation vp
             WHERE vp.user_id = u.id AND vp.election_id = $1
           )
         ORDER BY u.id`,
        [electionId]
      );
      const recipients = recipientRows.map((row) => row.email);
      await client.query(
        `INSERT INTO election_notification_outbox (election_id, event_type, recipients)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (election_id, event_type) DO NOTHING`,
        [electionId, eventType, JSON.stringify(recipients)]
      );
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async enqueueUpcomingClosures() {
    const { rows } = await pool.query(
      `SELECT id FROM elections
       WHERE status = 'open'
         AND ends_at > NOW()
         AND ends_at <= NOW() + INTERVAL '1 hour'`
    );
    for (const election of rows) {
      await this.enqueue(election.id, 'closing_soon');
    }
  },

  async claimNext() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE election_notification_outbox
         SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
         WHERE id = (
           SELECT id
           FROM election_notification_outbox
           WHERE (status = 'pending' AND available_at <= NOW())
              OR (status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes')
           ORDER BY id
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         RETURNING id, election_id, event_type, recipients`
      );
      await client.query('COMMIT');
      return rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getElectionMessage(electionId, eventType) {
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.ends_at,
              (SELECT COUNT(*)::int FROM votes v WHERE v.election_id = e.id) AS total_votes,
              (SELECT COALESCE(json_agg(json_build_object('name', c.name, 'votes', c.votes)
                ORDER BY c.id), '[]'::json)
               FROM (
                 SELECT candidates.id, candidates.name, COUNT(v.id)::int AS votes
                 FROM candidates
                 LEFT JOIN votes v ON v.candidate_id = candidates.id
                 WHERE candidates.election_id = e.id
                 GROUP BY candidates.id
               ) c) AS candidates
       FROM elections e WHERE e.id = $1`,
      [electionId]
    );
    const election = rows[0];
    if (!election) throw new Error(`No existe la elección ${electionId} para notificar`);

    const details = notificationDetails[eventType];
    if (!details) throw new Error(`Tipo de notificación no válido: ${eventType}`);
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const url = `${appUrl}/elections/${election.id}`;
    return {
      subject: details.subject(election.title),
      text: details.message(election.title, url, election),
    };
  },

  async markSent(id) {
    await pool.query(
      `UPDATE election_notification_outbox
       SET status = 'sent', recipients = '[]'::jsonb, sent_at = NOW(),
           locked_at = NULL, last_error = NULL
       WHERE id = $1`,
      [id]
    );
  },

  async scheduleRetry(id, attempts, error) {
    const retrySeconds = Math.min(60 * (2 ** Math.min(attempts - 1, 6)), 3600);
    await pool.query(
      `UPDATE election_notification_outbox
       SET status = 'pending', available_at = NOW() + ($2 * INTERVAL '1 second'),
           locked_at = NULL, last_error = $3
       WHERE id = $1`,
      [id, retrySeconds, String(error.message || error).slice(0, 1000)]
    );
  },

  async processPending(limit = 20) {
    for (let i = 0; i < limit; i += 1) {
      const notification = await this.claimNext();
      if (!notification) return;
      try {
        const recipients = notification.recipients || [];
        if (recipients.length) {
          const message = await this.getElectionMessage(notification.election_id, notification.event_type);
          await sendElectionNotificationEmail(recipients, message.subject, message.text);
        }
        await this.markSent(notification.id);
      } catch (err) {
        await this.scheduleRetry(notification.id, notification.attempts, err);
        console.error(`No se pudo enviar la notificación ${notification.id}; se reintentará:`, err.message);
      }
    }
  },
};

module.exports = NotificationModel;
