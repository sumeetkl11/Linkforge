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
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Render terminates TLS and forwards the original client details through one proxy.
// This is required for req.ip and express-rate-limit to handle X-Forwarded-For safely.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const allowedOrigins = [
  'https://linkforge-mauve.vercel.app',
  'http://localhost:5173',
  'http://localhost:5175'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const envFrontend = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null;
    const isAllowed =
      allowedOrigins.includes(origin) ||
      /^http:\/\/localhost:\d+$/.test(origin) ||
      origin.endsWith('.vercel.app') ||
      (envFrontend && origin === envFrontend);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

// HTTP Server and Socket.io setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST']
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

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function getInviteTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS?.replace(/\s/g, '');

  if (!smtpUser || !smtpPass || smtpPass === 'replace-with-gmail-app-password') {
    throw new Error('SMTP_USER and a Gmail app password in SMTP_PASS are required to send invite emails.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

async function sendInviteEmail({ email, name, role }) {
  const smtpUser = process.env.SMTP_USER;
  const from = process.env.SMTP_FROM || smtpUser;
  const joinLink = `${getFrontendUrl()}?inviteEmail=${encodeURIComponent(email)}`;
  const displayName = name || email.split('@')[0];

  const transporter = getInviteTransporter();
  await transporter.sendMail({
    from: `"SyncForge" <${from}>`,
    to: email,
    subject: 'Join SyncForge',
    text: [
      `Hi ${displayName},`,
      '',
      'You have been invited to join the SyncForge engineering workspace.',
      '',
      `Join here: ${joinLink}`,
      `Role: ${role || 'Developer'}`,
      '',
      'SyncForge'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin:0 0 12px">Join SyncForge</h2>
        <p>Hi ${displayName},</p>
        <p>You have been invited to join the SyncForge engineering workspace.</p>
        <p>
          <a href="${joinLink}" style="display:inline-block;background:#60a5fa;color:#0b1220;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">
            Open SyncForge
          </a>
        </p>
        <p><strong>Role:</strong> ${role || 'Developer'}</p>
      </div>
    `
  });
}

async function isEmailBanned(email) {
  return Boolean(await getActiveEmailBan(email));
}

async function getActiveEmailBan(email) {
  if (!isPostgres() || !email) return null;
  const result = await pool.query(
    `SELECT email, reason, ban_type, expires_at
     FROM banned_emails
     WHERE email = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [email.trim().toLowerCase()]
  );
  return result.rows[0] || null;
}

function getBanLoginError(ban) {
  const banType = ban?.ban_type === 'shadow' ? 'shadow' : 'permanent';
  if (banType === 'shadow' && ban.expires_at) {
    const expiresAt = new Date(ban.expires_at);
    const daysRemaining = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return {
      error: `You can't log in until ${expiresAt.toLocaleString()} because you are shadow banned. ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining.`,
      banType,
      expiresAt,
      daysRemaining,
      reason: ban.reason || null
    };
  }

  return {
    error: "You can't log in because this email is permanently banned.",
    banType: 'permanent',
    expiresAt: null,
    daysRemaining: null,
    reason: ban?.reason || null
  };
}

async function isUserIdBanned(userId) {
  if (!isPostgres() || !userId) return false;
  const result = await pool.query(
    `SELECT 1 FROM banned_emails
     WHERE user_id = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

function normalizeAiPriority(priority) {
  const cleanPriority = String(priority || '').toLowerCase();
  if (cleanPriority === 'high') return 'High';
  if (cleanPriority === 'low') return 'Low';
  return 'Medium';
}

function parseAiJson(text) {
  const cleaned = String(text || '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('AI returned an unreadable task draft.');
    }
    return JSON.parse(match[0]);
  }
}

async function generateGeminiTaskDraft({ prompt, title, description, priority, tags, members }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is missing in backend/.env');
  }

  const memberSummary = (Array.isArray(members) ? members : [])
    .slice(0, 20)
    .map(member => `- ${member.id}: ${member.name} (${member.role || 'Developer'})`)
    .join('\n') || '- No members provided';

  const instruction = `
You are SyncForge's task planning assistant.
Return only valid JSON. No markdown. No explanations.
Create or enhance one engineering task for a Kanban board.
Choose the best assigneeId from the member list when possible.

Members:
${memberSummary}

Current fields:
title: ${title || ''}
description: ${description || ''}
priority: ${priority || 'Medium'}
tags: ${(Array.isArray(tags) ? tags : []).join(', ')}

User brief:
${prompt || 'Generate a useful engineering task from the current fields.'}

JSON schema:
{
  "title": "short task title",
  "description": "clear task description with acceptance criteria",
  "priority": "Low | Medium | High",
  "tags": ["tag"],
  "assigneeId": "member id from Members"
}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: instruction }]
      }
    ],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: 'application/json'
    }
  };

  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const modelCandidates = [
    configuredModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-1.5-flash'
  ].filter(Boolean);

  let data = null;
  let lastError = '';

  for (const model of modelCandidates) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (response.ok) {
      data = await response.json();
      break;
    }

    lastError = await response.text();
    if (![404, 429, 503].includes(response.status)) {
      break;
    }
  }

  if (!data) {
    throw new Error(`Gemini request failed: ${lastError || 'No supported Gemini model responded.'}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  const draft = parseAiJson(text);

  return {
    title: String(draft.title || title || '').trim(),
    description: String(draft.description || description || '').trim(),
    priority: normalizeAiPriority(draft.priority || priority),
    tags: Array.isArray(draft.tags)
      ? draft.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 6)
      : (Array.isArray(tags) ? tags : []),
    assigneeId: draft.assigneeId ? String(draft.assigneeId) : undefined
  };
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
const { default: configurePassport } = await import('./config/passport.js');
configurePassport({ pool, isPostgres });
const { default: authRoutes } = await import('./routes/auth.js');
app.use(authRoutes);

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  return jwtSecret.trim();
}

async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const payload = jwt.verify(token, getJwtSecret());
    if (!payload?.id) {
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    const result = await pool.query('SELECT id, role FROM users WHERE id = $1', [payload.id]);
    const user = result.rows[0];
    if (!user || user.role !== 'Admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
}

async function getUserFromToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return null;
  }

  const payload = jwt.verify(token, getJwtSecret());
  if (!payload?.id) {
    return null;
  }

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.id]);
  const user = result.rows[0];
  if (!user || await isEmailBanned(user.email)) {
    return null;
  }

  return user;
}

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

      CREATE TABLE IF NOT EXISTS banned_emails (
        email VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(50),
        reason TEXT,
        ban_type VARCHAR(50) DEFAULT 'permanent',
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE banned_emails ADD COLUMN IF NOT EXISTS reason TEXT;
      ALTER TABLE banned_emails ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);
      ALTER TABLE banned_emails ADD COLUMN IF NOT EXISTS ban_type VARCHAR(50) DEFAULT 'permanent';
      ALTER TABLE banned_emails ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
      ALTER TABLE banned_emails ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      
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
    const cleanEmail = email.trim().toLowerCase();
    const activeBan = await getActiveEmailBan(cleanEmail);
    if (activeBan) {
      return res.status(403).json(getBanLoginError(activeBan));
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User credentials not found. Please use a seeded developer email (e.g. alex.r@syncforge.io).' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/session', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Session expired or account access has been revoked.' });
    }

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Session expired or account access has been revoked.' });
  }
});

app.post('/api/users', async (req, res) => {
  const newUser = req.body;
  if (!newUser.id) {
    newUser.id = `u-${Date.now()}`;
  }

  try {
    const cleanEmail = newUser.email?.trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const activeBan = await getActiveEmailBan(cleanEmail);
    if (activeBan) {
      return res.status(403).json(getBanLoginError(activeBan));
    }
    if (await isUserIdBanned(newUser.id)) {
      return res.status(403).json({ error: 'This user account has been banned from this workspace.' });
    }

    const result = await pool.query(
      `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name, 
         email = EXCLUDED.email, 
        role = COALESCE(users.role, 'Developer'), 
         status = EXCLUDED.status, 
         avatar = EXCLUDED.avatar, 
         google_id = COALESCE(users.google_id, EXCLUDED.google_id),
         github_id = COALESCE(users.github_id, EXCLUDED.github_id),
         username = EXCLUDED.username,
         avatar_url = EXCLUDED.avatar_url,
         commits = EXCLUDED.commits, 
         reviews = EXCLUDED.reviews, 
         proficiency = EXCLUDED.proficiency
       RETURNING *`,
      [
        newUser.id, 
        newUser.name, 
        cleanEmail, 
        'Developer', 
        newUser.status, 
        newUser.avatar, 
        newUser.google_id || null, 
        newUser.github_id || null, 
        newUser.username || cleanEmail.split('@')[0], 
        newUser.avatar_url || newUser.avatar || '',
        newUser.commits || 0, 
        newUser.reviews || 0, 
        newUser.proficiency || 0
      ]
    );
    pushDashboardStats();
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const updatedUser = req.body || {};

  try {
    const existingResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingUser = existingResult.rows[0];
    const cleanEmail = (updatedUser.email ?? existingUser.email)?.trim().toLowerCase();
    const cleanName = (updatedUser.name ?? existingUser.name)?.trim();

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const activeBan = await getActiveEmailBan(cleanEmail);
    if (activeBan) {
      return res.status(403).json(getBanLoginError(activeBan));
    }

    const result = await pool.query(
      `UPDATE users SET
        name = $1,
        email = $2,
        role = $3,
        status = $4,
        avatar = $5,
        username = $6,
        avatar_url = $7,
        commits = $8,
        reviews = $9,
        proficiency = $10
       WHERE id = $11
       RETURNING *`,
      [
        cleanName,
        cleanEmail,
        updatedUser.role ?? existingUser.role ?? 'Developer',
        updatedUser.status ?? existingUser.status ?? 'Offline',
        updatedUser.avatar ?? existingUser.avatar ?? '',
        updatedUser.username ?? existingUser.username ?? cleanEmail.split('@')[0],
        updatedUser.avatar_url ?? updatedUser.avatar ?? existingUser.avatar_url ?? existingUser.avatar ?? '',
        updatedUser.commits ?? existingUser.commits ?? 0,
        updatedUser.reviews ?? existingUser.reviews ?? 0,
        updatedUser.proficiency ?? existingUser.proficiency ?? 0,
        id
      ]
    );

    pushDashboardStats();
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    pushDashboardStats();
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/ban', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { reason, banType = 'permanent', durationDays } = req.body || {};

  try {
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = userResult.rows[0].email.trim().toLowerCase();
    const normalizedBanType = banType === 'shadow' ? 'shadow' : 'permanent';
    const days = Number(durationDays);
    const expiresAt = normalizedBanType === 'shadow' && Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      : null;

    await pool.query(
      `INSERT INTO banned_emails (email, user_id, reason, ban_type, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         reason = EXCLUDED.reason,
         ban_type = EXCLUDED.ban_type,
         expires_at = EXCLUDED.expires_at`,
      [email, id, reason || 'Banned by workspace admin', normalizedBanType, expiresAt]
    );

    if (io) {
      io.to(id).emit('auth:banned', {
        email,
        banType: normalizedBanType,
        expiresAt,
        message: normalizedBanType === 'shadow'
          ? 'Your account has been temporarily banned from this workspace.'
          : 'Your account has been permanently banned from this workspace.'
      });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    pushDashboardStats();
    res.json({ success: true, id, email, banType: normalizedBanType, expiresAt });
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

app.post('/api/invites', requireAdmin, async (req, res) => {
  const invitedUser = req.body;
  const { email, name, role } = invitedUser;
  if (!email) {
    return res.status(400).json({ error: 'Invite email is required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const activeBan = await getActiveEmailBan(cleanEmail);
    if (activeBan) {
      return res.status(403).json(getBanLoginError(activeBan));
    }
    if (await isUserIdBanned(invitedUser.id)) {
      return res.status(403).json({ error: 'This user account has been banned from this workspace.' });
    }

    let savedUser = null;
    if (isPostgres()) {
      const id = invitedUser.id || `u-${Date.now()}`;
      const username = invitedUser.username || cleanEmail.split('@')[0];
      const avatar = invitedUser.avatar || invitedUser.avatar_url || '';
      const result = await pool.query(
        `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           status = EXCLUDED.status,
           avatar = EXCLUDED.avatar,
           username = EXCLUDED.username,
           avatar_url = EXCLUDED.avatar_url
         RETURNING *`,
        [
          id,
          name?.trim() || username,
          cleanEmail,
          role?.trim() || 'Developer',
          invitedUser.status || 'Offline',
          avatar,
          invitedUser.google_id || null,
          invitedUser.github_id || null,
          username,
          invitedUser.avatar_url || avatar,
          invitedUser.commits || 0,
          invitedUser.reviews || 0,
          invitedUser.proficiency || 0
        ]
      );
      savedUser = result.rows[0];
    }

    await sendInviteEmail({
      email: cleanEmail,
      name: name?.trim(),
      role: role?.trim()
    });
    pushDashboardStats();

    res.json({ success: true, user: savedUser || invitedUser });
  } catch (err) {
    console.error('Failed to send invite email:', err);
    res.status(500).json({
      error: err.message || 'Failed to send invite email'
    });
  }
});

app.post('/api/ai/tasks/draft', async (req, res) => {
  try {
    const members = Array.isArray(req.body?.members)
      ? req.body.members.map(member => ({
          id: member.id,
          name: member.name,
          role: member.role
        }))
      : [];

    const draft = await generateGeminiTaskDraft({
      prompt: req.body?.prompt,
      title: req.body?.title,
      description: req.body?.description,
      priority: req.body?.priority,
      tags: req.body?.tags,
      members
    });

    res.json(draft);
  } catch (err) {
    console.error('Failed to generate AI task draft:', err);
    res.status(500).json({ error: err.message || 'Failed to generate task with AI' });
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
app.get('/api/messages', async (req, res) => {
  res.json([]);
});

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
    
    const realtimeMessage = {
      ...message,
      channelId: receiverId ? null : (channelId || null),
      channel_id: receiverId ? null : (channelId || null),
      workspace_id: receiverId ? null : (channelId || null),
      receiverId: receiverId || null,
      receiver_id: receiverId || null
    };

    // Real-time broadcast
    if (io) {
      if (receiverId) {
        // DM: emit only to sender and receiver rooms
        io.to(senderId).to(receiverId).emit('message:received', realtimeMessage);
      } else if (channelId) {
        // Channel: emit only to channel room (users who joined via room:join)
        io.to(channelId).emit('message:received', realtimeMessage);
      } else {
        io.emit('message:received', realtimeMessage);
      }
    }
    pushDashboardStats();
    res.json(realtimeMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a single message (own message or admin)
app.delete('/api/messages/:id', async (req, res) => {
  const id = req.params.id;
  const { requesterId } = req.query;
  try {
    // Verify the message exists and the requester owns it (or is admin)
    const existing = await pool.query('SELECT user_data FROM messages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const owner = existing.rows[0].user_data?.id || existing.rows[0].user_data?.['id'];
    if (requesterId && owner && owner !== requesterId) {
      // Check if requester is admin
      const adminCheck = await pool.query("SELECT role FROM users WHERE id = $1", [requesterId]);
      if (!adminCheck.rows[0] || adminCheck.rows[0].role !== 'Admin') {
        return res.status(403).json({ error: 'You can only delete your own messages' });
      }
    }
    await pool.query('DELETE FROM messages WHERE id = $1', [id]);
    if (io) {
      io.emit('message:deleted', { id });
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a channel (admin only) — cascades to its messages via FK
app.delete('/api/channels/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM channels WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    if (io) {
      io.emit('channel:deleted', { id });
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE all DM messages between two users
app.delete('/api/dm', async (req, res) => {
  const { userId1, userId2 } = req.body;
  if (!userId1 || !userId2) {
    return res.status(400).json({ error: 'userId1 and userId2 are required' });
  }
  try {
    await pool.query(
      `DELETE FROM messages
       WHERE (user_data->>'id' = $1 AND receiver_id = $2)
          OR (user_data->>'id' = $2 AND receiver_id = $1)`,
      [userId1, userId2]
    );
    if (io) {
      io.to(userId1).to(userId2).emit('dm:cleared', { userId1, userId2 });
    }
    res.json({ success: true });
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
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      console.log('[config] Frontend build not found; running as an API-only service.');
    }
  }

  // In-memory presence: userId → Set<socketId>
  const onlinePresence = new Map();

  function broadcastPresence() {
    const onlineIds = Array.from(onlinePresence.keys());
    io.emit('presence:update', { onlineIds });
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
      // Register presence
      if (!onlinePresence.has(userId)) {
        onlinePresence.set(userId, new Set());
      }
      onlinePresence.get(userId).add(socket.id);
      // Tag socket so we can clean up on disconnect
      socket._presenceUserId = userId;
      console.log(`[Socket.io] 👤 ${socket.id} registered for user: ${userId}`);
      broadcastPresence();
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] 🔴 Client disconnected: ${socket.id} (${reason})`);
      const userId = socket._presenceUserId;
      if (userId && onlinePresence.has(userId)) {
        const sockets = onlinePresence.get(userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlinePresence.delete(userId);
        }
        broadcastPresence();
      }
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
