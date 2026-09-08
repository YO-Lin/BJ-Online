import { pool } from './pool.js';

export const DEFAULT_STARTING_BALANCE = 1000;
export const MIN_STARTING_BALANCE = 100;
export const MAX_STARTING_BALANCE = 1_000_000;

export async function findByNickname(nickname) {
  const { rows } = await pool.query('SELECT * FROM users WHERE nickname = $1', [nickname]);
  return rows[0] || null;
}

export async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createUser(nickname, passwordHash, startingBalance = DEFAULT_STARTING_BALANCE) {
  const { rows } = await pool.query(
    'INSERT INTO users (nickname, password_hash, chip_balance) VALUES ($1, $2, $3) RETURNING *',
    [nickname, passwordHash, startingBalance]
  );
  return rows[0];
}

// Applies a signed delta to a user's chip balance transactionally and returns the new balance.
export async function applyChipDelta(userId, delta) {
  const { rows } = await pool.query(
    'UPDATE users SET chip_balance = chip_balance + $2, updated_at = now() WHERE id = $1 RETURNING chip_balance',
    [userId, delta]
  );
  return rows[0]?.chip_balance;
}
