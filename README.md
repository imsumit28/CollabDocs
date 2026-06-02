# CollabDocs

![CollabDocs Banner](./banner.png)

[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen?logo=mongodb)](https://mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)](https://socket.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A production-ready real-time collaborative document editor — think Google Docs, built from scratch. Multiple users edit simultaneously with live cursors, conflict-free CRDT sync, AI writing assistance, and version history.

**[Live Demo](https://collabdocs2026.vercel.app)** · **[API Docs](https://collabdocs2026.vercel.app/api/docs)** · **[GitHub](https://github.com/imsumit28/CollabDocs)**

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Design Decisions](#design-decisions)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Security](#security)
- [Deployment](#deployment)

---

## Features

**Real-Time Collaboration**
- **Live co-editing** — Multiple users type simultaneously via Y.js CRDT + Socket.IO. Changes propagate in ~100ms with zero conflicts.
- **Live cursors** — Each collaborator gets a unique colour cursor with their name label, updated in real time.
- **Comments** — Inline comments anchored to text ranges, with reply threads and resolve/reopen flow.
- **Suggestions mode** — Track Changes-style mode built with free TipTap extensions. No paid Pro license required.
- **Version history** — Browse and restore past snapshots of any document.
- **Auto-save** — Documents persist every 5 seconds of inactivity via debounced writes to MongoDB.

**User Features**
- **AI writing assistant** — Improve prose, fix grammar, or summarise documents. Powered by Groq (Llama 3.3 70B, free tier).
- **Sharing** — Share documents via link with View or Edit permission levels.
- **Export** — Download as PDF or DOCX.
- **Authentication** — Email/password with JWT + Google OAuth.

**Production-Ready**
- **45+ tests** — Auth, documents, comments, and real-time sync covered at ~60% overall.
- **Interactive API docs** — Swagger/OpenAPI UI at `/api/docs` with request examples.
- **Security-first** — Rate limiting, input validation, CORS, Helmet headers, XSS/CSRF protection.
- **Full TypeScript** — End-to-end type safety across client and server.

---

## Architecture

### System Overview

```mermaid
graph TB
    subgraph Clients["Browser Clients"]
        B1["User A"]
        B2["User B"]
    end

    subgraph Frontend["Frontend · Vercel"]
        NX["Next.js 14\nApp Router"]
        TE["TipTap Editor\n(ProseMirror)"]
        YC["Y.js CRDT\nClient"]
    end

    subgraph Backend["Backend · Render"]
        EX["Express REST API\nPort 4000"]
        SO["Socket.IO Server"]
        YS["Y.js Sync Engine\n(in-memory Y.Doc per room)"]
    end

    subgraph DataLayer["Data Layer"]
        MG[("MongoDB Atlas\nDocuments · Users\nComments · Versions")]
        RD[("Redis · Upstash\nSocket.IO Pub/Sub\n(planned)")]
    end

    subgraph External["External Services"]
        GR["Groq AI\nLlama 3.3 70B"]
        GO["Google OAuth 2.0"]
    end

    B1 <-->|HTTPS| NX
    B2 <-->|HTTPS| NX
    NX <-->|"REST API (JWT)"| EX
    NX <-->|"WebSocket\n(Y.js binary deltas)"| SO
    SO --> YS
    YS <-->|"5 s debounce write"| MG
    EX <-->|Queries| MG
    SO <-->|Pub/Sub fan-out| RD
    EX --> GR
    EX --> GO
```

### Real-Time Collaboration Flow

```
Browser A                  Server                  Browser B
   │                          │                          │
   │── JWT handshake ────────►│ verify token             │
   │                          │                          │
   │── doc:join { docId } ───►│ check access             │
   │                          │ init Y.Doc (or load DB)  │
   │◄── yjs:sync (full state)─│                          │
   │                          │◄── doc:join ─────────────│
   │                          │─── yjs:sync ────────────►│
   │                          │                          │
   │ [user types]             │                          │
   │── yjs:update (delta) ───►│ apply to Y.Doc           │
   │                          │── yjs:update ───────────►│ (relay)
   │                          │                          │
   │                          │  [5 s debounce]          │
   │                          │  save to MongoDB         │
   │◄── doc:saved ────────────│─── doc:saved ───────────►│
   │                          │                          │
   │ [tab closed]             │                          │
   │── disconnect             │ emit doc:awareness       │
   │                          │ flush Y.Doc if last user │
```

1. **Auth** — JWT access token sent in Socket.IO handshake. Rejected connections never reach event handlers.
2. **Join** — Server loads serialised `Y.Doc` from MongoDB into a shared in-memory instance for the room, then sends full state to the joining client.
3. **Update relay** — Every keystroke produces a tiny binary Y.js delta. The server applies it to the in-memory `Y.Doc` and fans it out to all peers. No round-trip serialisation.
4. **Persistence** — A 5-second debounce timer resets on every update. On expiry the server encodes the `Y.Doc` and writes to MongoDB as a `Buffer`. This bounds write amplification to ≤ 12 writes/minute regardless of typing speed.
5. **Disconnect cleanup** — The handler re-broadcasts the updated presence list (deduplicated by user ID for multi-tab) and flushes the `Y.Doc` if the room is now empty.

### Directory Structure

```
collabdocs/
├── client/                    # Next.js 14 frontend
│   ├── app/
│   │   ├── (auth)/            # Login + Signup pages
│   │   ├── dashboard/         # Document list
│   │   └── doc/[id]/          # Editor + collaboration
│   ├── components/            # Shared UI components
│   ├── contexts/              # AuthContext, ToastContext
│   └── lib/                   # API client, Socket.IO singleton, Y.js provider
│
└── server/                    # Node.js + Express backend
    ├── API.md                 # Complete REST API reference
    ├── TESTING.md             # Testing guide
    └── src/
        ├── routes/            # auth, documents, versions, ai, export, comments
        ├── socket/            # Socket.IO server + Y.js sync engine
        ├── models/            # Mongoose schemas (User, Document, Comment, Version)
        ├── middleware/        # JWT auth, rate limiting
        ├── utils/             # JWT helpers, validation, env validation
        ├── swagger.ts         # OpenAPI 3.0 spec
        └── __tests__/         # Jest test suites
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 14, React 18 | App Router, SSR, file-based routing |
| **Editor** | TipTap (ProseMirror) | Extensible rich-text with CRDT bindings |
| **Real-Time** | Socket.IO 4, Y.js | CRDT sync + WebSocket transport |
| **Backend** | Node.js, Express, TypeScript | Familiar, fast, type-safe |
| **Database** | MongoDB (Mongoose) | Schema-flexible for documents/binary Y.js state |
| **Cache/Scale** | Redis (Upstash) *(planned)* | Future horizontal scaling via Socket.IO pub/sub fan-out |
| **Auth** | JWT (HS256), Google OAuth (Passport.js) | Stateless, XSS-safe token strategy |
| **AI** | Groq API — Llama 3.3 70B | Free tier, fast inference |
| **Styling** | Tailwind CSS | Utility-first, consistent design tokens |
| **Hosting** | Vercel + Render | Zero-config deploys from GitHub |

---

## Setup

### Prerequisites

| Service | Where to get it | Required? |
|---------|----------------|-----------|
| Node.js 20+ | [nodejs.org](https://nodejs.org) | Yes |
| MongoDB Atlas | [cloud.mongodb.com](https://cloud.mongodb.com) — free M0 cluster | Yes |
| Groq API key | [console.groq.com](https://console.groq.com) — free tier | Yes (AI features) |
| Google Cloud project | [console.cloud.google.com](https://console.cloud.google.com) | Optional (OAuth only) |
| Upstash Redis | [upstash.com](https://upstash.com) — free database | Optional (future scaling) |

### 1. Clone and install

```bash
git clone https://github.com/imsumit28/CollabDocs.git
cd CollabDocs
npm install
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

**`server/.env` — key variables to fill in:**

```bash
# MongoDB: get connection string from Atlas > Connect > Drivers
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/collabdocs

# Redis: optional — only needed for horizontal scaling across multiple instances
# In future: get from Upstash console > REST API > REDIS_URL
# REDIS_URL=redis://default:<password>@<host>:<port>

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=<32-char-hex>
JWT_REFRESH_SECRET=<32-char-hex>

# Groq: copy from console.groq.com > API Keys
GROQ_API_KEY=gsk_...

# Google OAuth (optional): create at console.cloud.google.com > Credentials
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

# These work as-is for local dev
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
API_URL=http://localhost:4000
```

**`client/.env.local` — two variables, both point to the backend:**

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 3. Run in development

```bash
npm run dev
# Frontend → http://localhost:3000
# Backend  → http://localhost:4000
# API Docs → http://localhost:4000/api/docs
```

Or run individually:

```bash
npm run dev --workspace=client   # Frontend only
npm run dev --workspace=server   # Backend only
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| MongoDB connection error | Whitelist your IP in Atlas → Network Access → Add IP |
| Socket.IO fails in browser | Check `NEXT_PUBLIC_SOCKET_URL` matches the running backend port |
| Port 3000/4000 in use | `npx kill-port 3000 4000` |
| Tests failing after env change | `npm run test -- --clearCache` |

---

## Design Decisions

### 1. Y.js CRDT instead of Operational Transformation

The central architecture question for any collaborative editor is: how do you merge concurrent edits?

| | OT (Google Docs approach) | CRDT (CollabDocs) |
|---|---|---|
| Conflict resolution | Server serialises all ops, transforms concurrent ones | Each client merges independently — always converges |
| Server role | Central arbiter required | Dumb relay — no conflict logic needed |
| Offline support | Hard — requires reconnect protocol | Built-in — merge on reconnect automatically |
| Horizontal scaling | Difficult without sticky sessions | Trivial — any server can relay any delta |

**Why CRDT:** The server becomes a dumb relay. It applies deltas to an in-memory `Y.Doc` and broadcasts them. No conflict resolution logic on the server means the backend is stateless enough to scale horizontally.

**How conflicts resolve in practice:**

```
Initial:  "Hello"
User A (offline): inserts " World" at pos 5  →  "Hello World"
User B (offline): inserts " There" at pos 5  →  "Hello There"

After sync: both clients converge to "Hello World There"
(peer ID ordering determines sequence — same result everywhere)
```

Insertions never destroy each other. Deletions become tombstones internally. Cursor positions are Y.js *relative positions* (anchored to a character identity, not an index), so remote edits never misplace your cursor.

---

### 2. JWT in memory + HttpOnly refresh cookies

Storing JWTs in `localStorage` means any XSS payload can exfiltrate them. The strategy here:

- **Access token (15 min)** — held in React state only. Never written to the DOM or storage. Lost on page refresh (by design).
- **Refresh token (7 days)** — stored in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. JavaScript cannot read it; the browser sends it automatically.

On page load the client silently calls `/api/auth/refresh` — the browser sends the cookie, the server returns a new access token in the JSON body. This gives the "stay logged in" UX without exposing credentials to JS.

---

### 3. Debounced MongoDB writes (5 s)

Naive approach: write to the database on every keystroke. At 5 chars/second, that's 300 writes/minute per active user.

CollabDocs instead keeps a per-room `Y.Doc` in memory and resets a 5-second debounce timer on every update. On expiry, one write happens. This bounds write amplification to **≤ 12 writes/minute regardless of typing speed** while keeping data loss risk to ≤ 5 seconds of edits.

---

### 4. Redis adapter for horizontal Socket.IO scaling *(planned)*

Socket.IO's in-process room registry breaks the moment you have more than one backend instance — a user on server A won't see events from server B.

The `@socket.io/redis-adapter` is already integrated in the codebase and activates automatically when `REDIS_URL` is set. Currently the app runs on a single Render instance (free tier), so Redis is not required. When scaling to multiple instances in the future, simply add a `REDIS_URL` env var — no code changes needed.

---

### 5. TipTap (ProseMirror) over Slate or Quill

TipTap has a first-class `y-prosemirror` binding for Y.js CRDT sync, and its extension system made building comments, suggestions mode, slash commands, and @mentions straightforward. Slate would have required building the Y.js binding from scratch. Quill is significantly more constrained for custom extensions.

---

## Testing

```bash
npm run test --workspace=server              # Run all tests + coverage report
npm run test:watch --workspace=server        # Watch mode
npm run test:ci --workspace=server           # CI mode (strict coverage threshold)
```

| Module | Coverage | Test Cases |
|--------|----------|-----------|
| Auth Routes | ~75% | 12 |
| Document Routes | ~72% | 15 |
| Comment Routes | ~65% | 10 |
| WebSocket Sync | ~45% | 8 |
| **Overall** | **~60%** | **45+** |

Tests cover: signup/login/refresh/logout, document CRUD and access control, comment creation/replies/resolution, Y.js CRDT concurrent edits and offline merges, rate limiting, and input validation.

See [server/TESTING.md](server/TESTING.md) for the full testing guide.

---

## API Reference

Interactive Swagger UI available at `http://localhost:4000/api/docs` when the server is running.

**Key endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Create account |
| `POST` | `/api/auth/login` | Login, receive access token + refresh cookie |
| `GET` | `/api/auth/me` | Current user profile |
| `POST` | `/api/auth/refresh` | Exchange refresh cookie for new access token |
| `GET` | `/api/documents` | List owned + shared documents |
| `POST` | `/api/documents` | Create document |
| `GET` | `/api/documents/:id` | Get document content |
| `PATCH` | `/api/documents/:id` | Update title |
| `DELETE` | `/api/documents/:id` | Soft-delete (trash) |
| `POST` | `/api/documents/:id/share` | Generate share link |
| `GET` | `/api/versions/:docId` | List document versions |
| `POST` | `/api/versions/:docId` | Save named snapshot |
| `POST` | `/api/comments` | Add inline comment |
| `GET` | `/api/comments/:docId` | List comments |
| `PATCH` | `/api/comments/:id/resolve` | Resolve comment |
| `POST` | `/api/ai/assist` | AI writing assistance |
| `POST` | `/api/export/:id/pdf` | Export as PDF |
| `POST` | `/api/export/:id/docx` | Export as DOCX |

**WebSocket events (Socket.IO):**

| Event | Direction | Description |
|-------|-----------|-------------|
| `doc:join` | client → server | Join a document room |
| `yjs:sync` | server → client | Full Y.Doc state on join |
| `yjs:update` | bidirectional | Binary Y.js delta (keystroke) |
| `doc:awareness` | bidirectional | Cursor position + user presence |
| `doc:saved` | server → client | Persistence confirmation |

See [server/API.md](server/API.md) for curl examples and full schema documentation.

---

## Security

- **JWT strategy** — Access tokens in memory (not `localStorage`), refresh tokens in `HttpOnly` cookies — XSS cannot exfiltrate credentials.
- **Rate limiting** — Auth endpoints: 5 req/15 min. AI endpoint: 30 req/hour per user.
- **Input validation** — Email format, password strength (configurable), display name length, document title, comment body, AI input length.
- **Helmet.js** — Strict Content Security Policy, X-Frame-Options, HSTS, and other security headers.
- **bcryptjs** — Passwords hashed with 12 salt rounds.
- **CORS** — Restricted to configured `CLIENT_URL` origin.
- **Environment validation** — Server refuses to start if required secrets are missing or too short.

See [SECURITY.md](SECURITY.md) for threat model, hardening checklist, and incident reporting.

---

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import the repo in Vercel, set root to `client`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`
4. Add: `NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com`

### Backend → Render

1. Create a new Web Service, connect the GitHub repo
2. Set **Root Directory** to `server`
3. Build command: `npm install && npm run build`
4. Start command: `npm run start`
5. Add all variables from `server/.env.example` (MongoDB URI, JWT secrets, etc.) — `REDIS_URL` is optional

**Production env checklist:**

```bash
# Generate strong JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

NODE_ENV=production
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, code standards, and the PR process.

Key commands:

```bash
npm run type-check          # TypeScript validation (both workspaces)
npm run lint                # ESLint
npm run test --workspace=server   # Run tests
```

Pre-commit hooks (Husky + lint-staged) run ESLint and Prettier automatically.

---

## License

MIT — see [LICENSE](LICENSE).
