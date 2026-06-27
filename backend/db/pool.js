import pg from 'pg';
import { config, isProduction } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isProduction()
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const isPostgres = () => true;
