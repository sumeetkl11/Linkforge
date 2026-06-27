/**
 * Password hashing utilities (bcryptjs — pure JS, no native deps).
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * @param {string} plain
 * @returns {Promise<string>} hash
 */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
