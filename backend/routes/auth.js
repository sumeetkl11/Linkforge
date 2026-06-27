import { Router } from 'express';
import passport from 'passport';
import { config } from '../config/env.js';
import { signToken } from '../utils/jwt.js';

const router = Router();

/**
 * Shared OAuth callback handler — mints a JWT and redirects to the frontend
 * with the token appended to the URL hash (not query string, to avoid leakage
 * via Referer headers / server logs).
 *
 * NOTE: The frontend reads `#token=...` on boot.
 */
function oauthCallback(req, res) {
  const user = req.user;
  if (!user) {
    return res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
  }

  const token = signToken({ id: user.id, email: user.email });

  // Redirect with the token in the URL fragment so it never reaches a server
  // log or Referer header. The SPA reads it via window.location.hash.
  res.redirect(`${config.frontendUrl}/#token=${token}`);
}

// --- Google OAuth ---
router.get(
  '/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  oauthCallback
);

// --- GitHub OAuth ---
router.get(
  '/api/auth/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get(
  '/api/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login', session: false }),
  oauthCallback
);

export default router;
