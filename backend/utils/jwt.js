/**
 * JWT token utilities — thin wrappers around jsonwebtoken.
 *
 * All signing/verifying goes through here so there's a single place
 * to audit and test.
 */
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Sign a new JWT containing `payload`.
 * @param {object} payload  — data to embed (e.g. { id, email })
 * @returns {string} signed JWT
 */
export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Verify a JWT and return the decoded payload.
 * Throws on expired / invalid / malformed tokens.
 * @param {string} token
 * @returns {object} decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
