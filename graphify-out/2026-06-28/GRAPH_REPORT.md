# Graph Report - syncforge_code  (2026-06-28)

## Corpus Check
- 67 files · ~27,373 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 369 nodes · 646 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb294a11`
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
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `authHeaders()` - 19 edges
3. `User` - 17 edges
4. `invalidateCache()` - 15 edges
5. `UserRepository` - 13 edges
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

## Communities (21 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (13): run(), startServer(), appUrl, config, __dirname, __filename, isProduction(), jwtSecret (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (55): ChatProps, DashboardProps, HeaderProps, notifIcon, SidebarProps, SignInProps, TaskBoardProps, TaskDetailsModalProps (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (11): TaskController, connectRedis(), getCache(), invalidateCache(), redisStatus, setCache(), ChannelRepository, WikiRepository (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (26): dependencies, bcryptjs, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (30): dependencies, emoji-picker-react, @google/genai, lucide-react, motion, react, react-dom, react-markdown (+22 more)

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
Cohesion: 0.09
Nodes (6): CONSTANTS, MessageController, MessageRepository, UserRepository, MessageService, StatsService

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (3): ActivityController, ActivityRepository, ActivityService

### Community 15 - "Community 15"
Cohesion: 0.40
Nodes (4): 1. Backend Server, 2. Frontend Application, Run and deploy your AI Studio app, Run Locally

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (22): app, __dirname, __filename, io, server, ChannelController, WikiController, optionalAuth() (+14 more)

## Knowledge Gaps
- **98 isolated node(s):** `__filename`, `__dirname`, `jwtSecret`, `appUrl`, `oauthStatus` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `io` connect `Community 20` to `Community 1`?**
  _High betweenness centrality (0.241) - this node is a cross-community bridge._
- **Why does `buildSocket()` connect `Community 1` to `Community 20`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `jwtSecret` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1330049261083744 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.059921710328214396 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08534850640113797 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._