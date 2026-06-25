import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = Router();

// --- Google OAuth ---
router.get(
  '/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key_123456';
    const token = jwt.sign(
      { id: user.id },
      jwtSecret,
      { expiresIn: '7d' }
    );
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?token=${token}`);
  }
);

// --- GitHub OAuth ---
router.get(
  '/api/auth/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get(
  '/api/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login', session: false }),
  (req, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key_123456';
    const token = jwt.sign(
      { id: user.id },
      jwtSecret,
      { expiresIn: '7d' }
    );
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?token=${token}`);
  }
);

export default router;
