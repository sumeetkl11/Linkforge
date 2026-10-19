import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getCallbackUrl } from '../config/passport.js';

const SEEDED_USER_IDS = new Set(['u1', 'u2', 'u3', 'u4', 'u5']);

export function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export default function createAuthRoutes({
  pool,
  isPostgres,
  getMemoryStore,
  getActiveEmailBan,
  getBanLoginError,
  pushDashboardStats,
  getJwtSecret,
}) {
  const router = Router();

  function getFrontendUrl() {
    const appUrl = (process.env.APP_URL || '').replace(/[\r\n]+/g, '').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
    const rawFrontend = (process.env.FRONTEND_URL || '').replace(/[\r\n]+/g, '').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
    if (appUrl && (!rawFrontend || /^https?:\/\/localhost(:\d+)?/i.test(rawFrontend))) {
      return appUrl;
    }
    return rawFrontend;
  }

  function sendOAuthPopupOrRedirectError(res, message) {
    const frontendUrl = getFrontendUrl();
    const fallbackUrl = `${frontendUrl}/?auth_error=${encodeURIComponent(message)}`;
    res.send(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Authentication Error</title></head>
  <body style="background:#0b141c;color:#dae3ee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(message)} }, '*');
        window.close();
      } else {
        window.location.href = ${JSON.stringify(fallbackUrl)};
      }
    </script>
    <p>${message}</p>
  </body>
</html>`);
  }

  function sendOAuthPopupOrRedirectSuccess(res, token, user) {
    const frontendUrl = getFrontendUrl();
    const fallbackUrl = `${frontendUrl}/?token=${encodeURIComponent(token)}`;
    res.send(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Authentication Successful</title></head>
  <body style="background:#0b141c;color:#dae3ee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <script>
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_AUTH_SUCCESS',
          token: ${JSON.stringify(token)},
          user: ${JSON.stringify(sanitizeUser(user))}
        }, '*');
        window.close();
      } else {
        window.location.href = ${JSON.stringify(fallbackUrl)};
      }
    </script>
    <p>Authentication successful. Closing window...</p>
  </body>
</html>`);
  }

  function oauthCallback(provider) {
    return [
      (req, res, next) => {
        passport.authenticate(provider, { session: false }, (err, user) => {
          if (err) {
            return sendOAuthPopupOrRedirectError(res, err.message || 'Authentication failed');
          }
          if (!user) {
            return sendOAuthPopupOrRedirectError(res, 'Authentication failed');
          }
          req.user = user;
          return next();
        })(req, res, next);
      },
      (req, res, next) => {
        try {
          const user = req.user;
          const token = jwt.sign(
            { id: user.id },
            getJwtSecret(),
            { expiresIn: '7d' }
          );

          return sendOAuthPopupOrRedirectSuccess(res, token, user);
        } catch (err) {
          next(err);
        }
      }
    ];
  }

  // --- Password-verified Register: POST /api/auth/register ---
  router.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'A valid developer email is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Security token (password) must be at least 6 characters.' });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const activeBan = await getActiveEmailBan(cleanEmail);
      if (activeBan) {
        return res.status(403).json(getBanLoginError(activeBan));
      }

      const username = cleanEmail.split('@')[0];
      const displayName = (name && String(name).trim()) || (username.charAt(0).toUpperCase() + username.slice(1));
      const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
      const passwordHash = await bcrypt.hash(password, 10);
      const id = `u-${Date.now()}`;

      let createdUser = null;

      if (!isPostgres()) {
        const store = getMemoryStore();
        const existing = store.users.find(u => u.email.toLowerCase() === cleanEmail);
        if (existing) {
          // If already exists, verify or update password so Sign Up works smoothly
          const matches = existing.password_hash ? await bcrypt.compare(password, existing.password_hash) : true;
          if (!matches && !SEEDED_USER_IDS.has(existing.id)) {
            return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
          }
          existing.password_hash = passwordHash;
          if (name && String(name).trim()) existing.name = String(name).trim();
          const token = jwt.sign({ id: existing.id }, getJwtSecret(), { expiresIn: '7d' });
          return res.status(200).json({ user: sanitizeUser(existing), token });
        }
        createdUser = {
          id,
          name: displayName,
          email: cleanEmail,
          role: 'Developer',
          status: 'Online',
          avatar,
          avatar_url: avatar,
          username,
          commits: 0,
          reviews: 0,
          proficiency: 0,
          password_hash: passwordHash
        };
        store.users.push(createdUser);
      } else {
        const existingRes = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        if (existingRes.rows.length > 0) {
          const existing = existingRes.rows[0];
          const matches = existing.password_hash ? await bcrypt.compare(password, existing.password_hash) : true;
          if (!matches && !SEEDED_USER_IDS.has(existing.id)) {
            return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
          }
          const updatedRes = await pool.query(
            'UPDATE users SET password_hash = $1, name = COALESCE($2, name) WHERE id = $3 RETURNING *',
            [passwordHash, (name && String(name).trim()) || null, existing.id]
          );
          const token = jwt.sign({ id: existing.id }, getJwtSecret(), { expiresIn: '7d' });
          return res.status(200).json({ user: sanitizeUser(updatedRes.rows[0]), token });
        }
        const insertRes = await pool.query(
          `INSERT INTO users (id, name, email, role, status, avatar, avatar_url, username, commits, reviews, proficiency, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, $9)
           RETURNING *`,
          [id, displayName, cleanEmail, 'Developer', 'Online', avatar, avatar, username, passwordHash]
        );
        createdUser = insertRes.rows[0];
      }

      if (typeof pushDashboardStats === 'function') {
        pushDashboardStats();
      }

      const token = jwt.sign({ id: createdUser.id }, getJwtSecret(), { expiresIn: '7d' });
      return res.status(201).json({ user: sanitizeUser(createdUser), token });
    } catch (err) {
      console.error('Error in /api/auth/register:', err);
      return res.status(500).json({ error: err.message || 'Registration failed.' });
    }
  });

  // --- Password-verified Login: POST /api/auth/login ---
  async function handleLogin(req, res) {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const effectivePassword = (typeof password === 'string' && password.length > 0) ? password : 'syncforge123';

    try {
      const cleanEmail = email.trim().toLowerCase();
      const activeBan = await getActiveEmailBan(cleanEmail);
      if (activeBan) {
        return res.status(403).json(getBanLoginError(activeBan));
      }

      let user = null;
      if (!isPostgres()) {
        const store = getMemoryStore();
        user = store.users.find(u => u.email.toLowerCase() === cleanEmail);
      } else {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        user = result.rows[0] || null;
      }

      // If email does not exist yet, auto-provision the developer account with bcrypt password hash
      if (!user) {
        const username = cleanEmail.split('@')[0];
        const displayName = username
          .split(/[._-]/)
          .filter(Boolean)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ') || 'Developer';
        const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
        const passwordHash = await bcrypt.hash(effectivePassword, 10);
        const id = `u-${Date.now()}`;

        if (!isPostgres()) {
          const store = getMemoryStore();
          user = {
            id,
            name: displayName,
            email: cleanEmail,
            role: 'Developer',
            status: 'Online',
            avatar,
            avatar_url: avatar,
            username,
            commits: 0,
            reviews: 0,
            proficiency: 0,
            password_hash: passwordHash,
          };
          store.users.push(user);
        } else {
          const insertRes = await pool.query(
            `INSERT INTO users (id, name, email, role, status, avatar, avatar_url, username, commits, reviews, proficiency, password_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, 0, $9)
             RETURNING *`,
            [id, displayName, cleanEmail, 'Developer', 'Online', avatar, avatar, username, passwordHash]
          );
          user = insertRes.rows[0];
        }

        if (typeof pushDashboardStats === 'function') {
          pushDashboardStats();
        }
      } else {
        let isPasswordValid = false;
        if (user.password_hash) {
          isPasswordValid = await bcrypt.compare(effectivePassword, user.password_hash);
          // Allow seeded demo accounts (u1..u5) or legacy syncforge123-initialized rows to log in and adopt the user's password
          if (!isPasswordValid && SEEDED_USER_IDS.has(user.id)) {
            isPasswordValid = true;
          } else if (!isPasswordValid) {
            const wasDefaultSeedHash = await bcrypt.compare('syncforge123', user.password_hash);
            if (wasDefaultSeedHash) {
              const upgradedHash = await bcrypt.hash(effectivePassword, 10);
              user.password_hash = upgradedHash;
              if (isPostgres()) {
                await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [upgradedHash, user.id]);
              }
              isPasswordValid = true;
            }
          }
        } else {
          const upgradedHash = await bcrypt.hash(effectivePassword, 10);
          user.password_hash = upgradedHash;
          if (isPostgres()) {
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [upgradedHash, user.id]);
          }
          isPasswordValid = true;
        }

        if (!isPasswordValid) {
          return res.status(401).json({
            error: 'Invalid password for this account. Please enter the password you registered with.'
          });
        }
      }

      const token = jwt.sign(
        { id: user.id },
        getJwtSecret(),
        { expiresIn: '7d' }
      );
      return res.json({ user: sanitizeUser(user), token });
    } catch (err) {
      console.error('Error in /api/auth/login:', err);
      return res.status(500).json({ error: err.message || 'Authentication failed.' });
    }
  }

  router.post('/api/auth/login', handleLogin);
  router.post('/api/login', handleLogin);

  // --- Popup-friendly OAuth URL endpoints for AI Studio iframe ---
  router.get('/api/auth/google/url', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.replace(/[\r\n]+/g, '').trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.replace(/[\r\n]+/g, '').trim();
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: 'Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured on the server. Use email & password login or Quick Demo Login below.'
      });
    }
    const redirectUri = getCallbackUrl('google');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'profile email',
      access_type: 'online',
      prompt: 'select_account'
    });
    return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  router.get('/api/auth/github/url', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.replace(/[\r\n]+/g, '').trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.replace(/[\r\n]+/g, '').trim();
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: 'GitHub OAuth credentials (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) are not configured on the server. Use email & password login or Quick Demo Login below.'
      });
    }
    const redirectUri = getCallbackUrl('github');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'user:email'
    });
    return res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  });

  // --- Google OAuth ---
  router.get('/api/auth/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
      return sendOAuthPopupOrRedirectError(res, 'Google OAuth credentials are not configured. Please sign in with email and password.');
    }
    return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
  });

  router.get(
    ['/api/auth/google/callback', '/api/auth/google/callback/'],
    ...oauthCallback('google')
  );

  // --- GitHub OAuth ---
  router.get('/api/auth/github', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID?.trim() || !process.env.GITHUB_CLIENT_SECRET?.trim()) {
      return sendOAuthPopupOrRedirectError(res, 'GitHub OAuth credentials are not configured. Please sign in with email and password.');
    }
    return passport.authenticate('github', { scope: ['user:email'], session: false })(req, res, next);
  });

  router.get(
    ['/api/auth/github/callback', '/api/auth/github/callback/'],
    ...oauthCallback('github')
  );

  return router;
}
