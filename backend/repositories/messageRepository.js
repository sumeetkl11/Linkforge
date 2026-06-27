import { pool } from '../db/pool.js';

export class MessageRepository {
  static async getDMMessages(userId1, userId2) {
    const result = await pool.query(
      `SELECT id, user_data as user, content, timestamp, reactions, code_snippet as "codeSnippet", file_attachment as "fileAttachment", workspace_id as "workspaceId", receiver_id as "receiverId"
       FROM messages
       WHERE (user_data->>'id' = $1 AND receiver_id = $2) OR (user_data->>'id' = $2 AND receiver_id = $1)
       ORDER BY id ASC`,
      [userId1, userId2]
    );
    return result.rows;
  }

  static async getChannelOrWorkspaceMessages(chatId) {
    const result = await pool.query(
      `SELECT id, user_data as user, content, timestamp, reactions, code_snippet as "codeSnippet", file_attachment as "fileAttachment", workspace_id as "workspaceId", receiver_id as "receiverId"
       FROM messages
       WHERE channel_id = $1 OR workspace_id = $1
       ORDER BY id ASC`,
      [chatId]
    );
    return result.rows;
  }

  static async createMessage({ id, channelId, user, content, timestamp, reactions, codeSnippet, fileAttachment, workspaceId, receiverId }) {
    await pool.query(
      `INSERT INTO messages (id, channel_id, user_data, content, timestamp, reactions, code_snippet, file_attachment, workspace_id, receiver_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        receiverId ? null : (channelId || null),
        JSON.stringify(user),
        content,
        timestamp,
        JSON.stringify(reactions || []),
        codeSnippet || null,
        JSON.stringify(fileAttachment || null),
        receiverId ? null : (channelId || null),
        receiverId || null
      ]
    );
  }

  static async getCount() {
    const res = await pool.query('SELECT COUNT(*) FROM messages');
    return parseInt(res.rows[0].count);
  }
}
