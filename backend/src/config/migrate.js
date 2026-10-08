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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'name',       def: 'VARCHAR(100) NOT NULL' },
      { name: 'email',      def: 'VARCHAR(150)' },
      { name: 'password',   def: 'VARCHAR(255) NOT NULL' },
      { name: 'role',       def: "VARCHAR(20) NOT NULL DEFAULT 'voter'" },
      { name: 'created_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ],
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
  await seedAdmin();
}

module.exports = runMigrations;
