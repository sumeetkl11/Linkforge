import { pool } from '../db/pool.js';

export class TaskRepository {
  static async getAll() {
    const result = await pool.query(
      `SELECT id, title, description, priority, status, assignee, due_date as "dueDate",
              comments_count as "commentsCount", attachments_count as "attachmentsCount", tags, comments
       FROM tasks ORDER BY id DESC`
    );
    return result.rows;
  }

  static async getById(id) {
    const res = await pool.query(
      `SELECT id, title, description, priority, status, assignee, due_date as "dueDate",
              comments_count as "commentsCount", attachments_count as "attachmentsCount", tags, comments
       FROM tasks WHERE id = $1`,
      [id]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  static async create(task) {
    await pool.query(
      `INSERT INTO tasks (id, title, description, priority, status, assignee, due_date, comments_count, attachments_count, tags, comments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        task.id,
        task.title,
        task.description,
        task.priority,
        task.status,
        JSON.stringify(task.assignee),
        task.dueDate,
        task.commentsCount,
        task.attachmentsCount,
        JSON.stringify(task.tags || []),
        JSON.stringify(task.comments || [])
      ]
    );
  }

  static async update(id, task) {
    await pool.query(
      `UPDATE tasks SET
        title = $1, description = $2, priority = $3, status = $4, assignee = $5,
        due_date = $6, comments_count = $7, attachments_count = $8, tags = $9, comments = $10
       WHERE id = $11`,
      [
        task.title,
        task.description,
        task.priority,
        task.status,
        JSON.stringify(task.assignee),
        task.dueDate,
        task.commentsCount,
        task.attachmentsCount,
        JSON.stringify(task.tags),
        JSON.stringify(task.comments),
        id
      ]
    );
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  static async getOpenCount() {
    const res = await pool.query("SELECT COUNT(*) FROM tasks WHERE status != 'Done'");
    return parseInt(res.rows[0].count);
  }
}
