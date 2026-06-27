import { config, isProduction } from '../config/env.js';
import { pool } from '../db/pool.js';
import { seedDatabase } from '../db/schema.js';
import { invalidateCache } from '../db/redis.js';
import { StatsService } from '../services/statsService.js';

export class SystemController {
  static async health(req, res) {
    let dbStatus = 'untested';
    let redisStatusDetail = 'untested';
    let isHealthy = true;

    try {
      await pool.query('SELECT 1;');
      dbStatus = 'healthy';
    } catch (err) {
      dbStatus = 'unhealthy';
      isHealthy = false;
      console.error('[Health Check] DB check failed:', err.message);
    }

    try {
      const { redisStatus } = await import('../db/redis.js');
      if (config.redisUrl) {
        if (redisStatus && redisStatus.isConnected) {
          redisStatusDetail = 'healthy';
        } else {
          redisStatusDetail = 'unhealthy';
          isHealthy = false;
        }
      } else {
        redisStatusDetail = 'disabled';
      }
    } catch (err) {
      redisStatusDetail = 'unhealthy';
      isHealthy = false;
      console.error('[Health Check] Redis check failed:', err.message);
    }

    if (isHealthy) {
      res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        env: config.env,
        db: dbStatus,
        redis: redisStatusDetail,
      });
    } else {
      res.status(500).json({
        status: 'error',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        env: config.env,
        db: dbStatus,
        redis: redisStatusDetail,
      });
    }
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
