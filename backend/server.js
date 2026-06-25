import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import passport from 'passport';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

// HTTP Server and Socket.io setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Redis Caching Client
const redisUrl = process.env.REDIS_URL;
const redisClient = redisUrl ? createClient({ url: redisUrl }) : null;
let isRedisActive = false;

if (redisClient) {
  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
    isRedisActive = false;
  });
  
  redisClient.connect()
    .then(() => {
      console.log('Connected to Redis Cache.');
      isRedisActive = true;
    })
    .catch((err) => {
      console.warn('Redis connection failed. Caching disabled:', err.message);
      isRedisActive = false;
    });
}

async function getCache(key) {
  if (!isRedisActive || !redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Redis read error:', err);
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 300) {
  if (!isRedisActive || !redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    console.error('Redis write error:', err);
  }
}

async function invalidateCache(key) {
  if (!isRedisActive || !redisClient) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error('Redis delete error:', err);
  }
}

// PostgreSQL Connection Pool Setup
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn("WARNING: DATABASE_URL is not set in environment variables! Please set it in backend/.env to use PostgreSQL.");
}

export const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : undefined
});

export const isPostgres = () => !!connectionString;

// Body parser
app.use(express.json());

// Initialize Passport and Register Auth Routes
app.use(passport.initialize());
import './config/passport.js';
import authRoutes from './routes/auth.js';
app.use(authRoutes);

// Real-Time Dashboard Stats Broadcaster
async function pushDashboardStats() {
  try {
    if (!isPostgres()) return;
    const usersRes = await pool.query('SELECT COUNT(*) FROM users');
    const activeUsers = parseInt(usersRes.rows[0].count).toLocaleString();

    const tasksRes = await pool.query("SELECT COUNT(*) FROM tasks WHERE status != 'Done'");
    const openTasks = parseInt(tasksRes.rows[0].count);

    const messagesRes = await pool.query('SELECT COUNT(*) FROM messages');
    const messageVolume = (parseInt(messagesRes.rows[0].count) / 1000).toFixed(1) + 'k';

    io.emit('dashboard_stats_update', {
      activeUsers,
      openTasks,
      messageVolume
    });
  } catch (err) {
    console.error('Failed to broadcast dashboard stats:', err);
  }
}

