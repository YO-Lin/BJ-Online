import { pool } from './pool.js';

export async function listEntries() {
  const { rows } = await pool.query('SELECT * FROM changelog_entries ORDER BY created_at DESC');
  return rows;
}

export async function addEntry(title, description) {
  const { rows } = await pool.query(
    'INSERT INTO changelog_entries (title, description) VALUES ($1, $2) RETURNING *',
    [title, description]
  );
  return rows[0];
}
