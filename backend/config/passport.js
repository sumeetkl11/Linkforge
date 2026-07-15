import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getCallbackUrl(provider) {
  const providerCallbackUrl = process.env[`${provider.toUpperCase()}_CALLBACK_URL`];
  if (providerCallbackUrl?.trim()) {
    return providerCallbackUrl.trim();
  }
  const backendUrl = (process.env.APP_URL);
  console.log(`Using default callback URL for ${providerCallbackUrl}: ${backendUrl}/api/auth/${provider}/callback`);
  return `${backendUrl}/api/auth/${provider}/callback`;
}

export default function configurePassport({ pool, isPostgres }) {
  async function isEmailBanned(email) {
    if (!isPostgres() || !email) return false;
    const result = await pool.query(
      `SELECT 1 FROM banned_emails
       WHERE email = $1
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    return result.rows.length > 0;
  }

  // 1. Google Strategy Config
  passport.use(
    new GoogleStrategy(
      {
        clientID: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
        callbackURL: getCallbackUrl('google'),
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
          const googleId = profile.id;
          const name = profile.displayName || profile.name?.givenName || 'Google User';
          const username = email ? email.split('@')[0] : `user_${googleId}`;
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }
          if (await isEmailBanned(email)) {
            return done(new Error('This email has been banned from this workspace.'));
          }

          let user = null;

          if (isPostgres()) {
            const res = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
            if (res.rows.length > 0) {
              user = res.rows[0];
              if (!user.google_id || !user.avatar_url || !user.username) {
                const updateRes = await pool.query(
                   `UPDATE users 
                    SET google_id = COALESCE(google_id, $1), 
                        avatar_url = COALESCE(avatar_url, $2),
                        username = COALESCE(username, $3),
                        avatar = COALESCE(avatar, $2)
                    WHERE email = $4 
                    RETURNING *`,
                  [googleId, avatarUrl, username, email.trim().toLowerCase()]
                );
                user = updateRes.rows[0];
              }
            } else {
              const id = `u-${Date.now()}`;
              const insertRes = await pool.query(
                `INSERT INTO users (id, name, email, google_id, username, avatar_url, avatar, role, status, commits, reviews, proficiency) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
                 RETURNING *`,
                [id, name, email.trim().toLowerCase(), googleId, username, avatarUrl, avatarUrl, 'Developer', 'Online', 0, 0, 0]
              );
              user = insertRes.rows[0];
            }
          } else {
            return done(new Error('PostgreSQL database not configured'));
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // 2. GitHub Strategy Config
  passport.use(
    new GitHubStrategy(
      {
        clientID: requireEnv('GITHUB_CLIENT_ID'),
        clientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
        callbackURL: getCallbackUrl('github'),
        scope: ['user:email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : (profile.username ? `${profile.username}@github.placeholder` : `${profile.id}@github.placeholder`);
          const githubId = profile.id;
          const name = profile.displayName || profile.username || 'GitHub User';
          const username = profile.username || `user_${githubId}`;
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : (profile._json?.avatar_url || '');

          if (!email) {
            return done(new Error('No email found in GitHub profile'));
          }
          if (await isEmailBanned(email)) {
            return done(new Error('This email has been banned from this workspace.'));
          }

          let user = null;

          if (isPostgres()) {
            const res = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
            if (res.rows.length > 0) {
              user = res.rows[0];
              if (!user.github_id || !user.avatar_url || !user.username) {
                const updateRes = await pool.query(
                  `UPDATE users 
                   SET github_id = COALESCE(github_id, $1), 
                       avatar_url = COALESCE(avatar_url, $2),
                       username = COALESCE(username, $3),
                       avatar = COALESCE(avatar, $2)
                   WHERE email = $4 
                   RETURNING *`,
                  [githubId, avatarUrl, username, email.trim().toLowerCase()]
                );
                user = updateRes.rows[0];
              }
            } else {
              const id = `u-${Date.now()}`;
              const insertRes = await pool.query(
                `INSERT INTO users (id, name, email, github_id, username, avatar_url, avatar, role, status, commits, reviews, proficiency) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
                 RETURNING *`,
                [id, name, email.trim().toLowerCase(), githubId, username, avatarUrl, avatarUrl, 'Developer', 'Online', 0, 0, 0]
              );
              user = insertRes.rows[0];
            }
          } else {
            return done(new Error('PostgreSQL database not configured'));
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}
