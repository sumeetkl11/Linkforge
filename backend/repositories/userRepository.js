import { pool } from '../db/pool.js';
import { CONSTANTS } from '../config/constants.js';

export class UserRepository {
  static async getById(id) {
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  static async getByEmail(email) {
    const res = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  static async createUser({ id, name, email, passwordHash, username, avatar }) {
    const result = await pool.query(
      `INSERT INTO users (id, name, email, role, status, avatar, username, avatar_url, password, commits, reviews, proficiency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        name,
        email.trim().toLowerCase(),
        CONSTANTS.USER_ROLE.DEVELOPER,
        CONSTANTS.USER_STATUS.ONLINE,
        avatar,
        username,
        avatar,
        passwordHash,
        0, 0, 0
      ]
    );
    return result.rows[0];
  }

  static async upsertOAuthUser({ providerIdName, providerId, email, name, username, avatarUrl, fallbackId }) {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check by email
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    
    if (res.rows.length > 0) {
      const user = res.rows[0];
      if (!user[providerIdName] || !user.avatar_url || !user.username) {
        const updateRes = await pool.query(
          `UPDATE users
           SET ${providerIdName} = COALESCE(${providerIdName}, $1),
               avatar_url = COALESCE(avatar_url, $2),
               username = COALESCE(username, $3),
               avatar = COALESCE(avatar, $2)
           WHERE email = $4
           RETURNING *`,
          [providerId, avatarUrl, username, normalizedEmail]
        );
        return updateRes.rows[0];
      }
      return user;
    }

    // Insert new user
    const insertRes = await pool.query(
      `INSERT INTO users (id, name, email, ${providerIdName}, username, avatar_url, avatar, role, status, commits, reviews, proficiency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        fallbackId,
        name,
        normalizedEmail,
        providerId,
        username,
        avatarUrl,
        avatarUrl,
        CONSTANTS.USER_ROLE.DEVELOPER,
        CONSTANTS.USER_STATUS.ONLINE,
        0, 0, 0
      ]
    );
    return insertRes.rows[0];
  }

  static async updateUser(user) {
    const result = await pool.query(
      `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         status = EXCLUDED.status,
         avatar = EXCLUDED.avatar,
         google_id = COALESCE(users.google_id, EXCLUDED.google_id),
         github_id = COALESCE(users.github_id, EXCLUDED.github_id),
         username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url,
         commits = EXCLUDED.commits,
         reviews = EXCLUDED.reviews,
         proficiency = EXCLUDED.proficiency
       RETURNING *`,
      [
        user.id,
        user.name,
        user.email,
        user.role,
        user.status,
        user.avatar,
        user.google_id || null,
        user.github_id || null,
        user.username || user.email.split('@')[0],
        user.avatar_url || user.avatar || '',
        user.commits || 0,
        user.reviews || 0,
        user.proficiency || 0
      ]
    );
    return result.rows[0];
  }

  static async updateAvatar(id, avatarUrl) {
    await pool.query(
      'UPDATE users SET avatar = $1, avatar_url = $2 WHERE id = $3',
      [avatarUrl, avatarUrl, id]
    );
  }

  static async getAll(excludeId) {
    let query = 'SELECT id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency FROM users';
    const params = [];
    if (excludeId) {
      query += ' WHERE id != $1';
      params.push(excludeId);
    }
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getCount() {
    const res = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(res.rows[0].count);
  }

  static async getOnlineCount() {
    const res = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'Online'");
    return parseInt(res.rows[0].count);
  }
}
