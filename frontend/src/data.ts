import { User, Task, Channel, Message, Activity } from './types';

// Hotlinked avatar URLs from the designed assets
export const USERS: Record<string, User> = {
  alex: {
    id: 'u1',
    name: 'Alex Rivera',
    email: 'alex.r@syncforge.io',
    role: 'Lead Developer',
    status: 'Online',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBsJEukRni_tXEjVv7G0fDSeT8UdSi7FbwsEUT_G6tuVIEpf16JpZRuFX9Hs_FA_0RK-PWTQiP2g1AJSXjN2wZYSWekIjl_rGMrQCRBsPWph1VIOC1vPr3_SwbvqdM3wRwGCpA4zNcAQMM_1dvktKD0ktJR_72kVV_mDhptUSDmvvRXTiv0oDO-9Ju9648-WKlcjbCqDzbNky2qnML21LjdnbHOHIj_N01suFnRnYph8ldj4BavqC2-ThpGIx6LcHpm2MnUPe4Vwlg',
    commits: 1284,
    reviews: 412,
    proficiency: 96,
  },
  jordan: {
    id: 'u2',
    name: 'Jordan Vance',
    email: 'jordan.v@syncforge.io',
    role: 'Senior Developer',
    status: 'Online',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAV4tudKZHjnER1rdj7gwMGikfLAbBXXaBYtsLzVP8D-DGCsEJiaDr_jLkQgpt_BgwJ8mioxXRN3Ml-Zjg5v4W1GpkA64n4qi4Z0Gcy4dMOCgFQu9feVfDcD7wf9e9X1dD1eIGNf3QR2crYzeLSvbuSe6eA3d-kRS67x2j9lzoONa3ifuCgfaRIt4TazE2lXG-2pXc_w_Abbh2qLMMxNDGknSJlhQ27pAUekjZNZVf-uQknLhSEy0HstUV9cj0b-sG-lrm-hs8JoXY',
    commits: 924,
    reviews: 218,
    proficiency: 90,
  },
  sarah: {
    id: 'u3',
    name: 'Sarah Jenkins',
    email: 'sarah.j@syncforge.io',
    role: 'Lead Product Designer',
    status: 'Online',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDb_ef4eqGM796eehbJWOQ6jApqlbJnbIaz-6lBoqM7CNDsfKHRI7p1nDJKv8trzrG_VmwFLoKRslVMnKrC-EeK0gdZjo_HXOjXPAEnGdicLZgwWFU7AEKKI0sptebxF_gNJiW9gykpOn5UyJrLWv0wxQghtbiyAtzUX1py07gjeJDfq04fqonFK8aP5WFUImm2OrCoMnsis-85_1pl4Waseam-CmXkBTEAhHX9fFDvrHMOGr5Nqc8LqVn5B5wPX1dOlmGOeNwNcs',
    commits: 412,
    reviews: 842,
    proficiency: 95,
  },
  arjun: {
    id: 'u4',
    name: 'Arjun Mehta',
    email: 'arjun.m@syncforge.io',
    role: 'Lead Product Designer',
    status: 'Online',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhMDjDBgRUxiBNsF-VFcouC39c20SQMPrPMMungqgyN4xN4deC6bpCYiduJayCX6-1sdMWKADxnGgwlEXsL9LQ_tO6KamkGciPPqQ0Bzk2V4tlwemK2g71auU3SOfwpSpCwDVLEh_Tj_NKmzxHw7zqQRRO8NlAfHPai_tYcYBU6IKbLps9OjNsqO4LfxuEtcfuCpemvrBTAoVIhHlZXYcqQaYtM3A5ZfsbO9GN7BKQ3vgX2joEjvdEUUkkHktP_mkZWYNcW9pKHuA',
    commits: 1204,
    reviews: 482,
    proficiency: 94,
  },
  chen: {
    id: 'u5',
    name: 'Chen Wei',
    email: 'wei.c@syncforge.io',
    role: 'Frontend Developer',
    status: 'Offline',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmyvkODuNXfEPYsN7ueEuuxIGuBQ-opzsxHwrz82j4rl0X9Bc11HaY3_Rrr0SKM-smT655NanGUB0f8Kehi8RgUq7mn--sLSivsBEYet2uP9Mr62rjhj4k6vselanskHDENHkfuUXCRMPUc_gZ1LkOvh08SZbfOwoOLGh4Q9PlymSzpSuVl9i7C-8zqxK2gQbdcDpj2PzjHrR9-LdtaJfdk6elkAw5aOMC4M1ARg9l9HSt0TJkeH4GKZ0AJAbc9-AtoR1vYz4ygEY',
    commits: 812,
    reviews: 204,
    proficiency: 88,
  },
  emma: {
    id: 'u6',
    name: 'Emma Larson',
    email: 'e.larson@syncforge.io',
    role: 'Backend Developer',
    status: 'Online',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDpTGNjAHl-U2LMIfDUZbXqbsqcWrtfYRQKRG9LhdNiORyE7TXhfIMXxUGlWNaSa5OJvaBgsJnfnB0xL1VuTe_i3lGTSh4nq-N5pSjRkIReQ993dVejAWBBIeHWXELy4g5tCQDyH3fJQTVQCdSxFRjjNz4Mu5fH__70tSpdmqUQgBUy4JZRFystiSb6mebMda75gD7NXsF948RMwuWygRHSvhFYHj7ibALAnoRMQdkCXu_h2GzKZc_EakaK5kFtdKl7pTuX_1Hj_sE',
    commits: 1042,
    reviews: 310,
    proficiency: 91,
  },
  mike: {
    id: 'u7',
    name: 'Mike Ops',
    email: 'mike.o@syncforge.io',
    role: 'DevOps Engineer',
    status: 'Away',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsESGzP_bQukaXGHM-4EhcYPF3AtrgNrz8G6MOT0TrTnVGqoZgaAG1cFstWJtUSGjzBAdHHnoC3sZMpRuV571tNuZZZy8txau5ailms235m0HTssaahWfV-6E3ml_yt5T17nKbXfQjAEGlhSDT0amNk6KvBi9HXqWfca7y6uRfYS0Y2Ud2WcPYpeiw-YkFmvlGrbG76xtrGXnYGOCOUBDM5g_8-xwyP32AFupnuFZ6LkArTyvbcqA218_Js03-hqPrF0YOHqzX-mI',
    commits: 641,
    reviews: 120,
    proficiency: 85,
  },
  lisa: {
    id: 'u8',
    name: 'Lisa PM',
    email: 'lisa.p@syncforge.io',
    role: 'Product Manager',
    status: 'Offline',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDiGo_JrTV_WaSwfSu1goYGFM0ey3YTAl85DL6P72JdO4XET3k7B0X7Me5aAu9_hODybcJ_W74lmzAUHLkeAslWxEQyUvFoir_qveYxKWKxASkxUOHFKYhHkVw--96tAtkNJBhailyzNUtdapc4gcnovgQCf2pnpZDaMRc0orhGtduXuftDXNw_S3DrxvCkHifKEddawFLbVdmqV1F3YnPcc1p8-0ZgWoxC_gKLz20RxV6TRHHl01lbpREw2DK2Y4tZC0gx5E3hWbs',
    commits: 120,
    reviews: 940,
    proficiency: 89,
  }
};

