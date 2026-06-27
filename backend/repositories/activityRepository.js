import { pool } from '../db/pool.js';

export class ActivityRepository {
  static async getRecent(limit = 50) {
    const result = await pool.query(
      `SELECT id, type, user_data as user, description, detail, timestamp
       FROM activities ORDER BY id DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  static async create({ id, type, user, description, detail, timestamp }) {
    await pool.query(
      `INSERT INTO activities (id, type, user_data, description, detail, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, type, JSON.stringify(user), description, detail || null, timestamp]
    );
  }

  static async trim(limit = 50) {
    await pool.query(`
      DELETE FROM activities
      WHERE ctid NOT IN (
        SELECT ctid FROM activities ORDER BY id DESC LIMIT $1
      )
    `, [limit]);
  }
}
