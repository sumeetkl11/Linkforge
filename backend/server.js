import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import passport from 'passport';
import { fileURLToPath } from 'url';
import session from 'express-session';

import { config, isProduction } from './config/env.js';
import { pool } from './db/pool.js';
import { connectRedis, redisClient, redisSubClient, redisStatus } from './db/redis.js';
import { initializeDatabase, seedDatabase } from './db/schema.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { verifyToken } from './utils/jwt.js';
import { StatsService } from './services/statsService.js';

// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import channelRoutes from './routes/channels.js';
import messageRoutes from './routes/messages.js';
import taskRoutes from './routes/tasks.js';
import activityRoutes from './routes/activities.js';
import wikiRoutes from './routes/wiki.js';
import systemRoutes from './routes/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Request logging
app.use(morgan(isProduction() ? 'combined' : 'dev'));
app.use(express.json());

// Session support for OAuth CSRF state verification
app.use(
  session({
    secret: config.jwtSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction(),
      sameSite: 'lax',
    },
  })
);

// Global rate limiter for API routes
app.use('/api', apiLimiter);

// Initialize HTTP and Socket.io Servers
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Expose io on app instance for services/controllers
app.set('io', io);

// Socket.io JWT authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
});

// Initialize Passport & strategies
app.use(passport.initialize());
import './config/passport.js';

// Register Routers
app.use(authRoutes);
app.use(userRoutes);
app.use(channelRoutes);
app.use(messageRoutes);
app.use(taskRoutes);
app.use(activityRoutes);
app.use(wikiRoutes);
app.use(systemRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Exception] Global handler caught:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      status
    }
  });
});

// ── Start Server and Services ───────────────────────────────────────────────
async function startServer() {
  await initializeDatabase(pool);
  await seedDatabase(pool, config.seedDefaultPassword);

  // Connect Redis and wire the adapter if available
  await connectRedis(() => {
    io.adapter(createAdapter(redisClient, redisSubClient));
    console.log('[Socket.io] Redis adapter wired — multi-instance broadcast enabled.');
  });

  if (isProduction()) {
    const distPath = path.join(__dirname, '../frontend/dist');
    app.use(express.static(distPath));
    app.get('*splat', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Socket.io room joins & presence tracking
  io.on('connection', (socket) => {
    console.log(`[Socket.io] 🟢 Client connected: ${socket.id} (user: ${socket.user?.id})`);

    StatsService.pushDashboardStats(io);

    socket.on('room:join', (channelId) => {
      socket.join(channelId);
      console.log(`[Socket.io] 📡 ${socket.id} joined channel room: ${channelId}`);
    });

    socket.on('user:join', (userId) => {
      const authUserId = socket.user?.id;
      if (!authUserId || authUserId !== userId) {
        console.warn(`[Socket.io] ⚠️ Rejected user:join. Socket user (${authUserId}) does not match requested userId (${userId})`);
        return;
      }
      socket.join(authUserId);
      console.log(`[Socket.io] 👤 ${socket.id} registered for user: ${authUserId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] 🔴 Client disconnected: ${socket.id} (${reason})`);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT} (${config.env})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use. Kill the old process first:\n   taskkill /F /IM node.exe\nThen restart with: npm run dev\n`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

startServer();

// ── Graceful Shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown initiated…`);

  server.close(async () => {
    console.log('HTTP server closed.');

    try {
      await pool.end();
      console.log('PostgreSQL pool drained.');
    } catch (err) {
      console.error('Error closing PostgreSQL pool:', err);
    }

    if (redisClient && redisStatus.isActive) {
      try {
        await redisClient.quit();
        if (redisSubClient) await redisSubClient.quit();
        console.log('Redis clients disconnected.');
      } catch (err) {
        console.error('Error closing Redis clients:', err);
      }
    }

    console.log('Shutdown complete. Goodbye.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out — forcing exit.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
