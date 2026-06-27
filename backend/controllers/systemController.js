import { config, isProduction } from '../config/env.js';
import { pool } from '../db/pool.js';
import { seedDatabase } from '../db/schema.js';
import { invalidateCache } from '../db/redis.js';
import { StatsService } from '../services/statsService.js';

export class SystemController {
  static health(req, res) {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      env: config.env,
    });
  }

  static async reset(req, res) {
    if (isProduction()) {
      return res.status(403).json({ error: 'Database reset is disabled in production' });
    }

    const io = req.app.get('io');
    try {
      await pool.query('TRUNCATE TABLE messages, workspaces, users, channels, tasks, activities, wiki_pages RESTART IDENTITY CASCADE;');
      await seedDatabase(pool, config.seedDefaultPassword);
      await invalidateCache('syncforge:tasks');
      StatsService.pushDashboardStats(io);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}
