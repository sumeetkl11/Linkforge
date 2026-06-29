import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = Router();

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  return jwtSecret.trim();
}

function redirectWithAuthError(res, message) {
  const frontendUrl = getFrontendUrl();
  res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(message)}`);
}

function oauthCallback(provider) {
  return [
    (req, res, next) => {
      passport.authenticate(provider, { session: false }, (err, user) => {
        if (err) {
          return redirectWithAuthError(res, err.message || 'Authentication failed');
        }
        if (!user) {
          return redirectWithAuthError(res, 'Authentication failed');
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

        res.redirect(`${getFrontendUrl()}?token=${encodeURIComponent(token)}`);
      } catch (err) {
        next(err);
      }
    }
  ];
}

// --- Google OAuth ---
router.get(
  '/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/api/auth/google/callback',
  ...oauthCallback('google')
);

// --- GitHub OAuth ---
router.get(
  '/api/auth/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get(
  '/api/auth/github/callback',
  ...oauthCallback('github')
);

export default router;
