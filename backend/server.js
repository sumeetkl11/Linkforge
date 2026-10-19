import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import http from 'http';
import { Server } from 'socket.io';
import passport from 'passport';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import configurePassport from './config/passport.js';
import createAuthRoutes, { sanitizeUser } from './routes/auth.js';
import {
  generateGeminiTaskDraft,
  generateChatCopilotReply,
  GEMINI_BOT_USER,
} from './services/gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const DEFAULT_SEED_PASSWORD_HASH = bcrypt.hashSync('syncforge123', 10);

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const corsOptions = {
  origin: true,
  credentials: true
};

app.use(cors(corsOptions));

const PORT = process.env.PORT || 3000;

// HTTP Server and Socket.io setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST']
  }
});

// In-memory cache store
const cacheStore = new Map();
export const redis = {
  get: async (k) => cacheStore.get(k) ?? null,
  set: async (k, v) => { cacheStore.set(k, v); return 'OK'; },
  del: async (k) => cacheStore.delete(k),
  incr: async (k) => { const n = (cacheStore.get(k) || 0) + 1; cacheStore.set(k, n); return n; },
};

async function getCache(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setCache(key, value) {
  await redis.set(key, JSON.stringify(value));
}

async function invalidateCache(key) {
  await redis.del(key);
}

// Initial Seed Data for In-Memory & Database Seeding
function getInitialSeedData() {
  const users = [
    {
      id: 'u1', name: 'Alex Rivera', email: 'alex.r@syncforge.io',
      role: 'Admin', status: 'Online',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktKD0ktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktKD0ktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg',
      commits: 1284, reviews: 412, proficiency: 96, username: 'alex.r',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    },
    {
      id: 'u2', name: 'Jordan Vance', email: 'jordan.v@syncforge.io',
      role: 'Senior Developer', status: 'Online',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAV4tudKZHjnER1rdj7gwMGikfLAbBXXaBYtsLzVP8D-DGCsEJiaDr_jLkQgpt_BgwJ8mioxXRN3Ml-Zjg5v4W1GpkA64n4qi4Z0Gcy4dMOCgFQu9feVfDcD7wf9e9X1dD1eIGNf3QR2crYzeLSvbuSe6eA3d-kRS67x2j9lzoONa3ifuCgfaRIt4TazE2lXG-2pXc_w_Abbh2qLMMxNDGknSJlhQ27pAUekjZNZVf-uQknLhSEy0HstUV9cj0b-sG-lrm-hs8JoXY',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAV4tudKZHjnER1rdj7gwMGikfLAbBXXaBYtsLzVP8D-DGCsEJiaDr_jLkQgpt_BgwJ8mioxXRN3Ml-Zjg5v4W1GpkA64n4qi4Z0Gcy4dMOCgFQu9feVfDcD7wf9e9X1dD1eIGNf3QR2crYzeLSvbuSe6eA3d-kRS67x2j9lzoONa3ifuCgfaRIt4TazE2lXG-2pXc_w_Abbh2qLMMxNDGknSJlhQ27pAUekjZNZVf-uQknLhSEy0HstUV9cj0b-sG-lrm-hs8JoXY',
      commits: 924, reviews: 218, proficiency: 90, username: 'jordan.v',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    },
    {
      id: 'u3', name: 'Sarah Jenkins', email: 'sarah.j@syncforge.io',
      role: 'Lead Product Designer', status: 'Online',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDb_ef4eqGM796eehbJWOQ6jApqlbJnbIaz-6lBoqM7CNDsfKHRI7p1nDJKv8trzrG_VmwFLoKRslVMnKrC-EeK0gdZjo_HXOjXPAEnGdicLZgwWFU7AEKKI0sptebxF_gNJiW9gykpOn5UyJrLWv0wxQghtbiyAtzUX1py07gjeJDfq04fqonFK8aP5WFUImm2OrCoMnsis-85_1pl4Waseam-CmXkBTEAhHX9fFDvrHMOGr5Nqc8LqVn5B5wPX1dOlmGOeNwNcs',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDb_ef4eqGM796eehbJWOQ6jApqlbJnbIaz-6lBoqM7CNDsfKHRI7p1nDJKv8trzrG_VmwFLoKRslVMnKrC-EeK0gdZjo_HXOjXPAEnGdicLZgwWFU7AEKKI0sptebxF_gNJiW9gykpOn5UyJrLWv0wxQghtbiyAtzUX1py07gjeJDfq04fqonFK8aP5WFUImm2OrCoMnsis-85_1pl4Waseam-CmXkBTEAhHX9fFDvrHMOGr5Nqc8LqVn5B5wPX1dOlmGOeNwNcs',
      commits: 412, reviews: 842, proficiency: 95, username: 'sarah.j',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    },
    {
      id: 'u4', name: 'Arjun Mehta', email: 'arjun.m@syncforge.io',
      role: 'UI Engineer', status: 'Online',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhMDjDBgRUxiBNsF-VFcouC39c20SQMPrPMMungqgyN4xN4deC6bpCYiduJayCX6-1sdMWKADxnGgwlEXsL9LQ_tO6KamkGciPPqQ0Bzk2V4tlwemK2g71auU3SOfwpSpCwDVLEh_Tj_NKmzxHw7zqQRRO8NlAfHPai_tYcYBU6IKbLps9OjNsqO4LfxuEtcfuCpemvrBTAoVIhHlZXYcqQaYtM3A5ZfsbO9GN7BKQ3vgX2joEjvdEUUkkHktP_mkZWYNcW9pKHuA',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhMDjDBgRUxiBNsF-VFcouC39c20SQMPrPMMungqgyN4xN4deC6bpCYiduJayCX6-1sdMWKADxnGgwlEXsL9LQ_tO6KamkGciPPqQ0Bzk2V4tlwemK2g71auU3SOfwpSpCwDVLEh_Tj_NKmzxHw7zqQRRO8NlAfHPai_tYcYBU6IKbLps9OjNsqO4LfxuEtcfuCpemvrBTAoVIhHlZXYcqQaYtM3A5ZfsbO9GN7BKQ3vgX2joEjvdEUUkkHktP_mkZWYNcW9pKHuA',
      commits: 1204, reviews: 482, proficiency: 94, username: 'arjun.m',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    },
    {
      id: 'u5', name: 'Chen Wei', email: 'wei.c@syncforge.io',
      role: 'Frontend Developer', status: 'Offline',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmyvkODuNXfEPYsN7ueEuuxIGuBQ-opzsxHwrz82j4rl0X9Bc11HaY3_Rrr0SKM-smT655NanGUB0f8Kehi8RgUq7mn--sLSivsBEYet2uP9Mr62rjhj4k6vselanskHDENHkfuUXCRMPUc_gZ1LkOvh08SZbfOwoOLGh4Q9PlymSzpSuVl9i7C-8zqxK2gQbdcDpj2PzjHrR9-LdtaJfdk6elkAw5aOMC4M1ARg9l9HSt0TJkeH4GKZ0AJAbc9-AtoR1vYz4ygEY',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmyvkODuNXfEPYsN7ueEuuxIGuBQ-opzsxHwrz82j4rl0X9Bc11HaY3_Rrr0SKM-smT655NanGUB0f8Kehi8RgUq7mn--sLSivsBEYet2uP9Mr62rjhj4k6vselanskHDENHkfuUXCRMPUc_gZ1LkOvh08SZbfOwoOLGh4Q9PlymSzpSuVl9i7C-8zqxK2gQbdcDpj2PzjHrR9-LdtaJfdk6elkAw5aOMC4M1ARg9l9HSt0TJkeH4GKZ0AJAbc9-AtoR1vYz4ygEY',
      commits: 812, reviews: 204, proficiency: 88, username: 'wei.c',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    },
    {
      id: 'u6', name: 'Emma Larson', email: 'e.larson@syncforge.io',
      role: 'Backend Developer', status: 'Online',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpTGNjAHl-U2LMIfDUZbXqbsqcWrtfYRQKRG9LhdNiORyE7TXhfIMXxUGlWNaSa5OJvaBgsJnfnB0xL1VuTe_i3lGTSh4nq-N5pSjRkIReQ993dVejAWBBIeHWXELy4g5tCQDyH3fJQTVQCdSxFRjjNz4Mu5fH__70tSpdmqUQgBUy4JZRFystiSb6mebMda75gD7NXsF948RMwuWygRHSvhFYHj7ibALAnoRMQdkCXu_h2GzKZc_EakaK5kFtdKl7pTuX_1Hj_sE',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpTGNjAHl-U2LMIfDUZbXqbsqcWrtfYRQKRG9LhdNiORyE7TXhfIMXxUGlWNaSa5OJvaBgsJnfnB0xL1VuTe_i3lGTSh4nq-N5pSjRkIReQ993dVejAWBBIeHWXELy4g5tCQDyH3fJQTVQCdSxFRjjNz4Mu5fH__70tSpdmqUQgBUy4JZRFystiSb6mebMda75gD7NXsF948RMwuWygRHSvhFYHj7ibALAnoRMQdkCXu_h2GzKZc_EakaK5kFtdKl7pTuX_1Hj_sE',
      commits: 1042, reviews: 310, proficiency: 91, username: 'e.larson',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    },
    {
      id: 'u7', name: 'Mike Torres', email: 'mike.t@syncforge.io',
      role: 'DevOps Engineer', status: 'Away',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsESGzP_bQukaXGHM-4EhcYPF3AtrgNrz8G6MOT0TrTnVGqoZgaAG1cFstWJtUSGjzBAdHHnoC3sZMpRuV571tNuZZZy8txau5ailms235m0HTssaahWfV-6E3ml_yt5T17nKbXfQjAEGlhSDT0amNk6KvBi9HXqWfca7y6uRfYS0Y2Ud2WcPYpeiw-YkFmvlGrbG76xtrGXnYGOCOUBDM5g_8-xwyP32AFupnuFZ6LkArTyvbcqA218_Js03-hqPrF0YOHqzX-mI',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsESGzP_bQukaXGHM-4EhcYPF3AtrgNrz8G6MOT0TrTnVGqoZgaAG1cFstWJtUSGjzBAdHHnoC3sZMpRuV571tNuZZZy8txau5ailms235m0HTssaahWfV-6E3ml_yt5T17nKbXfQjAEGlhSDT0amNk6KvBi9HXqWfca7y6uRfYS0Y2Ud2WcPYpeiw-YkFmvlGrbG76xtrGXnYGOCOUBDM5g_8-xwyP32AFupnuFZ6LkArTyvbcqA218_Js03-hqPrF0YOHqzX-mI',
      commits: 641, reviews: 120, proficiency: 85, username: 'mike.t',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    },
    {
      id: 'u8', name: 'Lisa Park', email: 'lisa.p@syncforge.io',
      role: 'Product Manager', status: 'Offline',
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiGo_JrTV_WaSwfSu1goYGFM0ey3YTAl85DL6P72JdO4XET3k7B0X7Me5aAu9_hODybcJ_W74lmzAUHLkeAslWxEQyUvFoir_qveYxKWKxASkxUOHFKYhHkVw--96tAtkNJBhailyzNUtdapc4gcnovgQCf2pnpZDaMRc0orhGtduXuftDXNw_S3DrxvCkHifKEddawFLbVdmqV1F3YnPcc1p8-0ZgWoxC_gKLz20RxV6TRHHl01lbpREw2DK2Y4tZC0gx5E3hWbs',
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiGo_JrTV_WaSwfSu1goYGFM0ey3YTAl85DL6P72JdO4XET3k7B0X7Me5aAu9_hODybcJ_W74lmzAUHLkeAslWxEQyUvFoir_qveYxKWKxASkxUOHFKYhHkVw--96tAtkNJBhailyzNUtdapc4gcnovgQCf2pnpZDaMRc0orhGtduXuftDXNw_S3DrxvCkHifKEddawFLbVdmqV1F3YnPcc1p8-0ZgWoxC_gKLz20RxV6TRHHl01lbpREw2DK2Y4tZC0gx5E3hWbs',
      commits: 120, reviews: 940, proficiency: 89, username: 'lisa.p',
      password_hash: DEFAULT_SEED_PASSWORD_HASH
    }
  ];

  const channels = [
    { id: 'c1', name: 'general', description: 'Central team communication and announcements.', workspaceId: 'w1' },
    { id: 'c2', name: 'engineering', description: 'Technical design reviews, PRs, and architecture discussions.', workspaceId: 'w1' },
    { id: 'c3', name: 'design-system', description: 'UI tokens, component guidelines, and Figma specs.', workspaceId: 'w1' }
  ];

  const messages = [
    {
      id: 'm1', channelId: 'c1', workspaceId: 'w1', receiverId: null, user: sanitizeUser(users[0]),
      content: 'Morning team — just pushed the auth module updates to staging. Please review before EOD.',
      timestamp: '9:02 AM', reactions: [{ emoji: '👍', count: 4 }], codeSnippet: null, fileAttachment: null
    },
    {
      id: 'm2', channelId: 'c1', workspaceId: 'w1', receiverId: null, user: sanitizeUser(users[7]),
      content: 'Sprint planning recap: we have 14 open tasks this cycle. Priorities are the WebSocket sync and the DB indexing audit.',
      timestamp: '9:15 AM', reactions: [{ emoji: '📋', count: 2 }], codeSnippet: null, fileAttachment: null
    },
    {
      id: 'm3', channelId: 'c1', workspaceId: 'w1', receiverId: null, user: sanitizeUser(users[2]),
      content: 'New Figma specs for the dashboard empty states are ready for review: dashboard_empty_v3.fig uploaded.',
      timestamp: '10:31 AM', reactions: [{ emoji: '🎨', count: 3 }], codeSnippet: null,
      fileAttachment: { name: 'dashboard_empty_v3.fig', size: '6.2 MB', type: 'FIGMA DESIGN' }
    },
    {
      id: 'm4', channelId: 'c2', workspaceId: 'w1', receiverId: null, user: sanitizeUser(users[1]),
      content: 'PR #142 is up — refactored the token validation middleware. Can someone with backend context take a look? Tip: mention @gemini in any channel for AI code reviews!',
      timestamp: '10:05 AM', reactions: [{ emoji: '👀', count: 2 }],
      codeSnippet: `export const validateToken = (req, res, next) => {\n  const token = req.headers['authorization']?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'Unauthorized' });\n  verify(token, process.env.JWT_SECRET, (err, decoded) => {\n    if (err) return res.status(403).json({ error: 'Forbidden' });\n    req.user = decoded;\n    next();\n  });\n};`,
      fileAttachment: null
    },
    {
      id: 'm5', channelId: 'c3', workspaceId: 'w1', receiverId: null, user: sanitizeUser(users[2]),
      content: 'Finalizing the color token update. Moving priority colors to semantic aliases so they respond correctly in both themes.',
      timestamp: '11:00 AM', reactions: [{ emoji: '🎨', count: 3 }], codeSnippet: null, fileAttachment: null
    }
  ];

  const tasks = [
    {
      id: 'SF-104', title: 'Implement WebGL Shader Backdrop', priority: 'High', status: 'In Progress',
      assignee: sanitizeUser(users[3]), dueDate: 'Oct 24, 2026',
      description: 'Integrate a high-performance WebGL shader for the dashboard background. Dark atmospheric flow aligned with the dense/technical design direction.',
      tags: ['Frontend', 'WebGL'], commentsCount: 1, attachmentsCount: 1,
      comments: [{ id: 'co1', user: { name: 'Sarah Jenkins', avatar: users[2].avatar, role: 'Lead Product Designer' }, content: 'Should we use Three.js or raw GLSL? Raw GLSL is leaner for a static backdrop.', timestamp: 'Yesterday at 4:12 PM' }]
    },
    {
      id: 'SF-2041', title: 'Refactor Authentication Service', priority: 'High', status: 'Todo',
      assignee: sanitizeUser(users[5]), dueDate: 'Tomorrow',
      description: 'Clean up legacy OAuth1.0 providers and standardize on JWT + Bcrypt flow for all internal microservices.',
      tags: ['Auth', 'Backend'], commentsCount: 3, attachmentsCount: 0, comments: []
    },
    {
      id: 'SF-1982', title: 'Dark Mode Token Audit', priority: 'Medium', status: 'In Progress',
      assignee: sanitizeUser(users[0]), dueDate: 'Oct 28, 2026',
      description: 'Tune outline contrast levels, add custom focus rings, and adjust semantic warning states for accessibility on low-brightness displays.',
      tags: ['UI', 'A11y'], commentsCount: 0, attachmentsCount: 0, comments: []
    },
    {
      id: 'SF-1883', title: 'Database Indexing Audit', priority: 'Low', status: 'Backlog',
      assignee: sanitizeUser(users[5]), dueDate: 'Nov 02, 2026',
      description: 'Evaluate index utilization on large tables to improve transaction execution speed and query compilation overhead.',
      tags: ['Database', 'Performance'], commentsCount: 2, attachmentsCount: 0, comments: []
    },
    {
      id: 'SF-120', title: 'Refactor Dashboard Widget State', priority: 'Medium', status: 'Backlog',
      assignee: sanitizeUser(users[0]), dueDate: 'Oct 30, 2026',
      description: 'Move widget data aggregation to unified local state or clean context subscription to prevent cascading re-renders.',
      tags: ['Refactor', 'Architecture'], commentsCount: 4, attachmentsCount: 2, comments: []
    },
    {
      id: 'SF-99', title: 'Fix Memory Leak in WebGL Renderer', priority: 'High', status: 'Todo',
      assignee: sanitizeUser(users[1]), dueDate: 'Tomorrow',
      description: 'Properly dispose shader programs, buffer objects, and context listeners on component unmount to prevent GPU memory accumulation.',
      tags: ['WebGL', 'Bug'], commentsCount: 1, attachmentsCount: 0, comments: []
    },
    {
      id: 'SF-90', title: 'Security Audit: OAuth Flow', priority: 'High', status: 'Review',
      assignee: sanitizeUser(users[6]), dueDate: 'Completed',
      description: 'Inspect authorization code exchanges, CSRF protection vectors, and redirect URI whitelist parsing behavior.',
      tags: ['Security', 'Audit'], commentsCount: 3, attachmentsCount: 0, comments: []
    },
    {
      id: 'SF-88', title: 'Setup CI/CD Pipelines', priority: 'High', status: 'Done',
      assignee: sanitizeUser(users[6]), dueDate: 'Completed Oct 24',
      description: 'Bootstrap container builds, run static source-level analysis, and execute automated integration tests before Cloud Run rollout.',
      tags: ['DevOps', 'CI/CD'], commentsCount: 1, attachmentsCount: 1, comments: []
    }
  ];

  const activities = [
    {
      id: 'a1', type: 'commit', user: sanitizeUser(users[0]),
      description: 'pushed to main',
      detail: 'feat: implement real-time WebSocket sync and Bcrypt authentication hardening',
      timestamp: '2m ago'
    },
    {
      id: 'a2', type: 'message', user: sanitizeUser(users[2]),
      description: 'sent a message in #engineering',
      detail: '"Finalizing the color token update — moving priority colors to semantic aliases."',
      timestamp: '18m ago'
    },
    {
      id: 'a3', type: 'task_completion', user: sanitizeUser(users[1]),
      description: 'completed SF-88: Setup CI/CD Pipelines',
      detail: 'Merged pipeline configuration with parallel test suite execution.',
      timestamp: '1h ago'
    },
    {
      id: 'a4', type: 'commit', user: sanitizeUser(users[5]),
      description: 'pushed to staging',
      detail: 'fix: resolve N+1 query issue in /api/users endpoint — 3x latency improvement',
      timestamp: '3h ago'
    }
  ];

  const wikiPages = [
    {
      id: 'wiki-1',
      title: 'SyncForge Architecture Overview',
      content: '# SyncForge Architecture\n\nSyncForge is a unified engineering workspace combining real-time Socket.io telemetry, Kanban task tracking, and team channels.\n\n## Core Pillars\n- **Real-time Collaboration**: Low-latency WebSocket event bus for instant state updates.\n- **AI Copilot (`@gemini`)**: Mention `@gemini` or `@ai` in any chat channel or use the Kanban AI Task Drafter powered by Google Gen AI.\n- **Hardened Security**: Bcrypt password hashing (`password_hash`), 7-day JWT sessions, and resilient OAuth 2.0.',
      parentId: null,
      updatedAt: 'Today at 9:00 AM',
      updatedBy: 'Alex Rivera'
    },
    {
      id: 'wiki-2',
      title: 'Deployment & CI/CD Runbook',
      content: '# Deployment & CI/CD Runbook\n\n## Pre-deploy Checklist\n1. Run `npm run lint` to validate TypeScript types.\n2. Run `npm run build` to bundle the frontend assets.\n3. Verify all WebSocket rooms connect cleanly on port 3000.',
      parentId: null,
      updatedAt: 'Yesterday at 5:30 PM',
      updatedBy: 'Mike Torres'
    }
  ];

  return {
    users,
    channels,
    messages,
    tasks,
    activities,
    wikiPages,
    bannedEmails: new Map()
  };
}

let memoryStore = getInitialSeedData();

// PostgreSQL Connection Pool Setup (with 3s timeout & automatic fallback to in-memory store)
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL?.replace(/[\r\n]+/g, '').trim();
let pgActive = false;

export const pool = connectionString
  ? new Pool({
      connectionString,
      connectionTimeoutMillis: 3500,
      ssl: { rejectUnauthorized: false }
    })
  : {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} })
    };

