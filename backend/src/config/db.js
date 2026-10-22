const { Pool } = require('pg');
require('dotenv').config();

let poolConfig;
if (process.env.DATABASE_URL) {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslpassword', 'sslrootcert']) {
    databaseUrl.searchParams.delete(option);
  }
  poolConfig = {
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: true },
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Error en el pool de PostgreSQL:', err);
});

module.exports = pool;
