# Graph Report - D:\MyCode\new\syncforge\front_backend\syncforge_code  (2026-06-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 226 nodes · 360 edges · 13 communities (10 shown, 3 thin omitted)
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `authHeaders()` - 19 edges
3. `User` - 17 edges
4. `Task` - 10 edges
5. `ErrorBoundary` - 8 edges
6. `config` - 6 edges
7. `Activity` - 6 edges
8. `verifyToken()` - 5 edges
9. `scripts` - 5 edges
10. `fetchUsers()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `buildSocket()` --calls--> `io`  [INFERRED]
  frontend/src/utils/socket.ts → backend/server.js
- `SignInProps` --references--> `User`  [EXTRACTED]
  frontend/src/components/SignIn.tsx → frontend/src/types.ts
- `optionalAuth()` --calls--> `verifyToken()`  [EXTRACTED]
  backend/middleware/auth.js → backend/utils/jwt.js
- `buildSocket()` --calls--> `getToken()`  [EXTRACTED]
  frontend/src/utils/socket.ts → frontend/src/api.ts
- `ChatProps` --references--> `User`  [EXTRACTED]
  frontend/src/components/Chat.tsx → frontend/src/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SyncForge System Architecture** — readme_syncforge, readme_backend_server, readme_frontend_application, index_root [EXTRACTED 0.90]

## Communities (13 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (24): pool, apiLimiter, app, authLimiter, __dirname, __filename, initializeDatabase(), pool (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (15): ChatProps, SidebarProps, TaskBoardProps, TaskDetailsModalProps, TeamDirectoryProps, UserProfileProps, fetchUsers(), CHANNELS (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (23): SignInProps, authHeaders(), createActivity(), createChannel(), createTask(), createUser(), deleteTask(), deleteWikiPage() (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (26): dependencies, bcryptjs, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (26): dependencies, @google/genai, lucide-react, motion, react, react-dom, socket.io-client, @tailwindcss/vite (+18 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (18): io, DashboardProps, HeaderProps, notifIcon, clearToken(), Chat, Dashboard, Settings (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (4): ErrorBoundary, Props, State, HTML Root

### Community 9 - "Community 9"
Cohesion: 1.00
Nodes (3): Backend Server, Frontend Application, SyncForge

## Knowledge Gaps
- **93 isolated node(s):** `__filename`, `__dirname`, `jwtSecret`, `appUrl`, `oauthStatus` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildSocket()` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `io` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **Why does `getToken()` connect `Community 2` to `Community 5`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `jwtSecret` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0708245243128964 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14532019704433496 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._