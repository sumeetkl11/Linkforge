import { pool } from '../db/pool.js';

export class ChannelRepository {
  static async getAll() {
    const result = await pool.query('SELECT * FROM channels ORDER BY name ASC');
    return result.rows;
  }

  static async create({ id, name, description, workspaceId }) {
    const result = await pool.query(
      `INSERT INTO channels (id, name, description, workspace_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, workspace_id as "workspaceId"`,
      [id, name, description || '', workspaceId || 'w1']
    );
    return result.rows[0];
  }

  static async getCount() {
    const res = await pool.query('SELECT COUNT(*) FROM channels');
    return parseInt(res.rows[0].count);
  }
}