// Database Helper
async function initializeDatabase() {
  if (!isPostgres()) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        role VARCHAR(100),
        status VARCHAR(50),
        avatar TEXT,
        google_id VARCHAR(100),
        github_id VARCHAR(100),
        username VARCHAR(100),
        avatar_url TEXT,
        commits INT DEFAULT 0,
        reviews INT DEFAULT 0,
        proficiency INT DEFAULT 0
      );
      
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        workspace_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(50);
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(50) PRIMARY KEY,
        channel_id VARCHAR(50) REFERENCES channels(id) ON DELETE CASCADE,
        user_data JSONB NOT NULL,
        content TEXT,
        timestamp VARCHAR(50),
        reactions JSONB DEFAULT '[]'::jsonb,
        code_snippet TEXT,
        file_attachment JSONB DEFAULT 'null'::jsonb,
        workspace_id VARCHAR(50),
        receiver_id VARCHAR(50)
      );

      ALTER TABLE messages ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(50);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id VARCHAR(50);
      
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        priority VARCHAR(50),
        status VARCHAR(50),
        assignee JSONB,
        due_date VARCHAR(50),
        comments_count INT DEFAULT 0,
        attachments_count INT DEFAULT 0,
        tags JSONB DEFAULT '[]'::jsonb,
        comments JSONB DEFAULT '[]'::jsonb
      );
      
      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(50),
        user_data JSONB,
        description TEXT,
        detail TEXT,
        timestamp VARCHAR(50)
      );
 
      CREATE TABLE IF NOT EXISTS wiki_pages (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        parent_id VARCHAR(50),
        updated_at VARCHAR(50),
        updated_by VARCHAR(100)
      );
    `);
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

async function seedDatabase() {
  if (!isPostgres()) return;

  try {
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log("Database is empty. Seeding initial values...");
      
      const defaultUsers = [
        { id: 'u1', name: 'Alex Rivera', email: 'alex.r@syncforge.io', role: 'Lead Developer', status: 'Online', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktKD0ktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg', commits: 1284, reviews: 412, proficiency: 96, username: 'alex.r' },
        { id: 'u2', name: 'Jordan Vance', email: 'jordan.v@syncforge.io', role: 'Senior Developer', status: 'Online', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAV4tudKZHjnER1rdj7gwMGikfLAbBXXaBYtsLzVP8D-DGCsEJiaDr_jLkQgpt_BgwJ8mioxXRN3Ml-Zjg5v4W1GpkA64n4qi4Z0Gcy4dMOCgFQu9feVfDcD7wf9e9X1dD1eIGNf3QR2crYzeLSvbuSe6eA3d-kRS67x2j9lzoONa3ifuCgfaRIt4TazE2lXG-2pXc_w_Abbh2qLMMxNDGknSJlhQ27pAUekjZNZVf-uQknLhSEy0HstUV9cj0b-sG-lrm-hs8JoXY', commits: 924, reviews: 218, proficiency: 90, username: 'jordan.v' },
        { id: 'u3', name: 'Sarah Jenkins', email: 'sarah.j@syncforge.io', role: 'Lead Product Designer', status: 'Online', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDb_ef4eqGM796eehbJWOQ6jApqlbJnbIaz-6lBoqM7CNDsfKHRI7p1nDJKv8trzrG_VmwFLoKRslVMnKrC-EeK0gdZjo_HXOjXPAEnGdicLZgwWFU7AEKKI0sptebxF_gNJiW9gykpOn5UyJrLWv0wxQghtbiyAtzUX1py07gjeJDfq04fqonFK8aP5WFUImm2OrCoMnsis-85_1pl4Waseam-CmXkBTEAhHX9fFDvrHMOGr5Nqc8LqVn5B5wPX1dOlmGOeNwNcs', commits: 412, reviews: 842, proficiency: 95, username: 'sarah.j' },
        { id: 'u4', name: 'Arjun Mehta', email: 'arjun.m@syncforge.io', role: 'Lead Product Designer', status: 'Online', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhMDjDBgRUxiBNsF-VFcouC39c20SQMPrPMMungqgyN4xN4deC6bpCYiduJayCX6-1sdMWKADxnGgwlEXsL9LQ_tO6KamkGciPPqQ0Bzk2V4tlwemK2g71auU3SOfwpSpCwDVLEh_Tj_NKmzxHw7zqQRRO8NlAfHPai_tYcYBU6IKbLps9OjNsqO4LfxuEtcfuCpemvrBTAoVIhHlZXYcqQaYtM3A5ZfsbO9GN7BKQ3vgX2joEjvdEUUkkHktP_mkZWYNcW9pKHuA', commits: 1204, reviews: 482, proficiency: 94, username: 'arjun.m' },
        { id: 'u5', name: 'Chen Wei', email: 'wei.c@syncforge.io', role: 'Frontend Developer', status: 'Offline', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmyvkODuNXfEPYsN7ueEuuxIGuBQ-opzsxHwrz82j4rl0X9Bc11HaY3_Rrr0SKM-smT655NanGUB0f8Kehi8RgUq7mn--sLSivsBEYet2uP9Mr62rjhj4k6vselanskHDENHkfuUXCRMPUc_gZ1LkOvh08SZbfOwoOLGh4Q9PlymSzpSuVl9i7C-8zqxK2gQbdcDpj2PzjHrR9-LdtaJfdk6elkAw5aOMC4M1ARg9l9HSt0TJkeH4GKZ0AJAbc9-AtoR1vYz4ygEY', commits: 812, reviews: 204, proficiency: 88, username: 'wei.c' },
        { id: 'u6', name: 'Emma Larson', email: 'e.larson@syncforge.io', role: 'Backend Developer', status: 'Online', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpTGNjAHl-U2LMIfDUZbXqbsqcWrtfYRQKRG9LhdNiORyE7TXhfIMXxUGlWNaSa5OJvaBgsJnfnB0xL1VuTe_i3lGTSh4nq-N5pSjRkIReQ993dVejAWBBIeHWXELy4g5tCQDyH3fJQTVQCdSxFRjjNz4Mu5fH__70tSpdmqUQgBUy4JZRFystiSb6mebMda75gD7NXsF948RMwuWygRHSvhFYHj7ibALAnoRMQdkCXu_h2GzKZc_EakaK5kFtdKl7pTuX_1Hj_sE', commits: 1042, reviews: 310, proficiency: 91, username: 'e.larson' }
      ];

      for (const u of defaultUsers) {
        await pool.query(
          `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [u.id, u.name, u.email, u.role, u.status, u.avatar, null, null, u.username, u.avatar, u.commits, u.reviews, u.proficiency]
        );
      }

      const defaultChannels = [
        { id: 'c1', name: 'general', description: 'Central communication for the Forge project.' },
        { id: 'c2', name: 'engineering', description: 'Technical design reviews and compilation pipelines.' },
        { id: 'c3', name: 'design-system', description: 'Atmospheric UI theme guidelines, tokens, and components.' }
      ];

      for (const c of defaultChannels) {
        await pool.query(
          `INSERT INTO channels (id, name, description) VALUES ($1, $2, $3)`,
          [c.id, c.name, c.description]
        );
      }

      const defaultMessages = [
        {
          id: 'm1',
          channel_id: 'c1',
          user: defaultUsers[0],
          content: 'Just pushed the latest updates to the core authentication module. We need to review the session handling logic before the deploy.',
          timestamp: '10:42 AM',
          reactions: [{ emoji: '🚀', count: 3 }]
        },
        {
          id: 'm2',
          channel_id: 'c1',
          user: defaultUsers[1],
          content: 'I took a look at the middleware. Are we sure the token validation should happen here?',
          timestamp: '10:45 AM',
          codeSnippet: `export const validateToken = (req, res, next) => {\n  const token = req.headers['authorization'];\n  if (!token) return res.status(401).send();\n};`
        }
      ];

      for (const m of defaultMessages) {
        await pool.query(
          `INSERT INTO messages (id, channel_id, user_data, content, timestamp, reactions, code_snippet, workspace_id, receiver_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [m.id, m.channel_id, JSON.stringify(m.user), m.content, m.timestamp, JSON.stringify(m.reactions || []), m.codeSnippet || null, 'w1', null]
        );
      }

      const defaultTasks = [
        {
          id: 'SF-104',
          title: 'Implement WebGL Shader Backdrop',
          description: 'We need to integrate a high-performance WebGL shader for the dashboard background.',
          priority: 'High',
          status: 'In Progress',
          assignee: defaultUsers[3],
          dueDate: 'Oct 24, 2026',
          tags: ['Frontend', 'Backdrop']
        }
      ];

      for (const t of defaultTasks) {
        await pool.query(
          `INSERT INTO tasks (id, title, description, priority, status, assignee, due_date, tags) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [t.id, t.title, t.description, t.priority, t.status, JSON.stringify(t.assignee), t.dueDate, JSON.stringify(t.tags)]
        );
      }
      console.log("Database seeded successfully.");
    }
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