export const CHANNELS: Channel[] = [
  { id: 'c1', name: 'general', description: 'Central communication for the Forge project.' },
  { id: 'c2', name: 'engineering', description: 'Technical design reviews and compilation pipelines.' },
  { id: 'c3', name: 'design-system', description: 'Atmospheric UI theme guidelines, tokens, and components.' }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    user: USERS.alex,
    content: 'Just pushed the latest updates to the core authentication module. We need to review the session handling logic before the deploy.',
    timestamp: '10:42 AM',
    reactions: [
      { emoji: '🚀', count: 3 },
      { emoji: '👍', count: 1 }
    ]
  },
  {
    id: 'm2',
    user: USERS.jordan,
    content: 'I took a look at the middleware. Are we sure the token validation should happen here?',
    timestamp: '10:45 AM',
    codeSnippet: `export const validateToken = (req, res, next) => {
  // Logic for token extraction
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send();
  
  verify(token, process.env.SECRET, (err, decoded) => {
    if (err) return res.status(403).send();
    req.user = decoded;
    next();
  });
};`
  },
  {
    id: 'm3',
    user: USERS.sarah,
    content: "The interaction for the token refresh looks clean on the UI side. I've uploaded the new Figma specs for the error states. 🎨",
    timestamp: '10:52 AM',
    fileAttachment: {
      name: 'auth_flow_final_v2.fig',
      size: '8.4 MB',
      type: 'FIGMA DESIGN'
    }
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'SF-104',
    title: 'Implement WebGL Shader Backdrop',
    description: 'We need to integrate a high-performance WebGL shader for the dashboard background. The shader should feature a dark, atmospheric flow that aligns with our Corporate Modern aesthetic.',
    priority: 'High',
    status: 'In Progress',
    assignee: USERS.arjun,
    dueDate: 'Oct 24, 2026',
    commentsCount: 1,
    attachmentsCount: 1,
    tags: ['Frontend', 'Backdrop'],
    comments: [
      {
        id: 'co1',
        user: {
          name: 'Sarah Jenkins',
          avatar: USERS.sarah.avatar,
          role: 'Lead Product Designer'
        },
        content: 'Should we use Three.js for this or a raw GLSL implementation? Raw GLSL might be more performant for a simple backdrop.',
        timestamp: 'Yesterday at 4:12 PM'
      }
    ]
  },
  {
    id: 'SF-2041',
    title: 'Refactor Authentication Service',
    description: 'Clean up legacy OAuth1.0 providers and standardize on JWT flow for all internal microservices.',
    priority: 'High',
    status: 'Todo',
    assignee: USERS.emma,
    dueDate: 'Tomorrow',
    commentsCount: 3,
    attachmentsCount: 0,
    tags: ['Auth', 'Backend'],
    comments: []
  },
  {
    id: 'SF-1982',
    title: 'Dark Mode Polish',
    description: 'Tune outline contrast levels, add custom focus rings, and adjust semantic warning states for extreme accessibility on low-brightness displays.',
    priority: 'Medium',
    status: 'In Progress',
    assignee: USERS.alex,
    dueDate: 'Oct 28, 2026',
    commentsCount: 0,
    attachmentsCount: 0,
    tags: ['UI', 'A11y'],
    comments: []
  },
  {
    id: 'SF-1883',
    title: 'Database Indexing Audit',
    description: 'Evaluate index utilization on large tables to improve transaction execution speed and query compilation overhead.',
    priority: 'Low',
    status: 'Backlog',
    assignee: USERS.emma,
    dueDate: 'Nov 02, 2026',
    commentsCount: 2,
    attachmentsCount: 0,
    tags: ['Database', 'Audit'],
    comments: []
  },
  {
    id: 'SF-120',
    title: 'Refactor state management logic for dashboard widgets',
    description: 'Move widget data aggregation to unified local state or clean context subscription to prevent cascading re-renders during high-volume updates.',
    priority: 'Medium',
    status: 'Backlog',
    assignee: USERS.alex,
    dueDate: 'Oct 30, 2026',
    commentsCount: 4,
    attachmentsCount: 2,
    tags: ['Refactor', 'Architecture'],
    comments: []
  },
  {
    id: 'SF-101',
    title: 'Update documentation for API v2 endpoints',
    description: 'Sync Swagger specs and Markdown summaries with the new route controllers and authorization parameters.',
    priority: 'Low',
    status: 'Backlog',
    assignee: USERS.lisa,
    dueDate: 'Nov 05, 2026',
    commentsCount: 0,
    attachmentsCount: 0,
    tags: ['Docs', 'API'],
    comments: []
  },
  {
    id: 'SF-99',
    title: 'Fix memory leak in webGL renderer component',
    description: 'Properly dispose shader programs, buffer objects, and context listeners on component unmount.',
    priority: 'High',
    status: 'Todo',
    assignee: USERS.jordan,
    dueDate: 'Tomorrow',
    commentsCount: 1,
    attachmentsCount: 0,
    tags: ['WebGL', 'Fix'],
    comments: []
  },
  {
    id: 'SF-90',
    title: 'Security Audit: OAuth Flow vulnerabilities',
    description: 'Inspect authorization code exchanges, CSRF protection vectors, and redirect URI whitelist parsing behavior.',
    priority: 'High',
    status: 'Review',
    assignee: USERS.mike,
    dueDate: 'Completed',
    commentsCount: 0,
    attachmentsCount: 0,
    tags: ['Security', 'Audit'],
    comments: []
  },
  {
    id: 'SF-88',
    title: 'Setup CI/CD pipelines for production environment',
    description: 'Bootstrap container builds, run static source-level analysis (TS checking and linting), and execute automated integration test specs before final Cloud Run rollout.',
    priority: 'High',
    status: 'Done',
    assignee: USERS.mike,
    dueDate: 'Completed Oct 24',
    commentsCount: 1,
    attachmentsCount: 1,
    tags: ['DevOps', 'CI/CD'],
    comments: []
  }
];

export const RECENT_ACTIVITIES: Activity[] = [
  {
    id: 'a1',
    type: 'commit',
    user: USERS.alex,
    description: 'pushed to main',
    detail: 'feat: implement real-time websocket synchronization for collaborative editing',
    timestamp: '2m ago'
  },
  {
    id: 'a2',
    type: 'message',
    user: USERS.sarah,
    description: 'sent a message in #engineering',
    detail: '"We should probably review the load balancer config before tonight\'s deployment..."',
    timestamp: '15m ago'
  },
  {
    id: 'a3',
    type: 'task_completion',
    user: USERS.jordan,
    description: 'completed SF-104: UI Refactor',
    detail: 'Merged frontend polish fixes with staging verification parameters.',
    timestamp: '1h ago'
  },
  {
    id: 'a4',
    type: 'commit',
    user: USERS.emma,
    description: 'pushed to staging',
    detail: 'fix: resolve memory leak in telemetry module',
    timestamp: '3h ago'
  }
];