export const isPostgres = () => pgActive;

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/[\r\n]+/g, '').trim().replace(/\/$/, '');
}

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) {
    return 'syncforge-dev-jwt-secret-key';
  }
  return jwtSecret.trim();
}

function getInviteTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS?.replace(/\s/g, '');

  if (!smtpUser || !smtpPass || smtpPass === 'replace-with-gmail-app-password') {
    return null;
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
  const transporter = getInviteTransporter();
  if (!transporter) {
    console.log(`[Invite] Mock invite recorded for ${email} (${role || 'Developer'})`);
    return;
  }

  const smtpUser = process.env.SMTP_USER;
  const from = process.env.SMTP_FROM || smtpUser;
  const joinLink = `${getFrontendUrl()}?inviteEmail=${encodeURIComponent(email)}`;
  const displayName = name || email.split('@')[0];

  await transporter.sendMail({
    from: `"SyncForge" <${from}>`,
    to: email,
    subject: 'Join SyncForge',
    text: `Hi ${displayName},\n\nYou have been invited to join the SyncForge engineering workspace.\n\nJoin here: ${joinLink}\nRole: ${role || 'Developer'}\n\nSyncForge`,
  });
}

async function getActiveEmailBan(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  if (!isPostgres()) {
    const ban = memoryStore.bannedEmails.get(clean);
    if (!ban) return null;
    if (ban.expires_at && new Date(ban.expires_at) <= new Date()) {
      memoryStore.bannedEmails.delete(clean);
      return null;
    }
    return ban;
  }
  const result = await pool.query(
    `SELECT email, reason, ban_type, expires_at
     FROM banned_emails
     WHERE email = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [clean]
  );
  return result.rows[0] || null;
}

async function isEmailBanned(email) {
  return Boolean(await getActiveEmailBan(email));
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
  if (!userId) return false;
  if (!isPostgres()) {
    for (const ban of memoryStore.bannedEmails.values()) {
      if (ban.user_id === userId && (!ban.expires_at || new Date(ban.expires_at) > new Date())) {
        return true;
      }
    }
    return false;
  }
  const result = await pool.query(
    `SELECT 1 FROM banned_emails
     WHERE user_id = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

// Body parser with 10mb limit for profile avatar uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Real-Time Dashboard Stats Broadcaster
async function pushDashboardStats() {
  try {
    if (!isPostgres()) {
      const activeUsers = memoryStore.users.length.toLocaleString();
      const openTasks = memoryStore.tasks.filter(t => t.status !== 'Done').length;
      const messageVolume = (memoryStore.messages.length / 1000).toFixed(1) + 'k';
      io.emit('dashboard_stats_update', { activeUsers, openTasks, messageVolume });
      return;
    }
    const usersRes = await pool.query('SELECT COUNT(*) FROM users');
    const activeUsers = parseInt(usersRes.rows[0].count, 10).toLocaleString();

    const tasksRes = await pool.query("SELECT COUNT(*) FROM tasks WHERE status != 'Done'");
    const openTasks = parseInt(tasksRes.rows[0].count, 10);

    const messagesRes = await pool.query('SELECT COUNT(*) FROM messages');
    const messageVolume = (parseInt(messagesRes.rows[0].count, 10) / 1000).toFixed(1) + 'k';

    io.emit('dashboard_stats_update', {
      activeUsers,
      openTasks,
      messageVolume
    });
  } catch (err) {
    console.error('Failed to broadcast dashboard stats:', err);
  }
}

// Initialize Passport and Register Hardened Auth Routes
app.use(passport.initialize());
configurePassport({
  pool,
  isPostgres,
  getMemoryUsers: () => memoryStore.users,
});
app.use(
  createAuthRoutes({
    pool,
    isPostgres,
    getMemoryStore: () => memoryStore,
    getActiveEmailBan,
    getBanLoginError,
    pushDashboardStats,
    getJwtSecret,
  })
);

async function getUserById(id) {
  if (!isPostgres()) {
    return memoryStore.users.find(u => u.id === id) || null;
  }
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
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

  const user = await getUserById(payload.id);
  if (!user || await isEmailBanned(user.email)) {
    return null;
  }

  return user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUser = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    if (user.role !== 'Admin' && user.role !== 'Lead Developer') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUser = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
}

// Database Initialization & Migration
async function initializeDatabase() {
  if (!connectionString) {
    console.log('[AI Studio] No DATABASE_URL configured — running with seeded in-memory store.');
    pgActive = false;
    return;
  }
  try {
    await pool.query('SELECT 1');
    pgActive = true;
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
        proficiency INT DEFAULT 0,
        password_hash VARCHAR(255)
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

      CREATE TABLE IF NOT EXISTS banned_emails (
        email VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(50),
        reason TEXT,
        ban_type VARCHAR(50) DEFAULT 'permanent',
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        workspace_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
    console.warn('[AI Studio] PostgreSQL unreachable — falling back to in-memory store:', err.message);
    pgActive = false;
  }
}

async function seedDatabase() {
  if (!isPostgres()) {
    memoryStore = getInitialSeedData();
    return;
  }

  try {
    // Ensure existing seeded users have a default password_hash
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE password_hash IS NULL',
      [DEFAULT_SEED_PASSWORD_HASH]
    );

    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count, 10) === 0) {
      const seed = getInitialSeedData();
      for (const u of seed.users) {
        await pool.query(
          `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency, password_hash) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO NOTHING`,
          [u.id, u.name, u.email, u.role, u.status, u.avatar, null, null, u.username, u.avatar, u.commits, u.reviews, u.proficiency, u.password_hash]
        );
      }
      for (const c of seed.channels) {
        await pool.query(
          `INSERT INTO channels (id, name, description, workspace_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.name, c.description, c.workspaceId || 'w1']
        );
      }
      for (const m of seed.messages) {
        await pool.query(
          `INSERT INTO messages (id, channel_id, user_data, content, timestamp, reactions, code_snippet, file_attachment, workspace_id, receiver_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
          [m.id, m.channelId, JSON.stringify(m.user), m.content, m.timestamp, JSON.stringify(m.reactions || []), m.codeSnippet || null, JSON.stringify(m.fileAttachment || null), m.workspaceId || 'w1', m.receiverId || null]
        );
      }
      for (const t of seed.tasks) {
        await pool.query(
          `INSERT INTO tasks (id, title, description, priority, status, assignee, due_date, comments_count, attachments_count, tags, comments) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
          [t.id, t.title, t.description, t.priority, t.status, JSON.stringify(t.assignee), t.dueDate, t.commentsCount || 0, t.attachmentsCount || 0, JSON.stringify(t.tags || []), JSON.stringify(t.comments || [])]
        );
      }
      for (const a of seed.activities) {
        await pool.query(
          `INSERT INTO activities (id, type, user_data, description, detail, timestamp) 
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [a.id, a.type, JSON.stringify(a.user), a.description, a.detail, a.timestamp]
        );
      }
      for (const w of seed.wikiPages) {
        await pool.query(
          `INSERT INTO wiki_pages (id, title, content, parent_id, updated_at, updated_by) 
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [w.id, w.title, w.content, w.parentId, w.updatedAt, w.updatedBy]
        );
      }
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

// REST API Endpoints

// --- Users ---
app.get('/api/users', async (req, res) => {
  const excludeId = req.query.exclude;
  try {
    if (!isPostgres()) {
      const list = memoryStore.users
        .filter(u => !excludeId || u.id !== excludeId)
        .map(sanitizeUser)
        .sort((a, b) => a.name.localeCompare(b.name));
      return res.json(list);
    }
    let query = 'SELECT * FROM users';
    let params = [];
    if (excludeId) {
      query += ' WHERE id != $1';
      params.push(excludeId);
    }
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(sanitizeUser));
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

    res.json({ user: sanitizeUser(user) });
  } catch {
    res.status(401).json({ error: 'Session expired or account access has been revoked.' });
  }
});

// Authenticated profile update (unauthenticated user creation is blocked; use /api/auth/register)
app.post('/api/users', requireAuth, async (req, res) => {
  const updatedFields = req.body || {};
  const authUser = req.authUser;
  const targetId = authUser.role === 'Admin' && updatedFields.id ? updatedFields.id : authUser.id;

  try {
    const cleanEmail = (updatedFields.email || authUser.email)?.trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const activeBan = await getActiveEmailBan(cleanEmail);
    if (activeBan) {
      return res.status(403).json(getBanLoginError(activeBan));
    }

    if (!isPostgres()) {
      const existingIdx = memoryStore.users.findIndex(u => u.id === targetId);
      if (existingIdx < 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const current = memoryStore.users[existingIdx];
      const userRecord = {
        ...current,
        name: updatedFields.name ?? current.name,
        email: cleanEmail,
        // Never allow privilege escalation from standard profile update
        role: current.role,
        status: updatedFields.status ?? current.status,
        avatar: updatedFields.avatar ?? current.avatar,
        username: updatedFields.username ?? current.username,
        avatar_url: updatedFields.avatar_url ?? updatedFields.avatar ?? current.avatar_url,
        commits: updatedFields.commits ?? current.commits,
        reviews: updatedFields.reviews ?? current.reviews,
        proficiency: updatedFields.proficiency ?? current.proficiency,
      };
      memoryStore.users[existingIdx] = userRecord;
      pushDashboardStats();
      return res.json(sanitizeUser(userRecord));
    }

    // Verify email uniqueness if email is changing
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [cleanEmail, targetId]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already in use by another account' });
    }

    const result = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         role = COALESCE($3, role),
         status = COALESCE($4, status),
         avatar = COALESCE($5, avatar),
         username = COALESCE($6, username),
         avatar_url = COALESCE($7, avatar_url),
         commits = COALESCE($8, commits),
         reviews = COALESCE($9, reviews),
         proficiency = COALESCE($10, proficiency)
       WHERE id = $11
       RETURNING *`,
      [
        updatedFields.name || null,
        cleanEmail,
        updatedFields.role || null,
        updatedFields.status || null,
        updatedFields.avatar || null,
        updatedFields.username || null,
        updatedFields.avatar_url || updatedFields.avatar || null,
        updatedFields.commits ?? null,
        updatedFields.reviews ?? null,
        updatedFields.proficiency ?? null,
        targetId
      ]
    );
    pushDashboardStats();
    res.json(sanitizeUser(result.rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const updatedUser = req.body || {};

  try {
    if (!isPostgres()) {
      const idx = memoryStore.users.findIndex(u => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      const existingUser = memoryStore.users[idx];
      const cleanEmail = (updatedUser.email ?? existingUser.email)?.trim().toLowerCase();
      const cleanName = (updatedUser.name ?? existingUser.name)?.trim();
      if (!cleanName || !cleanEmail) {
        return res.status(400).json({ error: 'Name and email are required' });
      }
      const activeBan = await getActiveEmailBan(cleanEmail);
      if (activeBan) {
        return res.status(403).json(getBanLoginError(activeBan));
      }
      const saved = {
        ...existingUser,
        name: cleanName,
        email: cleanEmail,
        role: updatedUser.role ?? existingUser.role ?? 'Developer',
        status: updatedUser.status ?? existingUser.status ?? 'Offline',
        avatar: updatedUser.avatar ?? existingUser.avatar ?? '',
        username: updatedUser.username ?? existingUser.username ?? cleanEmail.split('@')[0],
        avatar_url: updatedUser.avatar_url ?? updatedUser.avatar ?? existingUser.avatar_url ?? existingUser.avatar ?? '',
        commits: updatedUser.commits ?? existingUser.commits ?? 0,
        reviews: updatedUser.reviews ?? existingUser.reviews ?? 0,
        proficiency: updatedUser.proficiency ?? existingUser.proficiency ?? 0
      };
      memoryStore.users[idx] = saved;
      pushDashboardStats();
      return res.json(sanitizeUser(saved));
    }

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
    res.json(sanitizeUser(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;

  try {
    if (!isPostgres()) {
      const idx = memoryStore.users.findIndex(u => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      memoryStore.users.splice(idx, 1);
      pushDashboardStats();
      return res.json({ success: true, id });
    }
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
    const normalizedBanType = banType === 'shadow' ? 'shadow' : 'permanent';
    const days = Number(durationDays);
    const expiresAt = normalizedBanType === 'shadow' && Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      : null;

    if (!isPostgres()) {
      const idx = memoryStore.users.findIndex(u => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      const email = memoryStore.users[idx].email.trim().toLowerCase();
      memoryStore.bannedEmails.set(email, {
        email,
        user_id: id,
        reason: reason || 'Banned by workspace admin',
        ban_type: normalizedBanType,
        expires_at: expiresAt
      });
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
      memoryStore.users.splice(idx, 1);
      pushDashboardStats();
      return res.json({ success: true, id, email, banType: normalizedBanType, expiresAt });
    }

    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = userResult.rows[0].email.trim().toLowerCase();

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
    if (!isPostgres()) {
      const user = memoryStore.users.find(u => u.id === id);
      if (user) {
        user.avatar = avatarUrl;
        user.avatar_url = avatarUrl;
      }
      return res.json({ success: true, avatarUrl });
    }
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
  const invitedUser = req.body || {};
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
    if (!isPostgres()) {
      const id = invitedUser.id || `u-${Date.now()}`;
      const username = invitedUser.username || cleanEmail.split('@')[0];
      const avatar = invitedUser.avatar || invitedUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
      savedUser = {
        id,
        name: name?.trim() || username,
        email: cleanEmail,
        role: role?.trim() || 'Developer',
        status: invitedUser.status || 'Offline',
        avatar,
        google_id: null,
        github_id: null,
        username,
        avatar_url: avatar,
        commits: invitedUser.commits || 0,
        reviews: invitedUser.reviews || 0,
        proficiency: invitedUser.proficiency || 0,
        password_hash: DEFAULT_SEED_PASSWORD_HASH
      };
      const existingIdx = memoryStore.users.findIndex(u => u.email.toLowerCase() === cleanEmail);
      if (existingIdx >= 0) {
        memoryStore.users[existingIdx] = { ...memoryStore.users[existingIdx], ...savedUser };
        savedUser = memoryStore.users[existingIdx];
      } else {
        memoryStore.users.push(savedUser);
      }
    } else {
      const id = invitedUser.id || `u-${Date.now()}`;
      const username = invitedUser.username || cleanEmail.split('@')[0];
      const avatar = invitedUser.avatar || invitedUser.avatar_url || '';
      const result = await pool.query(
        `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
          invitedUser.proficiency || 0,
          DEFAULT_SEED_PASSWORD_HASH
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

    res.json({ success: true, user: sanitizeUser(savedUser || invitedUser) });
  } catch (err) {
    console.error('Failed to send invite email:', err);
    res.status(500).json({
      error: err.message || 'Failed to send invite email'
    });
  }
});

// --- AI: Kanban Task Drafter ---
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

// --- AI: Direct Chat Copilot Endpoint ---
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, channelName, recentMessages, senderName } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const aiReply = await generateChatCopilotReply({
      prompt: String(prompt),
      channelName,
      recentMessages,
      senderName,
    });
    res.json({
      user: GEMINI_BOT_USER,
      ...aiReply,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate AI chat response' });
  }
});

// --- Channels ---
app.get('/api/channels', async (req, res) => {
  try {
    if (!isPostgres()) {
      return res.json(memoryStore.channels.slice().sort((a, b) => a.name.localeCompare(b.name)));
    }
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
    let createdChannel;
    if (!isPostgres()) {
      createdChannel = { id, name, description: description || '', workspaceId: workspaceId || 'w1' };
      memoryStore.channels.push(createdChannel);
    } else {
      const result = await pool.query(
        `INSERT INTO channels (id, name, description, workspace_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, name, description, workspace_id as "workspaceId"`,
        [id, name, description || '', workspaceId || 'w1']
      );
      createdChannel = result.rows[0];
    }

    if (io) {
      io.emit('channel_created', createdChannel);
    }

    res.json(createdChannel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Messages (with Channel vs DM routing support & @gemini AI Copilot) ---
app.get('/api/messages', async (req, res) => {
  res.json([]);
});

app.get('/api/messages/:chatId', async (req, res) => {
  const chatId = req.params.chatId;
  const { type, currentUserId } = req.query;

  try {
    if (!isPostgres()) {
      if (type === 'dm') {
        const filtered = memoryStore.messages.filter(
          m =>
            (m.user?.id === currentUserId && m.receiverId === chatId) ||
            (m.user?.id === chatId && m.receiverId === currentUserId)
        );
        return res.json(filtered);
      }
      const filtered = memoryStore.messages.filter(
        m => m.channelId === chatId || m.workspaceId === chatId
      );
      return res.json(filtered);
    }

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

// Helper to trigger @gemini AI response in background and broadcast via Socket.io
async function handleGeminiMentionInChat({ channelId, receiverId, senderId, userMessage }) {
  const targetRoom = receiverId ? senderId : channelId;
  const typingPayload = {
    chatId: receiverId ? receiverId : channelId,
    channelId: receiverId ? null : (channelId || null),
    receiverId: receiverId ? senderId : null,
    user: GEMINI_BOT_USER,
  };

  try {
    if (io) {
      if (receiverId) {
        io.to(senderId).to(receiverId).emit('ai:typing', { ...typingPayload, isTyping: true });
      } else if (channelId) {
        io.to(channelId).emit('ai:typing', { ...typingPayload, isTyping: true });
      } else {
        io.emit('ai:typing', { ...typingPayload, isTyping: true });
      }
    }

    // Gather recent messages for context
    let recentMessages = [];
    let channelName = '';
    if (!isPostgres()) {
      if (receiverId) {
        recentMessages = memoryStore.messages
          .filter(
            (m) =>
              (m.user?.id === senderId && m.receiverId === receiverId) ||
              (m.user?.id === receiverId && m.receiverId === senderId)
          )
          .slice(-10);
      } else if (channelId) {
        const ch = memoryStore.channels.find((c) => c.id === channelId);
        channelName = ch?.name || channelId;
        recentMessages = memoryStore.messages
          .filter((m) => m.channelId === channelId || m.workspaceId === channelId)
          .slice(-10);
      }
    } else if (channelId) {
      const chRes = await pool.query('SELECT name FROM channels WHERE id = $1', [channelId]);
      channelName = chRes.rows[0]?.name || channelId;
      const msgRes = await pool.query(
        `SELECT user_data as user, content FROM messages WHERE channel_id = $1 ORDER BY id DESC LIMIT 10`,
        [channelId]
      );
      recentMessages = msgRes.rows.reverse();
    }

    const aiOutput = await generateChatCopilotReply({
      prompt: userMessage.content,
      channelName,
      recentMessages,
      senderName: userMessage.user?.name || 'Developer',
    });

    const botMessage = {
      id: `msg-gemini-${Date.now()}`,
      user: GEMINI_BOT_USER,
      content: aiOutput.content,
      codeSnippet: aiOutput.codeSnippet || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactions: [{ emoji: '✨', count: 1 }],
      channelId: receiverId ? null : (channelId || null),
      channel_id: receiverId ? null : (channelId || null),
      workspaceId: receiverId ? null : (channelId || null),
      workspace_id: receiverId ? null : (channelId || null),
      receiverId: receiverId ? senderId : null,
      receiver_id: receiverId ? senderId : null,
    };

    if (!isPostgres()) {
      memoryStore.messages.push(botMessage);
    } else {
      await pool.query(
        `INSERT INTO messages (id, channel_id, user_data, content, timestamp, reactions, code_snippet, file_attachment, workspace_id, receiver_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          botMessage.id,
          botMessage.channelId,
          JSON.stringify(GEMINI_BOT_USER),
          botMessage.content,
          botMessage.timestamp,
          JSON.stringify(botMessage.reactions || []),
          botMessage.codeSnippet || null,
          JSON.stringify(null),
          botMessage.workspaceId,
          botMessage.receiverId
        ]
      );
    }

    if (io) {
      if (receiverId) {
        io.to(senderId).to(receiverId).emit('message:received', botMessage);
      } else if (channelId) {
        io.to(channelId).emit('message:received', botMessage);
      } else {
        io.emit('message:received', botMessage);
      }
    }
    pushDashboardStats();
  } catch (err) {
    console.error('[Gemini Chat Copilot] Error:', err);
  } finally {
    if (io) {
      if (receiverId) {
        io.to(senderId).to(receiverId).emit('ai:typing', { ...typingPayload, isTyping: false });
      } else if (channelId) {
        io.to(channelId).emit('ai:typing', { ...typingPayload, isTyping: false });
      } else {
        io.emit('ai:typing', { ...typingPayload, isTyping: false });
      }
    }
  }
}

app.post('/api/messages', async (req, res) => {
  const { channelId, message, receiverId } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message object' });
  }
  if (!message.id) {
    message.id = `msg-${Date.now()}`;
  }

  const senderId = message.user?.id;

  try {
    const realtimeMessage = {
      ...message,
      channelId: receiverId ? null : (channelId || null),
      channel_id: receiverId ? null : (channelId || null),
      workspaceId: receiverId ? null : (channelId || null),
      workspace_id: receiverId ? null : (channelId || null),
      receiverId: receiverId || null,
      receiver_id: receiverId || null
    };

    if (!isPostgres()) {
      memoryStore.messages.push(realtimeMessage);
    } else {
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
    }

    if (io) {
      if (receiverId) {
        io.to(senderId).to(receiverId).emit('message:received', realtimeMessage);
      } else if (channelId) {
        io.to(channelId).emit('message:received', realtimeMessage);
      } else {
        io.emit('message:received', realtimeMessage);
      }
    }
    pushDashboardStats();
    res.json(realtimeMessage);

    // Check if @gemini or @ai was mentioned, or if message was sent directly to Gemini Copilot
    const text = String(message.content || '');
    const mentionsGemini = /(^|\s)@(gemini|ai)\b/i.test(text) || receiverId === GEMINI_BOT_USER.id;
    if (mentionsGemini && senderId !== GEMINI_BOT_USER.id) {
      handleGeminiMentionInChat({
        channelId,
        receiverId,
        senderId,
        userMessage: realtimeMessage,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  const id = req.params.id;
  const { requesterId } = req.query;
  try {
    if (!isPostgres()) {
      const idx = memoryStore.messages.findIndex(m => m.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Message not found' });
      }
      const owner = memoryStore.messages[idx].user?.id;
      if (requesterId && owner && owner !== requesterId) {
        const reqUser = memoryStore.users.find(u => u.id === requesterId);
        if (!reqUser || (reqUser.role !== 'Admin' && reqUser.role !== 'Lead Developer')) {
          return res.status(403).json({ error: 'You can only delete your own messages' });
        }
      }
      memoryStore.messages.splice(idx, 1);
      if (io) io.emit('message:deleted', { id });
      return res.json({ success: true, id });
    }

    const existing = await pool.query('SELECT user_data FROM messages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const owner = existing.rows[0].user_data?.id;
    if (requesterId && owner && owner !== requesterId) {
      const adminCheck = await pool.query('SELECT role FROM users WHERE id = $1', [requesterId]);
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

app.delete('/api/channels/:id', async (req, res) => {
  const id = req.params.id;
  try {
    if (!isPostgres()) {
      const idx = memoryStore.channels.findIndex(c => c.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      memoryStore.channels.splice(idx, 1);
      memoryStore.messages = memoryStore.messages.filter(m => m.channelId !== id);
      if (io) io.emit('channel:deleted', { id });
      return res.json({ success: true, id });
    }
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

app.delete('/api/dm', async (req, res) => {
  const { userId1, userId2 } = req.body;
  if (!userId1 || !userId2) {
    return res.status(400).json({ error: 'userId1 and userId2 are required' });
  }
  try {
    if (!isPostgres()) {
      memoryStore.messages = memoryStore.messages.filter(
        m =>
          !(
            (m.user?.id === userId1 && m.receiverId === userId2) ||
            (m.user?.id === userId2 && m.receiverId === userId1)
          )
      );
      if (io) io.to(userId1).to(userId2).emit('dm:cleared', { userId1, userId2 });
      return res.json({ success: true });
    }
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
    if (!isPostgres()) {
      const tasks = memoryStore.tasks.slice();
      await setCache(cacheKey, tasks);
      return res.json(tasks);
    }
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
    if (!isPostgres()) {
      memoryStore.tasks.unshift(newTask);
    } else {
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
    }
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
    if (!isPostgres()) {
      const idx = memoryStore.tasks.findIndex(t => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Task not found' });
      }
      const resultTask = {
        ...memoryStore.tasks[idx],
        ...updatedTask,
        id
      };
      memoryStore.tasks[idx] = resultTask;
      if (io) io.emit('task:updated', resultTask);
      pushDashboardStats();
      return res.json(resultTask);
    }

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
    if (!isPostgres()) {
      const idx = memoryStore.tasks.findIndex(t => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Task not found' });
      }
      memoryStore.tasks.splice(idx, 1);
      if (io) io.emit('task:deleted', id);
      pushDashboardStats();
      return res.json({ success: true, id });
    }
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
    if (!isPostgres()) {
      return res.json(memoryStore.activities.slice(0, 50));
    }
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
    if (!isPostgres()) {
      memoryStore.activities.unshift(newActivity);
      memoryStore.activities = memoryStore.activities.slice(0, 50);
      return res.json(newActivity);
    }
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
    if (!isPostgres()) {
      return res.json(memoryStore.wikiPages.slice().sort((a, b) => a.title.localeCompare(b.title)));
    }
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
    if (!isPostgres()) {
      const saved = {
        id: wiki.id,
        title: wiki.title,
        content: wiki.content || '',
        parentId: wiki.parentId || null,
        updatedAt: wiki.updatedAt || 'Just now',
        updatedBy: wiki.updatedBy || 'Unknown'
      };
      const idx = memoryStore.wikiPages.findIndex(w => w.id === wiki.id);
      if (idx >= 0) {
        memoryStore.wikiPages[idx] = saved;
      } else {
        memoryStore.wikiPages.push(saved);
      }
      if (io) io.emit('wiki:updated', saved);
      return res.json(saved);
    }
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
    if (!isPostgres()) {
      memoryStore.wikiPages = memoryStore.wikiPages.filter(w => w.id !== id);
      if (io) io.emit('wiki:deleted', id);
      return res.json({ success: true, id });
    }
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
  try {
    if (!isPostgres()) {
      memoryStore = getInitialSeedData();
      await invalidateCache('syncforge:tasks');
      pushDashboardStats();
      return res.json({ success: true });
    }
    await pool.query('TRUNCATE TABLE messages, users, channels, tasks, activities, wiki_pages RESTART IDENTITY CASCADE;');
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

  const distPath = path.join(__dirname, '../frontend/dist');
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
        return res.sendFile(indexPath);
      }
      next();
    });
  } else {
    console.log('[config] Frontend build not found; running as an API-only service.');
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
    });

    socket.on('user:join', (userId) => {
      socket.join(userId);
      if (!onlinePresence.has(userId)) {
        onlinePresence.set(userId, new Set());
      }
      onlinePresence.get(userId).add(socket.id);
      socket._presenceUserId = userId;
      broadcastPresence();
    });

    socket.on('disconnect', () => {
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
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

startServer();
