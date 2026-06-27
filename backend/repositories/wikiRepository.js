import { pool } from '../db/pool.js';

export class WikiRepository {
  static async getAll() {
    const result = await pool.query(
      `SELECT id, title, content, parent_id as "parentId", updated_at as "updatedAt", updated_by as "updatedBy"
       FROM wiki_pages ORDER BY title ASC`
    );
    return result.rows;
  }

  static async getById(id) {
    const result = await pool.query(
      `SELECT id, title, content, parent_id as "parentId", updated_at as "updatedAt", updated_by as "updatedBy"
       FROM wiki_pages WHERE id = $1`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async upsert({ id, title, content, parentId, updatedAt, updatedBy }) {
    await pool.query(
      `INSERT INTO wiki_pages (id, title, content, parent_id, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         parent_id = EXCLUDED.parent_id,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
      [id, title, content || '', parentId || null, updatedAt || 'Just now', updatedBy || 'Unknown']
    );
  }

  static async delete(id) {
    await pool.query('DELETE FROM wiki_pages WHERE id = $1', [id]);
  }
}
