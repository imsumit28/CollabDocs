# CollabDocs

[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen?logo=mongodb)](https://mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)](https://socket.io)
[![CI](https://github.com/yourusername/collabdocs/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/collabdocs/actions)

> A real-time collaborative document editor built from scratch — think Google Docs with AI writing assistance, live cursors, and version history. Built with Next.js, Node.js, Socket.IO, Y.js CRDT, and Groq AI.

**Live Demo: [collabdocs2026.vercel.app](https://collabdocs2026.vercel.app)** · **[GitHub](https://github.com/imsumit28/CollabDocs)**

---

## Features

**Collaboration**
-  **Real-Time Collaborative Editing** — Multiple users edit simultaneously via Y.js CRDT + Socket.IO. Changes propagate in ~100ms with no conflicts.
-  **Live Cursors** — Each collaborator gets a unique colour cursor with their name label.
-  **Comments** — Inline comments with reply threads and resolve/reopen flow.
-  **Suggestions Mode** — A custom, free Track Changes-style mode built on open-source TipTap extensions. No paid Pro extension required.
-  **Version History** — Browse and restore past document snapshots.
-  **Auto-Save** — Documents save every 5 seconds of inactivity to MongoDB.

**User Features**
-  **AI Writing Assistant** — Improve writing, fix grammar, or summarise documents powered by Groq (Llama 3.3 70B).
-  **Sharing System** — Share via link with View or Edit permission levels.
-  **Export** — Download documents as PDF or DOCX.
-  **Authentication** — Email/password with JWT + Google OAuth via Passport.js.

**Production-Ready**
-  **Comprehensive Testing** — 45+ test cases covering auth, documents, comments, and real-time sync (~60% coverage).
-  **API Documentation** — Interactive Swagger/OpenAPI docs at `/api/docs` with examples.
-  **Security** — JWT auth, rate limiting, input validation, CORS, Helmet headers, XSS/CSRF protection.
-  **Type Safety** — Full TypeScript coverage with strict mode enabled.
-  **Professional Documentation** — Contributing guide, security practices, testing guide, deployment instructions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React, Tailwind CSS, TipTap (ProseMirror) |
| **Real-Time** | Socket.IO, Y.js CRDT, SocketIOProvider |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | MongoDB (Mongoose ODM) |
| **Auth** | JWT (HS256), Google OAuth (Passport.js) |
| **Cache/Scale** | Redis (Upstash), @socket.io/redis-adapter |
| **AI** | Groq API — Llama 3.3 70B (free tier) |
| **Hosting** | Vercel (frontend) + Render (backend) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB Atlas account (free tier)
- Upstash Redis account (free tier)
- Groq API key (free at console.groq.com)
- Google Cloud Console project (for OAuth)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/collabdocs.git
cd collabdocs

# Install all dependencies
npm install

# Set up environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env.local
# Edit both files with your credentials
```

### Running in Development

```bash
# Start both frontend and backend
npm run dev

# Or individually:
npm run dev --workspace=client   # http://localhost:3000
npm run dev --workspace=server   # http://localhost:4000
```

---

## Architecture Overview

CollabDocs is a three-tier web application using CRDT-based conflict-free synchronisation for real-time collaboration at scale.

```
/collabdocs
├── /client               # Next.js 14 frontend
│   ├── /app              # App Router pages
│   │   ├── (auth)/       # Login + Signup
│   │   ├── dashboard/    # Document list
│   │   └── doc/[id]/     # Editor page
│   ├── /components       # Shared UI components
│   ├── /contexts         # React Context (Auth)
│   └── /lib              # API client, Socket, Y.js provider
│
└── /server               # Node.js + Express backend
    ├── jest.config.js     # Test configuration
    ├── API.md             # Complete API reference
    ├── TESTING.md         # Testing guide
    ├── .env.example       # Environment variable documentation
    └── /src
        ├── /routes        # REST API (auth, docs, versions, ai, export)
        ├── /socket        # Socket.IO + Y.js sync engine
        ├── /models        # Mongoose schemas
        ├── /middleware    # JWT auth, rate limiting
        ├── /utils         # Helpers (JWT, validation, env validation)
        ├── /tests         # Jest test suites
        └── swagger.ts     # OpenAPI 3.0 specification
```

---

### WebSocket flow

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

1. **Auth** — JWT access token sent in Socket.IO handshake. Rejected sockets never reach event handlers.
2. **Join** — Server loads the serialised `Y.Doc` from MongoDB, applies it to an in-memory `Y.Doc` instance shared by all sockets in the room, then sends the full state to the joining client.
3. **Update relay** — Every keystroke produces a tiny binary Yjs delta. Server applies it to the in-memory `Y.Doc` and fans it out to all other room members with `socket.to(room).emit`. No round-trip serialisation.
4. **Persistence** — A 5-second debounce timer resets on every update. On expiry the server encodes the `Y.Doc` state and writes it to MongoDB as a `Buffer`. This bounds write amplification to ≤12 writes/minute regardless of typing speed.
5. **Disconnect cleanup** — Socket.IO auto-removes a socket from all rooms on disconnect. The handler iterates the rooms it had joined, re-broadcasts the updated presence list (deduplicated by user ID to handle multi-tab), and flushes + frees the `Y.Doc` if the room is now empty.

---

### Data sync strategy — CRDT vs OT

CollabDocs uses **Yjs** (CRDT) instead of Operational Transformation (OT).

| | OT (Google Docs) | CRDT (CollabDocs) |
|---|---|---|
| Conflict resolution | Server serialises all ops, transforms concurrent ones | Each client merges independently — always converges |
| Server role | Central arbiter required | Dumb relay — no conflict logic |
| Offline support | Hard — requires reconnect protocol | Built-in — merge on reconnect |
| Horizontal scaling | Difficult without sticky sessions | Trivial — Redis adapter for pub/sub fan-out |

### Conflict handling in detail

When two users type into the same position simultaneously:

```
Initial state: "Hello"

User A (offline): inserts " World" at position 5  →  "Hello World"
User B (offline): inserts " There" at position 5  →  "Hello There"

After sync (Yjs CRDT merge):
Both clients converge to "Hello World There" (or "Hello There World")
— determined by peer ID ordering, same result on every client, every time.
```

- **Insertions** never destroy each other's content.
- **Deletions** are marked as tombstones internally, so they don't corrupt remote insertions at the same position.
- **Cursor positions** are Yjs *relative positions* — anchored to a character identity, not an index — so remote edits don't misplace your cursor.

---

**Key design decision**: Y.js CRDT handles all merge conflicts on the client. The server is a dumb relay — it broadcasts Y.js diffs to room peers and persists binary state to MongoDB. No conflict resolution logic needed server-side.

**Collaboration note**: The suggestions/track-changes experience is implemented as a custom in-house extension path using free TipTap building blocks. It does not depend on TipTap Pro or any paid plan.

---

## Screenshots

| Dashboard | Editor | AI Panel |
|-----------|--------|----------|
| *(screenshot)* | *(screenshot)* | *(screenshot)* |

---

## Key Technical Insights

### Architectural Patterns
- **CRDT vs OT**: Y.js CRDT lets every client apply updates immediately without locking, making the architecture horizontally scalable from day one.
- **WebSocket scaling**: Redis pub/sub adapter for Socket.IO means adding more backend instances requires zero code changes — just a config update.
- **Stateless design**: JWT auth, CRDT sync, and Redis adapter work together to enable horizontal scaling without infrastructure changes.

### Production Readiness
- **Security-first approach**: Input validation, environment configuration, rate limiting, and CORS all configured at startup, with environment variable validation preventing misconfiguration.
- **Comprehensive testing**: 45+ test cases with ~60% coverage ensure critical paths (auth, documents, collaboration) work correctly before production.
- **Observable API**: Interactive Swagger documentation and comprehensive API reference make integration straightforward for other developers.
- **Professional practices**: Strict TypeScript, code quality tools (ESLint, Prettier), GitHub templates, and contribution guidelines establish confidence in code quality.

### Security Best Practices
- **JWT tokens**: Access tokens in memory (not localStorage), refresh tokens in HttpOnly cookies — prevents XSS from stealing auth credentials.
- **Configurable validation**: Email, password, and input length validation all configurable via environment, allowing different security postures for dev/staging/production.

---

## Testing & Quality Assurance

### Test Coverage

CollabDocs includes comprehensive test suites covering critical functionality:

```bash
npm run test --workspace=server              # Run all tests with coverage
npm run test:watch --workspace=server        # Watch mode for development
npm run test:ci --workspace=server           # CI mode
```

**Test Coverage by Module:**
| Module | Coverage | Test Cases |
|--------|----------|-----------|
| Auth Routes | ~75% | 12 test cases |
| Document Routes | ~72% | 15 test cases |
| Comment Routes | ~65% | 10 test cases |
| WebSocket Sync | ~45% | 8 test cases |
| **Overall** | **~60%** | **45+ tests** |

**What's Tested:**
- User signup, login, token refresh, logout
- Document CRUD, access control, trash management
- Comment creation, replies, resolution
- Real-time sync (Y.js CRDT, concurrent edits, offline merging)
- Rate limiting, validation, error handling

See [TESTING.md](server/TESTING.md) for detailed testing guide.

### Code Quality

- **TypeScript** with strict mode and full type coverage
- **ESLint** for code standards
- **Prettier** for consistent formatting
- **Husky** for pre-commit hooks

```bash
npm run type-check                           # TypeScript validation
npm run lint                                 # ESLint
npm run format                               # Prettier formatting
```

---

## API Documentation

CollabDocs provides interactive API documentation via Swagger/OpenAPI:

```bash
npm run dev --workspace=server
# Open http://localhost:4000/api/docs in your browser
```

**API Coverage:**
- **25+ endpoints** fully documented
- **Request/response examples** with JSON
- **Authentication requirements** (JWT Bearer token, HttpOnly cookies)
- **Error codes** and meanings (400, 401, 403, 404, 429, 500)
- **Rate limiting** details per endpoint
- **WebSocket events** with payload schemas

**Documents:**
- **[API.md](server/API.md)** — Complete REST API reference with curl examples
- **[/api/docs](http://localhost:4000/api/docs)** — Interactive Swagger UI (requires running server)
- **[/api/docs/swagger.json](http://localhost:4000/api/docs/swagger.json)** — OpenAPI 3.0 specification

---

## Security

CollabDocs is built with security as a first-class concern:

### Security Features

- **JWT Authentication** — Access tokens in memory, refresh tokens in HttpOnly cookies
- **Password Strength** — Configurable requirements (min length, uppercase, numbers, special chars)
- **Input Validation** — Email, password, display name, document title, comments, AI input
- **MongoDB ObjectId Validation** — Prevents invalid document access
- **Rate Limiting** — Auth (5 req/15min), Signup (5 req/15min), AI (30 req/hour per user)
- **CORS Configuration** — Restricted to configured origins
- **Helmet.js** — Security headers (CSP, X-Frame-Options, etc.)
- **bcryptjs** — Password hashing (12 salt rounds)
- **Environment Validation** — Critical variables validated at server startup
- **XSS Protection** — HTML escaping, Content Security Policy
- **CSRF Protection** — SameSite cookie configuration

### Deployment Checklist

Before deploying to production:

```bash
# Generate strong JWT secrets (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Enable strict password requirements
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL_CHARS=true

# Set NODE_ENV to production
NODE_ENV=production

# Configure Redis for distributed sessions
REDIS_URL=redis://:password@host:port

# Enable HTTPS in production (via load balancer/reverse proxy)
```

See [SECURITY.md](SECURITY.md) for threat model, incident reporting, and detailed security practices.

---

## Development & Contributing

### Quick Start for Development

```bash
# Install dependencies
npm install

# Create environment files
cp server/.env.example server/.env
cp client/.env.example client/.env.local
# Edit with your API keys and configuration

# Start development server
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:4000
# API Docs: http://localhost:4000/api/docs
```

### Project Documentation

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Development setup, coding standards, git workflow, PR process
- **[TESTING.md](server/TESTING.md)** — Testing guide with examples and best practices
- **[CHANGELOG.md](CHANGELOG.md)** — Feature history and version releases
- **[SECURITY.md](SECURITY.md)** — Security practices, threat model, incident reporting

### GitHub Templates

Professional issue and PR templates included:
- `.github/ISSUE_TEMPLATE/bug_report.md` — Bug report template
- `.github/ISSUE_TEMPLATE/feature_request.md` — Feature request template
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template with checklist

---

## What This Demonstrates

This project showcases understanding of:

**Full-Stack Development**
- Frontend: Next.js 14, React, TailwindCSS, real-time state management
- Backend: Node.js, Express, WebSockets, API design
- Database: MongoDB with Mongoose ODM, data modeling
- Real-time: Y.js CRDT, Socket.IO, distributed state sync

**Production Engineering**
- Testing: Jest unit tests, integration tests, test utilities, ~60% coverage
- Security: JWT auth, rate limiting, input validation, environment hardening
- Documentation: Swagger/OpenAPI, README, CONTRIBUTING, SECURITY guides
- Code quality: TypeScript strict mode, ESLint, Prettier, pre-commit hooks

**System Design**
- Conflict-free synchronisation (CRDT) for multi-user editing without merge conflicts
- Horizontal scalability via stateless services and Redis pub/sub
- Debounce strategy for write amplification control (~12 writes/min regardless of typing speed)
- Permission and access control patterns

**Software Engineering Practices**
- Clean architecture with separation of concerns (routes, models, middleware, utils)
- Type safety with TypeScript throughout
- Professional documentation and contribution guidelines
- GitHub workflow with templates and CI/CD readiness
- Error handling, validation, and security as first-class concerns

---

## Deployment

- **Frontend**: Deploy `/client` to Vercel via GitHub integration. Set `NEXT_PUBLIC_API_URL` in Vercel dashboard.
- **Backend**: Deploy `/server` to Render. Connect your GitHub repo, set root directory to `server`, add all backend env vars.

📋 **See [Task Breakdown](./task_breakdown.md#11-deployment--devops)** for detailed step-by-step deployment instructions, infrastructure setup, and CI/CD configuration.

---

## License

MIT
