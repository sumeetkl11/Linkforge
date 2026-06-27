import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { pool } from '../db/pool.js';
import { config } from './env.js';
import { hashPassword } from '../utils/password.js';

/**
 * Resolve-or-create a user from an OAuth profile.
 * Shared by both Google and GitHub strategies.
 *
 * @param {object} params  { providerIdName, providerId, email, name, username, avatarUrl }
 */
async function upsertOAuthUser({ providerIdName, providerId, email, name, username, avatarUrl }) {
  if (!email) {
    throw new Error('No email found in OAuth profile');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Look up by email first.
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);

  if (res.rows.length > 0) {
    const user = res.rows[0];
    // Backfill provider id / avatar / username if missing.
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

  // New user via OAuth.
  const id = `u-${Date.now()}`;
  const insertRes = await pool.query(
    `INSERT INTO users (id, name, email, ${providerIdName}, username, avatar_url, avatar, role, status, commits, reviews, proficiency)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [id, name, normalizedEmail, providerId, username, avatarUrl, avatarUrl, 'Developer', 'Online', 0, 0, 0]
  );
  return insertRes.rows[0];
}

// ── Google Strategy ────────────────────────────────────────────────────────
if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || '';
          const googleId = profile.id;
          const name = profile.displayName || profile.name?.givenName || 'Google User';
          const username = email ? email.split('@')[0] : `user_${googleId}`;
          const avatarUrl = profile.photos?.[0]?.value || '';

          const user = await upsertOAuthUser({
            providerIdName: 'google_id',
            providerId: googleId,
            email,
            name,
            username,
            avatarUrl,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[passport] Google OAuth disabled (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set).');
}

// ── GitHub Strategy ────────────────────────────────────────────────────────
if (config.github.clientId && config.github.clientSecret) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: config.github.clientId,
        clientSecret: config.github.clientSecret,
        callbackURL: config.github.callbackUrl,
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email =
            profile.emails?.[0]?.value ||
            (profile.username ? `${profile.username}@github.placeholder` : `${profile.id}@github.placeholder`);
          const githubId = profile.id;
          const name = profile.displayName || profile.username || 'GitHub User';
          const username = profile.username || `user_${githubId}`;
          const avatarUrl = profile.photos?.[0]?.value || profile._json?.avatar_url || '';

          const user = await upsertOAuthUser({
            providerIdName: 'github_id',
            providerId: githubId,
            email,
            name,
            username,
            avatarUrl,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[passport] GitHub OAuth disabled (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set).');
}
