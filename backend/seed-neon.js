import { pool } from './db/pool.js';
import { initializeDatabase, seedDatabase } from './db/schema.js';
import { config } from './config/env.js';

async function run() {
  console.log('Connecting to PostgreSQL database...');
  try {
    console.log('Creating database tables if not exist...');
    await initializeDatabase(pool);
    console.log('Seeding initial values...');
    await seedDatabase(pool, config.seedDefaultPassword);
    console.log('\nDatabase setup completed successfully.');
    console.log(`Demo login: alex.r@syncforge.io / ${config.seedDefaultPassword}`);
  } catch (err) {
    console.error('Error during database setup:', err);
  } finally {
    await pool.end();
  }
}

run();
