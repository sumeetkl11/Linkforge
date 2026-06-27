import { hashPassword } from '../utils/password.js';
import { isProduction } from '../config/env.js';

export async function initializeDatabase(pool) {
  try {
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
        password TEXT,
        commits INT DEFAULT 0,
        reviews INT DEFAULT 0,
        proficiency INT DEFAULT 0
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        workspace_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (workspace_id, name)
      );

      ALTER TABLE channels ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(50);
      ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_channel_name_workspace'
        ) THEN
          ALTER TABLE channels ADD CONSTRAINT uq_channel_name_workspace UNIQUE (workspace_id, name);
        END IF;
      END $$;

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
        parent_id VARCHAR(50) REFERENCES wiki_pages(id) ON DELETE SET NULL,
        updated_at VARCHAR(50),
        updated_by VARCHAR(100)
      );

      -- ── Performance indexes ──
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages((user_data->>'id'));
      CREATE INDEX IF NOT EXISTS idx_activities_id_desc ON activities(id DESC);
      CREATE INDEX IF NOT EXISTS idx_wiki_parent_id ON wiki_pages(parent_id);
      CREATE INDEX IF NOT EXISTS idx_channels_workspace_id ON channels(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_dm_composite ON messages(receiver_id, (user_data->>'id'));
    `);
    console.log('Database tables and indexes verified successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

export async function seedDatabase(pool, seedDefaultPassword) {
  if (isProduction()) {
    console.log('Production environment detected — skipping automatic database seeding.');
    return;
  }
  try {
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log('Database is empty. Seeding initial values...');

      const passwordHash = await hashPassword(seedDefaultPassword);

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
          `INSERT INTO users (id, name, email, role, status, avatar, google_id, github_id, username, avatar_url, password, commits, reviews, proficiency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [u.id, u.name, u.email, u.role, u.status, u.avatar, null, null, u.username, u.avatar, passwordHash, u.commits, u.reviews, u.proficiency]
        );
      }

      await pool.query(
        `INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        ['w1', 'SyncForge']
      );

      const defaultChannels = [
        { id: 'c1', name: 'general', description: 'Central communication for the Forge project.' },
        { id: 'c2', name: 'engineering', description: 'Technical design reviews and compilation pipelines.' },
        { id: 'c3', name: 'design-system', description: 'Atmospheric UI theme guidelines, tokens, and components.' }
      ];

      for (const c of defaultChannels) {
        await pool.query(
          `INSERT INTO channels (id, name, description, workspace_id) VALUES ($1, $2, $3, $4)`,
          [c.id, c.name, c.description, 'w1']
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
      console.log('Database seeded successfully.');
    } else {
      console.log('Database already has users — skipping seed.');
    }
  } catch (err) {
    console.error('Error seeding database:', err);
    throw err;
  }
}
