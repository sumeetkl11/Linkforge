# Graph Report - syncforge_code  (2026-06-28)

## Corpus Check
- 67 files · ~26,623 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 367 nodes · 640 edges · 20 communities (14 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a4c00bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `authHeaders()` - 19 edges
3. `User` - 17 edges
4. `invalidateCache()` - 13 edges
5. `UserRepository` - 12 edges
6. `pool` - 11 edges
7. `requireAuth()` - 10 edges
8. `UserService` - 10 edges
9. `Task` - 10 edges
10. `config` - 9 edges

## Surprising Connections (you probably didn't know these)
- `buildSocket()` --calls--> `io`  [INFERRED]
  frontend/src/utils/socket.ts → backend/server.js
- `startServer()` --calls--> `connectRedis()`  [EXTRACTED]
  backend/server.js → backend/db/redis.js
- `optionalAuth()` --calls--> `verifyToken()`  [EXTRACTED]
  backend/middleware/auth.js → backend/utils/jwt.js
- `oauthCallback()` --calls--> `signToken()`  [EXTRACTED]
  backend/routes/auth.js → backend/utils/jwt.js
- `ChatProps` --references--> `User`  [EXTRACTED]
  frontend/src/components/Chat.tsx → frontend/src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SyncForge System Architecture** — readme_syncforge, readme_backend_server, readme_frontend_application, index_root [EXTRACTED 0.90]

## Communities (20 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (13): run(), startServer(), appUrl, config, __dirname, __filename, isProduction(), jwtSecret (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (56): io, ChatProps, DashboardProps, HeaderProps, notifIcon, SidebarProps, SignInProps, TaskBoardProps (+48 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (9): getCache(), invalidateCache(), setCache(), ChannelRepository, WikiRepository, ChannelService, TaskService, UserService (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (26): dependencies, bcryptjs, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (29): dependencies, @google/genai, lucide-react, motion, react, react-dom, react-markdown, react-syntax-highlighter (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (26): app, __dirname, __filename, server, ChannelController, MessageController, TaskController, UserController (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (4): ErrorBoundary, Props, State, HTML Root

### Community 9 - "Community 9"
Cohesion: 1.00
Nodes (3): Backend Server, Frontend Application, SyncForge

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (5): CONSTANTS, MessageRepository, UserRepository, MessageService, StatsService

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (3): ActivityController, ActivityRepository, ActivityService

### Community 15 - "Community 15"
Cohesion: 0.40
Nodes (4): 1. Backend Server, 2. Frontend Application, Run and deploy your AI Studio app, Run Locally

## Knowledge Gaps
- **97 isolated node(s):** `__filename`, `__dirname`, `jwtSecret`, `appUrl`, `oauthStatus` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `io` connect `Community 1` to `Community 5`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `jwtSecret` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12643678160919541 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05847781369379959 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._