const pool = require('./db');
const bcrypt = require('bcryptjs');

// Agrega columnas aquí para que se creen automáticamente al arrancar.
// El ORDEN importa: las tablas con llaves foráneas van después de las que referencian.
const schema = [
  {
    table: 'users',
    create: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'voter',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'name',       def: 'VARCHAR(100) NOT NULL' },
      { name: 'email',      def: 'VARCHAR(150)' },
      { name: 'password',   def: 'VARCHAR(255) NOT NULL' },
      { name: 'role',       def: "VARCHAR(20) NOT NULL DEFAULT 'voter'" },
      { name: 'active',     def: 'BOOLEAN NOT NULL DEFAULT TRUE' },
      { name: 'created_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ],
  },
  {
    table: 'password_reset_tokens',
    create: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        token_hash CHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `,
    columns: [],
  },
  {
    table: 'elections',
    create: `
      CREATE TABLE IF NOT EXISTS elections (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'starts_at', def: 'TIMESTAMPTZ' },
      { name: 'ends_at', def: 'TIMESTAMPTZ' },
      { name: 'rules', def: 'TEXT' },
      { name: 'faq', def: 'TEXT' },
    ],
  },
  {
    table: 'admin_audit_log',
    create: `
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id BIGSERIAL PRIMARY KEY,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(80) NOT NULL,
        entity_type VARCHAR(40) NOT NULL,
        entity_id VARCHAR(80),
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [],
  },
  {
    table: 'election_notification_outbox',
    create: `
      CREATE TABLE IF NOT EXISTS election_notification_outbox (
        id SERIAL PRIMARY KEY,
        election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('opened', 'closing_soon', 'results')),
        status VARCHAR(12) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'sent')),
        recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        locked_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (election_id, event_type)
      )
    `,
    columns: [],
  },
  {
    table: 'candidates',
    create: `
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        description TEXT
      )
    `,
    columns: [],
  },
  {
    table: 'notifications',
    create: `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        audience VARCHAR(20),
        type VARCHAR(40) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [],
  },
  {
    // Registra QUIÉN votó, pero NO por quién (anonimato).
    // Sin timestamp a propósito, para que no se pueda correlacionar con votes.created_at.
    table: 'voter_participation',
    create: `
      CREATE TABLE IF NOT EXISTS voter_participation (
        election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (election_id, user_id)
      )
    `,
    columns: [],
  },
  {
    // Registra POR QUIÉN se votó, pero NO quién votó. Forma una cadena de hashes (auditoría).
    table: 'votes',
    create: `
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
        candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        receipt_hash CHAR(64) UNIQUE NOT NULL,
        prev_hash CHAR(64) NOT NULL,
        chain_hash CHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [],
  },
];

async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
  if (rows.length) {
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [ADMIN_EMAIL]);
    return;
  }
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ('Administrador', $1, $2, 'admin')",
    [ADMIN_EMAIL, hashed]
  );
  console.log(`Admin creado: ${ADMIN_EMAIL}`);
}

async function runMigrations() {
  for (const entry of schema) {
    await pool.query(entry.create);

    const { rows } = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      [entry.table]
    );
    const existing = rows.map((r) => r.column_name);

    for (const col of entry.columns) {
      if (!existing.includes(col.name)) {
        await pool.query(`ALTER TABLE ${entry.table} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def}`);
        console.log(`Columna añadida: ${entry.table}.${col.name}`);
      }
    }

    console.log(`Tabla lista: ${entry.table}`);
  }
  await pool.query('CREATE INDEX IF NOT EXISTS idx_votes_election ON votes(election_id, id)');
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_type_election
    ON notifications(user_id, type, election_id) WHERE user_id IS NOT NULL`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC, id DESC)');
  await seedAdmin();
}

module.exports = runMigrations;
