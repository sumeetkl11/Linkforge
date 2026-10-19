import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

export function getCallbackUrl(provider) {
  const appUrl = (process.env.APP_URL || '').replace(/[\r\n]+/g, '').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
  const rawBackendUrl = (process.env.BACKEND_URL || '').replace(/[\r\n]+/g, '').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
  const baseUrl =
    appUrl && (!rawBackendUrl || /^https?:\/\/localhost(:\d+)?/i.test(rawBackendUrl))
      ? appUrl
      : (rawBackendUrl || appUrl || 'http://localhost:3000');

  const rawCallbackUrl = process.env[`${provider.toUpperCase()}_CALLBACK_URL`];

  if (rawCallbackUrl && rawCallbackUrl.trim()) {
    let cleaned = rawCallbackUrl.replace(/[\r\n]+/g, '').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');

    const isBaseLocalhost = /^https?:\/\/localhost(:\d+)?/i.test(baseUrl);
    const isCallbackLocalhost = /^https?:\/\/localhost(:\d+)?/i.test(cleaned);

    // If running in production (baseUrl is remote) and .env has localhost callback, use baseUrl
    if (!isBaseLocalhost && isCallbackLocalhost) {
      return `${baseUrl}/api/auth/${provider}/callback`;
    }

    if (provider === 'github' && cleaned.includes('/api/auth/google/callback')) {
      cleaned = cleaned.replace('/api/auth/google/callback', '/api/auth/github/callback');
    }
    if (!cleaned.endsWith(`/api/auth/${provider}/callback`)) {
      try {
        const parsed = new URL(cleaned);
        if (!parsed.pathname || parsed.pathname === '/') {
          cleaned = `${parsed.origin}/api/auth/${provider}/callback`;
        }
      } catch {
        // leave cleaned as-is if URL parsing fails
      }
    }
    return cleaned;
  }

  return `${baseUrl}/api/auth/${provider}/callback`;
}

export default function configurePassport({ pool, isPostgres, getMemoryUsers }) {
  async function isEmailBanned(email) {
    if (!email) return false;
    if (!isPostgres()) return false;
    try {
      const result = await pool.query(
        `SELECT 1 FROM banned_emails
         WHERE email = $1
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [email.trim().toLowerCase()]
      );
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  // 1. Google Strategy Config
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.replace(/[\r\n]+/g, '').trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.replace(/[\r\n]+/g, '').trim();

  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
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

            const cleanEmail = email.trim().toLowerCase();
            let user = null;

            if (isPostgres()) {
              const res = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
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
                    [googleId, avatarUrl, username, cleanEmail]
                  );
                  user = updateRes.rows[0];
                }
              } else {
                const id = `u-${Date.now()}`;
                const insertRes = await pool.query(
                  `INSERT INTO users (id, name, email, google_id, username, avatar_url, avatar, role, status, commits, reviews, proficiency) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
                   RETURNING *`,
                  [id, name, cleanEmail, googleId, username, avatarUrl, avatarUrl, 'Developer', 'Online', 0, 0, 0]
                );
                user = insertRes.rows[0];
              }
            } else if (typeof getMemoryUsers === 'function') {
              const memUsers = getMemoryUsers();
              user = memUsers.find(u => u.email.toLowerCase() === cleanEmail);
              if (!user) {
                user = {
                  id: `u-${Date.now()}`,
                  name,
                  email: cleanEmail,
                  google_id: googleId,
                  username,
                  avatar_url: avatarUrl,
                  avatar: avatarUrl,
                  role: 'Developer',
                  status: 'Online',
                  commits: 0,
                  reviews: 0,
                  proficiency: 0
                };
                memUsers.push(user);
              }
            } else {
              return done(new Error('Database not configured'));
            }

            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  } else {
    console.warn('[Passport] Google OAuth credentials not set — Google OAuth strategy disabled.');
  }

  // 2. GitHub Strategy Config
  const githubClientId = process.env.GITHUB_CLIENT_ID?.replace(/[\r\n]+/g, '').trim();
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.replace(/[\r\n]+/g, '').trim();

  if (githubClientId && githubClientSecret) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: githubClientId,
          clientSecret: githubClientSecret,
          callbackURL: getCallbackUrl('github'),
          scope: ['user:email']
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails && profile.emails[0]
              ? profile.emails[0].value
              : (profile.username ? `${profile.username}@github.placeholder` : `${profile.id}@github.placeholder`);
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

            const cleanEmail = email.trim().toLowerCase();
            let user = null;

            if (isPostgres()) {
              const res = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
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
                    [githubId, avatarUrl, username, cleanEmail]
                  );
                  user = updateRes.rows[0];
                }
              } else {
                const id = `u-${Date.now()}`;
                const insertRes = await pool.query(
                  `INSERT INTO users (id, name, email, github_id, username, avatar_url, avatar, role, status, commits, reviews, proficiency) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
                   RETURNING *`,
                  [id, name, cleanEmail, githubId, username, avatarUrl, avatarUrl, 'Developer', 'Online', 0, 0, 0]
                );
                user = insertRes.rows[0];
              }
            } else if (typeof getMemoryUsers === 'function') {
              const memUsers = getMemoryUsers();
              user = memUsers.find(u => u.email.toLowerCase() === cleanEmail);
              if (!user) {
                user = {
                  id: `u-${Date.now()}`,
                  name,
                  email: cleanEmail,
                  github_id: githubId,
                  username,
                  avatar_url: avatarUrl,
                  avatar: avatarUrl,
                  role: 'Developer',
                  status: 'Online',
                  commits: 0,
                  reviews: 0,
                  proficiency: 0
                };
                memUsers.push(user);
              }
            } else {
              return done(new Error('Database not configured'));
            }

            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  } else {
    console.warn('[Passport] GitHub OAuth credentials not set — GitHub OAuth strategy disabled.');
  }
}
