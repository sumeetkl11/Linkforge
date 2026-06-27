/**
 * Authentication middleware for Express routes.
 *
 * Usage:
 *   import { requireAuth, optionalAuth } from '../middleware/auth.js';
 *
 *   app.get('/api/tasks',        requireAuth, handler);
 *   app.get('/api/public-info',  optionalAuth, handler);
 */
import { verifyToken } from '../utils/jwt.js';

/**
 * Enforce a valid JWT in the Authorization header.
 * Sets `req.user` to the decoded payload or returns 401.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Parse JWT if present but do NOT reject unauthenticated requests.
 * Sets `req.user` when a valid token is found.
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = verifyToken(token);
    } catch {
      // silently ignore invalid tokens for optional routes
    }
  }
  next();
}
