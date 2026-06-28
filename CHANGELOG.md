# Changelog

All notable changes to CollabDocs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-28

A large reliability, security, and feature release. Several APIs changed in
backward-incompatible ways (see **Changed / Breaking**), so this is a major bump.

### Added

#### Document organization & discovery
- **Folders** — Organize documents into folders from the dashboard sidebar (create / rename / delete, with live per-folder document counts). Move docs in/out from the card menu; deleting a folder keeps its documents (they return to root).
- **Server-side search** — Full-text search across your documents by **title and content** (a plain-text mirror is kept in sync on every save). Includes a one-off backfill script (`npm run backfill:search`) to index documents created before this feature.
- **List pagination** — `GET /api/documents` supports an optional `?page=&limit=` envelope; the dashboard renders documents incrementally with a "Load more" control.

#### Collaboration
- **Invite collaborators by email** — Add people by email with View/Edit permission, manage them in a "People with access" panel available from **both the editor and the dashboard** Share modal.
- **In-app notifications** — A notification bell for shares, comments, and @mentions — including `@username` typed directly in the document body — with unread badge and mark-as-read.

#### AI
- **Streaming responses** — AI actions stream in token-by-token (`?stream=1`).
- **Expanded actions** — improve, grammar, summarize, expand, simplify, tone, translate, outline, brainstorm, and title generation.

#### Accounts & auth
- **Password reset** — Forgot/reset password flow with hashed, single-use, 1-hour tokens that revoke other sessions.
- **Account settings** — Update profile (name, username, avatar) and change password from a dedicated settings page.
- **Optional email-verification enforcement** at login (gated by `REQUIRE_EMAIL_VERIFICATION`, off by default).

#### Offline / PWA
- **Installable PWA** with a service worker (app-shell caching + offline fallback page) and **offline editing** via Y.js + IndexedDB that merges automatically on reconnect.

#### Production-readiness & DX
- **Structured logging** with pino (leveled JSON in prod, pretty in dev, secret redaction, HTTP request logging, `LOG_LEVEL`).
- **Graceful shutdown** that flushes open document rooms on SIGTERM/SIGINT, and a **DB-aware `/health`** check (503 when the database is down).
- **CI pipeline** (GitHub Actions): type-check, lint, server tests, client tests, build, and Playwright E2E.
- **Tests**: 173 server tests (~70% coverage) against an in-memory MongoDB, client component tests (Jest + React Testing Library), and browser E2E (Playwright, API-mocked — no backend/DB needed).

### Changed / Breaking
- **Collaborator API is now email-based.** `POST /api/documents/:id/collaborators` takes `{ email, permission }` (and `DELETE …/collaborators/:userId`), replacing the previous userId-based endpoint.
- **Share-link socket access requires a token.** `doc:join` now verifies a share token for link-based access by non-collaborators, and view-only participants can no longer write.
- **AI endpoints are per-action** (`/api/ai/{improve,grammar,summarize,…}`); the previous generic assist endpoint was removed.
- **Logging migrated from `morgan` to `pino`** — log output format changed (the `morgan` dependency was removed).

### Fixed
- **Comment authorization (IDOR).** Comment routes now enforce per-document access — previously any authenticated user could read or modify comments on any document.
- **Input validation is now actually applied.** The validation layer was previously dead code; it is now wired into auth, documents, comments, folders, and AI routes (including AI input-length limits).
- **Test harness repaired.** The suite now runs against an in-memory MongoDB and passes offline and in CI (previously it never connected to a database).

### Security
- Per-document access control on comments and document reads.
- Constant-time share-token comparison; tokenized link access with view-only write gating.
- Password-reset tokens are hashed, single-use, expire in 1 hour, and bump `tokenVersion` to log out other sessions.
- AI input-length limits (cost / DoS protection) and secret redaction in logs.

### Upgrading from 1.0.0
- After deploying, run `npm run backfill:search` (in `server/`) once so existing documents become searchable by content.
- New optional env vars: `LOG_LEVEL`, `REQUIRE_EMAIL_VERIFICATION` (see `server/.env.example`).
- API consumers using the old userId-based collaborator endpoint or the generic AI assist endpoint must migrate (see **Changed / Breaking**).

## [1.0.0] - 2025-04-30

### Added

#### Core Collaboration
- **Real-Time Collaborative Editing** — Multiple users can edit documents simultaneously with Y.js CRDT-based conflict resolution (~100ms sync latency)
- **Live Cursors** — Each collaborator gets a unique colored cursor with their name label, showing real-time presence
- **Inline Comments** — Users can comment on document sections with reply threads, resolve/reopen workflow
- **Suggestions Mode** — Track Changes-style suggestions using custom TipTap extensions (no paid plan required)

#### AI Features
- **AI Writing Assistant** — Powered by DeepSeek (OpenAI-compatible API):
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
| AI | DeepSeek API (OpenAI-compatible) |
| Deployment | Vercel (frontend), Render (backend) |

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
