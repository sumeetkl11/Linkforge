/**
 * Centralized environment configuration & validation.
 *
 * Loads dotenv once and validates that every secret required to run SyncForge
 * safely is present. The app refuses to boot when a critical value is missing
 * rather than silently falling back to an insecure default.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from backend/.env (works in both dev and production layouts).
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const required = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `[config] Missing required environment variable "${name}". ` +
      `Copy backend/.env.example to backend/.env and fill it in.`
    );
  }
  return value.trim();
};

const optional = (name, fallback) => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
};

// Validate JWT secret strength.
const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error(
    '[config] JWT_SECRET must be at least 32 characters for HMAC-SHA256. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
}

const appUrl = optional('APP_URL', `http://localhost:${optional('PORT', '5000')}`);

// Helper to load an optional OAuth credential and warn if missing.
const oauthCred = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    // Don't throw — allow the server to boot in credential-only mode.
    return null;
  }
  return value.trim();
};

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),
  appUrl,

  // Database (PostgreSQL — Neon or otherwise)
  databaseUrl: required('DATABASE_URL'),

  // JWT
  jwtSecret,
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '7d'),

  // Frontend origin (used for CORS + OAuth redirects)
  frontendUrl: required('FRONTEND_URL'),

  // OAuth providers (optional — server boots without them; credential login still works).
  google: {
    clientId: oauthCred('GOOGLE_CLIENT_ID'),
    clientSecret: oauthCred('GOOGLE_CLIENT_SECRET'),
    callbackUrl: optional(
      'GOOGLE_CALLBACK_URL',
      `${appUrl}/api/auth/google/callback`
    ),
  },
  github: {
    clientId: oauthCred('GITHUB_CLIENT_ID'),
    clientSecret: oauthCred('GITHUB_CLIENT_SECRET'),
    callbackUrl: optional(
      'GITHUB_CALLBACK_URL',
      `${appUrl}/api/auth/github/callback`
    ),
  },

  // Optional services
  redisUrl: optional('REDIS_URL', '') || null,

  // Default password assigned to seeded demo users
  seedDefaultPassword: optional('SEED_DEFAULT_PASSWORD', 'syncforge123'),
};

export const isProduction = () => config.env === 'production';

// Log a summary of which optional services are enabled.
const oauthStatus = [
  config.google.clientId ? '\u2713 Google' : '\u2717 Google (GOOGLE_CLIENT_ID not set)',
  config.github.clientId ? '\u2713 GitHub' : '\u2717 GitHub (GITHUB_CLIENT_ID not set)',
].join(', ');
console.log(`[config] OAuth: ${oauthStatus}`);
if (config.redisUrl) console.log('[config] Redis: enabled');
else console.log('[config] Redis: disabled (REDIS_URL not set — caching off)');
