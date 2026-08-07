import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL is not set in backend/.env!");
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Connecting to Neon PostgreSQL database...");
  try {
    // 1. Create tables
    console.log("Creating database tables if not exist...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        role VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Offline',
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
        description TEXT
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

      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(50) PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS banned_emails (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL UNIQUE,
        ban_type VARCHAR(50) DEFAULT 'permanent',
        banned_until TIMESTAMP,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Database tables created successfully.");
    
    // 2. Check if empty
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log("Database is empty. Seeding initial values...");
      
      // All 8 distinct fictional team members with realistic stats
      const defaultUsers = [
        {
          id: 'u1', name: 'Alex Rivera', email: 'alex.r@syncforge.io',
          role: 'Lead Developer', status: 'Online',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg',
          commits: 1284, reviews: 412, proficiency: 96, username: 'alex.r', isAdmin: true
        },
        {
          id: 'u2', name: 'Jordan Vance', email: 'jordan.v@syncforge.io',
          role: 'Senior Developer', status: 'Online',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAV4tudKZHjnER1rdj7gwMGikfLAbBXXaBYtsLzVP8D-DGCsEJiaDr_jLkQgpt_BgwJ8mioxXRN3Ml-Zjg5v4W1GpkA64n4qi4Z0Gcy4dMOCgFQu9feVfDcD7wf9e9X1dD1eIGNf3QR2crYzeLSvbuSe6eA3d-kRS67x2j9lzoONa3ifuCgfaRIt4TazE2lXG-2pXc_w_Abbh2qLMMxNDGknSJlhQ27pAUekjZNZVf-uQknLhSEy0HstUV9cj0b-sG-lrm-hs8JoXY',
          commits: 924, reviews: 218, proficiency: 90, username: 'jordan.v', isAdmin: false
        },
        {
          id: 'u3', name: 'Sarah Jenkins', email: 'sarah.j@syncforge.io',
          role: 'Lead Product Designer', status: 'Online',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDb_ef4eqGM796eehbJWOQ6jApqlbJnbIaz-6lBoqM7CNDsfKHRI7p1nDJKv8trzrG_VmwFLoKRslVMnKrC-EeK0gdZjo_HXOjXPAEnGdicLZgwWFU7AEKKI0sptebxF_gNJiW9gykpOn5UyJrLWv0wxQghtbiyAtzUX1py07gjeJDfq04fqonFK8aP5WFUImm2OrCoMnsis-85_1pl4Waseam-CmXkBTEAhHX9fFDvrHMOGr5Nqc8LqVn5B5wPX1dOlmGOeNwNcs',
          commits: 412, reviews: 842, proficiency: 95, username: 'sarah.j', isAdmin: false
        },
        {
          id: 'u4', name: 'Arjun Mehta', email: 'arjun.m@syncforge.io',
          role: 'UI Engineer', status: 'Online',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhMDjDBgRUxiBNsF-VFcouC39c20SQMPrPMMungqgyN4xN4deC6bpCYiduJayCX6-1sdMWKADxnGgwlEXsL9LQ_tO6KamkGciPPqQ0Bzk2V4tlwemK2g71auU3SOfwpSpCwDVLEh_Tj_NKmzxHw7zqQRRO8NlAfHPai_tYcYBU6IKbLps9OjNsqO4LfxuEtcfuCpemvrBTAoVIhHlZXYcqQaYtM3A5ZfsbO9GN7BKQ3vgX2joEjvdEUUkkHktP_mkZWYNcW9pKHuA',
          commits: 1204, reviews: 482, proficiency: 94, username: 'arjun.m', isAdmin: false
        },
        {
          id: 'u5', name: 'Chen Wei', email: 'wei.c@syncforge.io',
          role: 'Frontend Developer', status: 'Offline',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmyvkODuNXfEPYsN7ueEuuxIGuBQ-opzsxHwrz82j4rl0X9Bc11HaY3_Rrr0SKM-smT655NanGUB0f8Kehi8RgUq7mn--sLSivsBEYet2uP9Mr62rjhj4k6vselanskHDENHkfuUXCRMPUc_gZ1LkOvh08SZbfOwoOLGh4Q9PlymSzpSuVl9i7C-8zqxK2gQbdcDpj2PzjHrR9-LdtaJfdk6elkAw5aOMC4M1ARg9l9HSt0TJkeH4GKZ0AJAbc9-AtoR1vYz4ygEY',
          commits: 812, reviews: 204, proficiency: 88, username: 'wei.c', isAdmin: false
        },
        {
          id: 'u6', name: 'Emma Larson', email: 'e.larson@syncforge.io',
          role: 'Backend Developer', status: 'Online',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpTGNjAHl-U2LMIfDUZbXqbsqcWrtfYRQKRG9LhdNiORyE7TXhfIMXxUGlWNaSa5OJvaBgsJnfnB0xL1VuTe_i3lGTSh4nq-N5pSjRkIReQ993dVejAWBBIeHWXELy4g5tCQDyH3fJQTVQCdSxFRjjNz4Mu5fH__70tSpdmqUQgBUy4JZRFystiSb6mebMda75gD7NXsF948RMwuWygRHSvhFYHj7ibALAnoRMQdkCXu_h2GzKZc_EakaK5kFtdKl7pTuX_1Hj_sE',
          commits: 1042, reviews: 310, proficiency: 91, username: 'e.larson', isAdmin: false
        },
        {
          id: 'u7', name: 'Mike Torres', email: 'mike.t@syncforge.io',
          role: 'DevOps Engineer', status: 'Away',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsESGzP_bQukaXGHM-4EhcYPF3AtrgNrz8G6MOT0TrTnVGqoZgaAG1cFstWJtUSGjzBAdHHnoC3sZMpRuV571tNuZZZy8txau5ailms235m0HTssaahWfV-6E3ml_yt5T17nKbXfQjAEGlhSDT0amNk6KvBi9HXqWfca7y6uRfYS0Y2Ud2WcPYpeiw-YkFmvlGrbG76xtrGXnYGOCOUBDM5g_8-xwyP32AFupnuFZ6LkArTyvbcqA218_Js03-hqPrF0YOHqzX-mI',
          commits: 641, reviews: 120, proficiency: 85, username: 'mike.t', isAdmin: false
        },
        {
          id: 'u8', name: 'Lisa Park', email: 'lisa.p@syncforge.io',
          role: 'Product Manager', status: 'Offline',
          avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiGo_JrTV_WaSwfSu1goYGFM0ey3YTAl85DL6P72JdO4XET3k7B0X7Me5aAu9_hODybcJ_W74lmzAUHLkeAslWxEQyUvFoir_qveYxKWKxASkxUOHFKYhHkVw--96tAtkNJBhailyzNUtdapc4gcnovgQCf2pnpZDaMRc0orhGtduXuftDXNw_S3DrxvCkHifKEddawFLbVdmqV1F3YnPcc1p8-0ZgWoxC_gKLz20RxV6TRHHl01lbpREw2DK2Y4tZC0gx5E3hWbs',
          commits: 120, reviews: 940, proficiency: 89, username: 'lisa.p', isAdmin: false
        }
      ];

      for (const u of defaultUsers) {
        await pool.query(
          `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, commits, reviews, proficiency) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [u.id, u.name, u.email, u.role, u.status, u.avatar, null, null, u.username, u.avatar, u.commits, u.reviews, u.proficiency]
        );
      }
      console.log("- Users table seeded (8 users).");

      // 3 distinct channels
      const defaultChannels = [
        { id: 'c1', name: 'general', description: 'Central team communication and announcements.' },
        { id: 'c2', name: 'engineering', description: 'Technical design reviews, PRs, and architecture discussions.' },
        { id: 'c3', name: 'design-system', description: 'UI tokens, component guidelines, and Figma specs.' }
      ];

      for (const c of defaultChannels) {
        await pool.query(
          `INSERT INTO channels (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.name, c.description]
        );
      }
      console.log("- Channels table seeded (3 channels).");

      // Professional seed messages across all 3 channels
      const defaultMessages = [
        // #general
        {
          id: 'm1', channel_id: 'c1', user: defaultUsers[0],
          content: 'Morning team — just pushed the auth module updates to staging. Please review before EOD.',
          timestamp: '9:02 AM', reactions: [{ emoji: '👍', count: 4 }]
        },
        {
          id: 'm2', channel_id: 'c1', user: defaultUsers[7],
          content: 'Sprint planning recap: we have 14 open tasks this cycle. Priorities are the WebSocket sync and the DB indexing audit.',
          timestamp: '9:15 AM', reactions: [{ emoji: '📋', count: 2 }]
        },
        {
          id: 'm3', channel_id: 'c1', user: defaultUsers[2],
          content: 'New Figma specs for the dashboard empty states are ready for review: dashboard_empty_v3.fig uploaded.',
          timestamp: '10:31 AM', reactions: [{ emoji: '🎨', count: 3 }],
          file_attachment: { name: 'dashboard_empty_v3.fig', size: '6.2 MB', type: 'FIGMA DESIGN' }
        },
        {
          id: 'm4', channel_id: 'c1', user: defaultUsers[5],
          content: 'The Neon DB latency spike from yesterday has been resolved — root cause was a missing index on the messages table. Fixed and deployed.',
          timestamp: '11:48 AM', reactions: [{ emoji: '✅', count: 5 }, { emoji: '🚀', count: 2 }]
        },
        // #engineering
        {
          id: 'm5', channel_id: 'c2', user: defaultUsers[1],
          content: 'PR #142 is up — refactored the token validation middleware. Can someone with backend context take a look?',
          timestamp: '10:05 AM', reactions: [{ emoji: '👀', count: 2 }],
          code_snippet: `export const validateToken = (req, res, next) => {\n  const token = req.headers['authorization']?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'Unauthorized' });\n  verify(token, process.env.JWT_SECRET, (err, decoded) => {\n    if (err) return res.status(403).json({ error: 'Forbidden' });\n    req.user = decoded;\n    next();\n  });\n};`
        },
        {
          id: 'm6', channel_id: 'c2', user: defaultUsers[0],
          content: 'Reviewed PR #142 — logic looks solid. Left two inline comments about the error response format. Nothing blocking.',
          timestamp: '10:22 AM', reactions: [{ emoji: '✅', count: 1 }]
        },
        {
          id: 'm7', channel_id: 'c2', user: defaultUsers[6],
          content: 'CI/CD pipeline is green across all stages. Build time is down to 4m 12s after parallelizing the test suites.',
          timestamp: '2:14 PM', reactions: [{ emoji: '🚀', count: 6 }]
        },
        {
          id: 'm8', channel_id: 'c2', user: defaultUsers[4],
          content: 'Found a render issue on the TaskBoard when dragging to the Done column on Safari. Logging a bug — SF-212.',
          timestamp: '3:40 PM', reactions: [{ emoji: '🐛', count: 1 }]
        },
        // #design-system
        {
          id: 'm9', channel_id: 'c3', user: defaultUsers[2],
          content: 'Finalizing the color token update. Moving priority colors to semantic aliases so they respond correctly in both themes.',
          timestamp: '11:00 AM', reactions: [{ emoji: '🎨', count: 3 }]
        },
        {
          id: 'm10', channel_id: 'c3', user: defaultUsers[3],
          content: 'I implemented the priority left-border strip on task cards. Looks much cleaner than the badge approach — screenshots attached.',
          timestamp: '1:30 PM', reactions: [{ emoji: '🔥', count: 4 }, { emoji: '👍', count: 3 }]
        },
        {
          id: 'm11', channel_id: 'c3', user: defaultUsers[2],
          content: 'Love it. Can you also update the Wiki page cards to use the same border system for document categories?',
          timestamp: '1:45 PM', reactions: []
        },
        {
          id: 'm12', channel_id: 'c3', user: defaultUsers[0],
          content: 'Reminder: JetBrains Mono is reserved for metrics, IDs, and code snippets. All body copy should stay on Inter.',
          timestamp: '4:00 PM', reactions: [{ emoji: '📐', count: 2 }]
        }
      ];

      for (const m of defaultMessages) {
        await pool.query(
          `INSERT INTO messages (id, channel_id, user_data, content, timestamp, reactions, code_snippet, file_attachment, workspace_id, receiver_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            m.id, m.channel_id, JSON.stringify(m.user), m.content, m.timestamp,
            JSON.stringify(m.reactions || []),
            m.code_snippet || null,
            m.file_attachment ? JSON.stringify(m.file_attachment) : null,
            'w1', null
          ]
        );
      }
      console.log("- Messages table seeded (12 messages across 3 channels).");

      // 9 tasks spread across all 5 statuses
      const defaultTasks = [
        {
          id: 'SF-104', title: 'Implement WebGL Shader Backdrop', priority: 'High', status: 'In Progress',
          assignee: defaultUsers[3], dueDate: 'Aug 14, 2026',
          description: 'Integrate a high-performance WebGL shader for the dashboard background. Dark atmospheric flow aligned with the dense/technical design direction.',
          tags: ['Frontend', 'WebGL'], comments_count: 2, attachments_count: 1,
          comments: [{ id: 'co1', user: { name: 'Sarah Jenkins', avatar: defaultUsers[2].avatar, role: 'Lead Product Designer' }, content: 'Should we use Three.js or raw GLSL? Raw GLSL is leaner for a static backdrop.', timestamp: 'Yesterday at 4:12 PM' }]
        },
        {
          id: 'SF-2041', title: 'Refactor Authentication Service', priority: 'High', status: 'Todo',
          assignee: defaultUsers[5], dueDate: 'Aug 10, 2026',
          description: 'Clean up legacy OAuth1.0 providers and standardize on JWT flow for all internal microservices.',
          tags: ['Auth', 'Backend'], comments_count: 3, attachments_count: 0, comments: []
        },
        {
          id: 'SF-1982', title: 'Dark Mode Token Audit', priority: 'Medium', status: 'In Progress',
          assignee: defaultUsers[0], dueDate: 'Aug 18, 2026',
          description: 'Tune outline contrast levels, add custom focus rings, and adjust semantic warning states for accessibility on low-brightness displays.',
          tags: ['UI', 'A11y'], comments_count: 1, attachments_count: 0, comments: []
        },
        {
          id: 'SF-1883', title: 'Database Indexing Audit', priority: 'Low', status: 'Backlog',
          assignee: defaultUsers[5], dueDate: 'Aug 28, 2026',
          description: 'Evaluate index utilization on large tables to improve transaction execution speed and query compilation overhead.',
          tags: ['Database', 'Performance'], comments_count: 2, attachments_count: 0, comments: []
        },
        {
          id: 'SF-120', title: 'Refactor Dashboard Widget State', priority: 'Medium', status: 'Backlog',
          assignee: defaultUsers[0], dueDate: 'Aug 22, 2026',
          description: 'Move widget data aggregation to unified local state or clean context subscription to prevent cascading re-renders.',
          tags: ['Refactor', 'Architecture'], comments_count: 4, attachments_count: 2, comments: []
        },
        {
          id: 'SF-101', title: 'Update API v2 Documentation', priority: 'Low', status: 'Backlog',
          assignee: defaultUsers[7], dueDate: 'Sep 05, 2026',
          description: 'Sync Swagger specs and Markdown summaries with the new route controllers and authorization parameters.',
          tags: ['Docs', 'API'], comments_count: 0, attachments_count: 0, comments: []
        },
        {
          id: 'SF-99', title: 'Fix Memory Leak in WebGL Renderer', priority: 'High', status: 'Todo',
          assignee: defaultUsers[1], dueDate: 'Aug 09, 2026',
          description: 'Properly dispose shader programs, buffer objects, and context listeners on component unmount to prevent GPU memory accumulation.',
          tags: ['WebGL', 'Bug'], comments_count: 1, attachments_count: 0, comments: []
        },
        {
          id: 'SF-90', title: 'Security Audit: OAuth Flow', priority: 'High', status: 'Review',
          assignee: defaultUsers[6], dueDate: 'Completed',
          description: 'Inspect authorization code exchanges, CSRF protection vectors, and redirect URI whitelist parsing behavior.',
          tags: ['Security', 'Audit'], comments_count: 3, attachments_count: 0, comments: []
        },
        {
          id: 'SF-88', title: 'Setup CI/CD Pipelines', priority: 'High', status: 'Done',
          assignee: defaultUsers[6], dueDate: 'Completed Aug 01',
          description: 'Bootstrap container builds, run static source-level analysis, and execute automated integration tests before Cloud Run rollout.',
          tags: ['DevOps', 'CI/CD'], comments_count: 1, attachments_count: 1, comments: []
        }
      ];

      for (const t of defaultTasks) {
        await pool.query(
          `INSERT INTO tasks (id, title, description, priority, status, assignee, due_date, comments_count, attachments_count, tags, comments) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            t.id, t.title, t.description, t.priority, t.status,
            JSON.stringify(t.assignee), t.dueDate, t.comments_count, t.attachments_count,
            JSON.stringify(t.tags), JSON.stringify(t.comments)
          ]
        );
      }
      console.log("- Tasks table seeded (9 tasks across all statuses).");

      // 6 varied recent activities
      const defaultActivities = [
        {
          id: 'a1', type: 'commit', user: defaultUsers[0],
          description: 'pushed to main',
          detail: 'feat: implement real-time WebSocket sync for collaborative task editing',
          timestamp: '2m ago'
        },
        {
          id: 'a2', type: 'message', user: defaultUsers[2],
          description: 'sent a message in #engineering',
          detail: '"Finalizing the color token update — moving priority colors to semantic aliases."',
          timestamp: '18m ago'
        },
        {
          id: 'a3', type: 'task_completion', user: defaultUsers[1],
          description: 'completed SF-88: Setup CI/CD Pipelines',
          detail: 'Merged pipeline configuration with parallel test suite execution.',
          timestamp: '1h ago'
        },
        {
          id: 'a4', type: 'commit', user: defaultUsers[5],
          description: 'pushed to staging',
          detail: 'fix: resolve N+1 query issue in /api/users endpoint — 3x latency improvement',
          timestamp: '3h ago'
        },
        {
          id: 'a5', type: 'comment', user: defaultUsers[3],
          description: 'commented on SF-104',
          detail: '"Raw GLSL will be lighter — I\'ll prototype both and share benchmarks by EOD."',
          timestamp: '5h ago'
        },
        {
          id: 'a6', type: 'task_completion', user: defaultUsers[6],
          description: 'moved SF-90 to Review',
          detail: 'OAuth security audit complete — 2 low-severity findings documented, no blockers.',
          timestamp: '1d ago'
        }
      ];

      for (const a of defaultActivities) {
        await pool.query(
          `INSERT INTO activities (id, type, user_data, description, detail, timestamp) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [a.id, a.type, JSON.stringify(a.user), a.description, a.detail, a.timestamp]
        );
      }
      console.log("- Activities table seeded (6 activities).");

      // Seed workspace
      await pool.query(`INSERT INTO workspaces (id) VALUES ('w1') ON CONFLICT (id) DO NOTHING`);
      console.log("- Workspace seeded.");
      console.log("\n✅ Database seeded successfully with realistic demo data!");
    } else {
      console.log(`Database already has ${userCount.rows[0].count} users — skipping seed.`);
      console.log("To re-seed, clear the users table first: DELETE FROM users;");
    }
  } catch (err) {
    console.error("Error seeding Neon database:", err);
  } finally {
    await pool.end();
  }
}

run();
