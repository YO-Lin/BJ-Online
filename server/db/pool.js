import pg from 'pg';

const { Pool } = pg;

// Zeabur's Postgres add-on injects POSTGRES_CONNECTION_STRING (not DATABASE_URL),
// so accept either name depending on the hosting environment.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_CONNECTION_STRING ||
  process.env.POSTGRES_URI;

export const pool = new Pool({ connectionString });
