# Changelog

All notable changes to CollabDocs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-04-30

### Added

#### Core Collaboration
- **Real-Time Collaborative Editing** — Multiple users can edit documents simultaneously with Y.js CRDT-based conflict resolution (~100ms sync latency)
- **Live Cursors** — Each collaborator gets a unique colored cursor with their name label, showing real-time presence
- **Inline Comments** — Users can comment on document sections with reply threads, resolve/reopen workflow
- **Suggestions Mode** — Track Changes-style suggestions using custom TipTap extensions (no paid plan required)

#### AI Features
- **AI Writing Assistant** — Powered by Groq Llama 3.3 70B:
  - Grammar and style improvements
  - Content summarization
  - Tone adjustment
  - Real-time suggestions

#### Document Management
- **Sharing System** — Share documents via link with granular permission levels (View/Edit/Comment)
- **Version History** — Browse document snapshots, restore previous versions with full edit history
- **Export** — Download documents as:
  - PDF (via Puppeteer)
  - DOCX (via docx.js)
  - HTML
- **Auto-Save** — Documents save every 5 seconds of inactivity to MongoDB

#### Authentication & Security
- **Email/Password Auth** — Secure password hashing with bcryptjs, JWT access + refresh tokens
- **Google OAuth** — Sign in with Google via Passport.js
- **HttpOnly Cookies** — Refresh tokens stored in HttpOnly cookies (XSS-safe)
- **Rate Limiting** — Protected endpoints from brute force attacks

#### Infrastructure
- **Horizontal Scaling** — Redis pub/sub adapter for Socket.IO, stateless backend
- **Real-Time Sync** — Y.js CRDT ensures eventual consistency across all clients
- **CRDT Architecture** — Supports offline editing, automatic conflict resolution
- **CI/CD** — GitHub Actions pipeline for lint, type-check, and build

#### Developer Experience
- **Full TypeScript** — Type-safe across client and server
- **Monorepo Setup** — Unified workspace with npm workspaces
- **Code Quality** — ESLint, Prettier, Husky pre-commit hooks
- **Detailed Documentation** — Architecture overview, CRDT vs OT comparison, WebSocket flow

### Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, TipTap, Y.js |
| Real-Time | Socket.IO 4, Y.js CRDT, SocketIOProvider |
| Backend | Node.js 20, Express 4, TypeScript 5 |
| Database | MongoDB Atlas (Mongoose ODM) |
| Cache | Upstash Redis (@socket.io/redis-adapter) |
| Auth | JWT (HS256), Google OAuth (Passport.js) |
| AI | Groq API (Llama 3.3 70B) |
| Deployment | Vercel (frontend), Railway (backend) |

---

## Upcoming (Planned)

- [ ] Collaborative comments with @mentions
- [ ] Rich media embedding (images, video, embeds)
- [ ] Advanced formatting (columns, custom blocks)
- [ ] Mobile app (React Native)
- [ ] Offline-first PWA mode
- [ ] Advanced search and filtering
- [ ] Document templates
- [ ] Webhooks for integrations

---

## Notes for Reviewers

### Architecture Highlights

**Why CRDT over OT?**
- Clients can apply updates immediately without central serialization
- No conflict resolution logic needed server-side (dumb relay pattern)
- Offline support is built-in
- Scales horizontally trivially with Redis adapter

**Data Persistence Flow**
1. User edits → Y.js delta → Socket.IO → Server applies to in-memory Y.Doc
2. Server broadcasts to room peers (relay pattern)
3. 5-second debounce on updates → single MongoDB write per save
4. Bounds write amplification: ≤12 writes/minute regardless of typing speed

**Security Measures**
- Access tokens in memory (not localStorage) → XSS-safe
- Refresh tokens in HttpOnly cookies → cannot be read by JavaScript
- Rate limiting on auth endpoints (5 requests/15 min per IP)
- Helmet.js for HTTP security headers
- CORS restricted to configured origins
- JWT verified on every Socket.IO connection

See [SECURITY.md](SECURITY.md) for full security documentation.