// REST API Endpoints

// --- Users ---
app.get('/api/users', async (req, res) => {
  const excludeId = req.query.exclude;
  try {
    let query = 'SELECT * FROM users';
    let params = [];
    if (excludeId) {
      query += ' WHERE id != $1';
      params.push(excludeId);
    }
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User credentials not found. Please use a seeded developer email (e.g. alex.r@syncforge.io).' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const newUser = req.body;
  if (!newUser.id) {
    newUser.id = `u-${Date.now()}`;
  }

  try {
    await pool.query(
      `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name, 
         email = EXCLUDED.email, 
         role = EXCLUDED.role, 
         status = EXCLUDED.status, 
         avatar = EXCLUDED.avatar, 
         google_id = COALESCE(users.google_id, EXCLUDED.google_id),
         github_id = COALESCE(users.github_id, EXCLUDED.github_id),
         username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url,
         commits = EXCLUDED.commits, 
         reviews = EXCLUDED.reviews, 
         proficiency = EXCLUDED.proficiency`,
      [
        newUser.id, 
        newUser.name, 
        newUser.email, 
        newUser.role, 
        newUser.status, 
        newUser.avatar, 
        newUser.google_id || null, 
        newUser.github_id || null, 
        newUser.username || newUser.email.split('@')[0], 
        newUser.avatar_url || newUser.avatar || '',
        newUser.commits || 0, 
        newUser.reviews || 0, 
        newUser.proficiency || 0
      ]
    );
    pushDashboardStats();
    res.json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/avatar', async (req, res) => {
  const id = req.params.id;
  const { avatarUrl } = req.body;
  if (!avatarUrl) {
    return res.status(400).json({ error: 'Missing avatarUrl' });
  }
  try {
    await pool.query(
      'UPDATE users SET avatar = $1, avatar_url = $2 WHERE id = $3',
      [avatarUrl, avatarUrl, id]
    );
    res.json({ success: true, avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Channels ---
app.get('/api/channels', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM channels ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/channels', async (req, res) => {
  const { name, description, workspaceId } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Channel name is required' });
  }
  const id = `c-${Date.now()}`;

  try {
    const result = await pool.query(
      `INSERT INTO channels (id, name, description, workspace_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, description, workspace_id as "workspaceId"`,
      [id, name, description || '', workspaceId || 'w1']
    );
    const createdChannel = result.rows[0];
    
    // Broadcast via socket.io
    if (io) {
      io.emit('channel_created', createdChannel);
    }

    res.json(createdChannel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Messages (with Channel vs DM routing support) ---
app.get('/api/messages/:chatId', async (req, res) => {
  const chatId = req.params.chatId;
  const { type, currentUserId } = req.query;

  try {
    let result;
    if (type === 'dm') {
      result = await pool.query(
        `SELECT id, user_data as user, content, timestamp, reactions, code_snippet as "codeSnippet", file_attachment as "fileAttachment", workspace_id as "workspaceId", receiver_id as "receiverId" 
         FROM messages 
         WHERE (user_data->>'id' = $1 AND receiver_id = $2) OR (user_data->>'id' = $2 AND receiver_id = $1) 
         ORDER BY id ASC`,
        [currentUserId, chatId]
      );
    } else {
      result = await pool.query(
        `SELECT id, user_data as user, content, timestamp, reactions, code_snippet as "codeSnippet", file_attachment as "fileAttachment", workspace_id as "workspaceId", receiver_id as "receiverId" 
         FROM messages 
         WHERE channel_id = $1 OR workspace_id = $1 
         ORDER BY id ASC`,
        [chatId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', async (req, res) => {
  const { channelId, message, receiverId } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message object' });
  }
  if (!message.id) {
    message.id = `msg-${Date.now()}`;
  }

  const senderId = message.user.id;

  try {
    await pool.query(
      `INSERT INTO messages (id, channel_id, user_data, content, timestamp, reactions, code_snippet, file_attachment, workspace_id, receiver_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        message.id,
        receiverId ? null : (channelId || null),
        JSON.stringify(message.user),
        message.content,
        message.timestamp,
        JSON.stringify(message.reactions || []),
        message.codeSnippet || null,
        JSON.stringify(message.fileAttachment || null),
        receiverId ? null : (channelId || null),
        receiverId || null
      ]
    );
    
    // Real-time broadcast
    if (io) {
      if (receiverId) {
        io.to(senderId).to(receiverId).emit('message:received', message);
      } else {
        io.to(channelId).emit('message:received', message);
      }
    }
    pushDashboardStats();
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Tasks ---
app.get('/api/tasks', async (req, res) => {
  const cacheKey = 'syncforge:tasks';
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const result = await pool.query(
      `SELECT id, title, description, priority, status, assignee, due_date as "dueDate", 
              comments_count as "commentsCount", attachments_count as "attachmentsCount", tags, comments 
       FROM tasks ORDER BY id DESC`
    );
    const tasks = result.rows;
    await setCache(cacheKey, tasks);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  const newTask = req.body;
  if (!newTask.id) {
    newTask.id = `SF-${Math.floor(100 + Math.random() * 9000)}`;
  }
  if (!newTask.comments) newTask.comments = [];
  if (!newTask.commentsCount) newTask.commentsCount = 0;
  if (!newTask.attachmentsCount) newTask.attachmentsCount = 0;

  await invalidateCache('syncforge:tasks');

  try {
    await pool.query(
      `INSERT INTO tasks (id, title, description, priority, status, assignee, due_date, comments_count, attachments_count, tags, comments) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newTask.id,
        newTask.title,
        newTask.description,
        newTask.priority,
        newTask.status,
        JSON.stringify(newTask.assignee),
        newTask.dueDate,
        newTask.commentsCount,
        newTask.attachmentsCount,
        JSON.stringify(newTask.tags || []),
        JSON.stringify(newTask.comments || [])
      ]
    );
    if (io) {
      io.emit('task:created', newTask);
    }
    pushDashboardStats();
    res.json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const updatedTask = req.body;

  await invalidateCache('syncforge:tasks');

  try {
    const exist = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (exist.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const existingTask = exist.rows[0];
    
    const title = updatedTask.title !== undefined ? updatedTask.title : existingTask.title;
    const description = updatedTask.description !== undefined ? updatedTask.description : existingTask.description;
    const priority = updatedTask.priority !== undefined ? updatedTask.priority : existingTask.priority;
    const status = updatedTask.status !== undefined ? updatedTask.status : existingTask.status;
    const assignee = updatedTask.assignee !== undefined ? JSON.stringify(updatedTask.assignee) : JSON.stringify(existingTask.assignee);
    const dueDate = updatedTask.dueDate !== undefined ? updatedTask.dueDate : existingTask.due_date;
    const commentsCount = updatedTask.commentsCount !== undefined ? updatedTask.commentsCount : existingTask.comments_count;
    const attachmentsCount = updatedTask.attachmentsCount !== undefined ? updatedTask.attachmentsCount : existingTask.attachments_count;
    const tags = updatedTask.tags !== undefined ? JSON.stringify(updatedTask.tags) : JSON.stringify(existingTask.tags);
    const comments = updatedTask.comments !== undefined ? JSON.stringify(updatedTask.comments) : JSON.stringify(existingTask.comments);
    
    await pool.query(
      `UPDATE tasks SET 
        title = $1, description = $2, priority = $3, status = $4, assignee = $5, 
        due_date = $6, comments_count = $7, attachments_count = $8, tags = $9, comments = $10 
       WHERE id = $11`,
      [title, description, priority, status, assignee, dueDate, commentsCount, attachmentsCount, tags, comments, id]
    );
    
    const result = await pool.query(
      `SELECT id, title, description, priority, status, assignee, due_date as "dueDate", 
              comments_count as "commentsCount", attachments_count as "attachmentsCount", tags, comments 
       FROM tasks WHERE id = $1`,
      [id]
    );
    const resultTask = result.rows[0];
    if (io) {
      io.emit('task:updated', resultTask);
    }
    pushDashboardStats();
    res.json(resultTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const id = req.params.id;

  await invalidateCache('syncforge:tasks');

  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (io) {
      io.emit('task:deleted', id);
    }
    pushDashboardStats();
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Activities ---
app.get('/api/activities', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, user_data as user, description, detail, timestamp 
       FROM activities ORDER BY id DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities', async (req, res) => {
  const newActivity = req.body;
  if (!newActivity.id) {
    newActivity.id = `act-${Date.now()}`;
  }

  try {
    await pool.query(
      `INSERT INTO activities (id, type, user_data, description, detail, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newActivity.id, newActivity.type, JSON.stringify(newActivity.user), newActivity.description, newActivity.detail || null, newActivity.timestamp]
    );
    await pool.query(
      `DELETE FROM activities WHERE id NOT IN (
         SELECT id FROM activities ORDER BY id DESC LIMIT 50
       )`
    );
    res.json(newActivity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Wiki / Knowledge Base ---
app.get('/api/wiki', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, content, parent_id as "parentId", updated_at as "updatedAt", updated_by as "updatedBy" 
       FROM wiki_pages ORDER BY title ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wiki', async (req, res) => {
  const wiki = req.body;
  if (!wiki.id) {
    wiki.id = `wiki-${Date.now()}`;
  }

  try {
    await pool.query(
      `INSERT INTO wiki_pages (id, title, content, parent_id, updated_at, updated_by) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (id) DO UPDATE SET 
         title = EXCLUDED.title, 
         content = EXCLUDED.content, 
         parent_id = EXCLUDED.parent_id, 
         updated_at = EXCLUDED.updated_at, 
         updated_by = EXCLUDED.updated_by`,
      [wiki.id, wiki.title, wiki.content || '', wiki.parentId || null, wiki.updatedAt || 'Just now', wiki.updatedBy || 'Unknown']
    );
    
    const result = await pool.query(
      `SELECT id, title, content, parent_id as "parentId", updated_at as "updatedAt", updated_by as "updatedBy" 
       FROM wiki_pages WHERE id = $1`,
      [wiki.id]
    );
    const resultWiki = result.rows[0];
    if (io) {
      io.emit('wiki:updated', resultWiki);
    }
    res.json(resultWiki);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/wiki/:id', async (req, res) => {
  const id = req.params.id;

  try {
    await pool.query('DELETE FROM wiki_pages WHERE id = $1', [id]);
    if (io) {
      io.emit('wiki:deleted', id);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', async (req, res) => {
  if (!isPostgres()) {
    return res.status(500).json({ error: 'PostgreSQL database not configured' });
  }

  try {
    await pool.query('TRUNCATE TABLE messages, workspaces, users, channels, tasks, activities, wiki_pages RESTART IDENTITY CASCADE;');
    await seedDatabase();
    await invalidateCache('syncforge:tasks');
    pushDashboardStats();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Static Files Middleware & Database Initialization
async function startServer() {
  await initializeDatabase();
  await seedDatabase();

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Socket.io room joins & presence
  io.on('connection', (socket) => {
    console.log(`[Socket.io] 🟢 Client connected: ${socket.id}`);
    
    pushDashboardStats();

    socket.on('room:join', (channelId) => {
      socket.join(channelId);
      console.log(`[Socket.io] 📡 ${socket.id} joined channel room: ${channelId}`);
    });
    
    socket.on('user:join', (userId) => {
      socket.join(userId);
      console.log(`[Socket.io] 👤 ${socket.id} registered for user: ${userId}`);
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] 🔴 Client disconnected: ${socket.id} (${reason})`);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
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
