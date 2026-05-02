# CollabDocs Quick Start Guide

Everything you need to get CollabDocs running and explore what's been built.

## First Time Setup (5 minutes)

```bash
# Clone and install
git clone https://github.com/yourusername/collabdocs.git
cd collabdocs
npm install

# Setup environment
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Edit with your credentials (see env files for instructions)
# - MongoDB Atlas (free)
# - Upstash Redis (free)
# - Groq API key (free)
# - Google OAuth credentials

# Start both servers
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:4000
# API Docs: http://localhost:4000/api/docs
```

---

## Key Documentation

| Document | Purpose |
|----------|---------|
| **[README.md](README.md)** | Project overview, features, architecture |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | How to contribute, code standards, testing |
| **[SECURITY.md](SECURITY.md)** | Security practices and threat model |
| **[CHANGELOG.md](CHANGELOG.md)** | Version history and features |
| **[server/API.md](server/API.md)** | Complete REST API reference |
| **[server/TESTING.md](server/TESTING.md)** | Testing guide and examples |
| **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** | What's been added (this phase) |

---

## Testing (Run Locally)

```bash
# Install test dependencies
npm install

# Run tests with coverage
npm run test --workspace=server

# Watch mode (auto-rerun on changes)
npm run test:watch --workspace=server

# View coverage report
# Open server/coverage/lcov-report/index.html in browser
```

**What's tested:**
- Auth (signup, login, logout, refresh)
- Documents (CRUD, sharing, permissions)
- Comments (create, reply, resolve)
- WebSocket sync (Y.js CRDT)

---

## API Documentation

### Interactive Swagger UI
```bash
npm run dev --workspace=server
# Open http://localhost:4000/api/docs
```

### Key Endpoints

**Auth:**
- `POST /api/auth/signup` — Create account
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user

**Documents:**
- `GET /api/documents` — List your documents
- `POST /api/documents` — Create document
- `POST /api/documents/:id/share` — Share with link

**Comments:**
- `POST /api/comments` — Add comment
- `GET /api/comments/:docId` — List comments
- `PATCH /api/comments/:id/resolve` — Resolve comment

**WebSocket:**
- Real-time sync via Socket.IO
- Y.js CRDT for conflict-free editing
- Automatic presence (cursors)

See [server/API.md](server/API.md) for complete reference.

---

## Project Structure

```
collabdocs/
├── client/                    # Next.js 14 frontend
│   ├── app/                   # App router pages
│   ├── components/            # React components
│   └── lib/                   # API client, Socket.IO
│
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── routes/            # REST endpoints
│   │   ├── models/            # Mongoose schemas
│   │   ├── socket/            # WebSocket + Y.js
│   │   ├── middleware/        # Auth, rate limiting
│   │   └── __tests__/         # Jest tests
│   └── API.md                 # API documentation
│
├── .github/                   # GitHub config
│   ├── workflows/ci.yml       # CI/CD pipeline
│   └── ISSUE_TEMPLATE/        # Issue templates
│
├── CONTRIBUTING.md            # Contribution guide
├── SECURITY.md                # Security practices
├── CHANGELOG.md               # Version history
├── IMPLEMENTATION_SUMMARY.md  # What's been added
└── README.md                  # Main documentation
```

---

## Key Features Explained

### Real-Time Collaboration
- **Y.js CRDT**: Conflict-free replicated data type
  - No server serialization needed
  - Each client applies updates immediately
  - Automatic offline support
  - ~100ms sync latency

### Security
- **JWT Tokens**: Access token in memory (XSS-safe)
- **HttpOnly Cookies**: Refresh tokens cannot be stolen
- **Rate Limiting**: Brute-force protection
- **OAuth**: Google sign-in option
- **Password**: Hashed with bcryptjs (10 rounds)

### Scalability
- **Redis Adapter**: Horizontal scaling with Socket.IO
- **Stateless Backend**: Every instance is interchangeable
- **Debounced Saves**: 5s debounce bounds writes to ~12/min

---

## Common Commands

```bash
# Development
npm run dev                      # Start both servers
npm run dev --workspace=server   # Backend only
npm run dev --workspace=client   # Frontend only

# Testing
npm run test --workspace=server              # Run tests
npm run test:watch --workspace=server        # Watch mode
npm run test -- --testNamePattern="auth"     # Specific tests

# Code Quality
npm run type-check --workspace=server    # TypeScript check
npm run lint --workspace=server          # Lint + fix
npm run lint --workspace=client          # Client linting

# Building
npm run build --workspace=server   # Build server
npm run build --workspace=client   # Build client (Next.js)

# Production
npm run start --workspace=server   # Start production server
npm run start --workspace=client   # Start Next.js prod
```

---

## Deployment

### Frontend (Vercel)
```bash
# 1. Push to GitHub
git push origin main

# 2. Connect to Vercel (automatic with GitHub)
# 3. Set env var: NEXT_PUBLIC_API_URL=https://api.collabdocs.app
```

### Backend (Render)
```bash
# 1. Create Render service
# 2. Connect GitHub repo
# 3. Set root directory: server
# 4. Add all env variables (MONGODB_URI, JWT_*, etc.)
# 5. Render auto-deploys on git push
```

See [README.md](README.md) for detailed deployment steps.

---

## Project Statistics

- **Frontend**: ~2000 lines (Next.js, React, TipTap)
- **Backend**: ~1500 lines (Express, Mongoose, Socket.IO)
- **Tests**: ~950 lines (Jest, Supertest)
- **Docs**: ~2000 lines (API, Contributing, Security)
- **Total**: ~7000 lines of production-ready code

---

## Learning Resources

### Architecture
- [README Architecture Section](README.md#architecture-overview)
- [WebSocket Flow Diagram](README.md#websocket-flow)
- [CRDT vs OT Comparison](README.md#data-sync-strategy--crdt-vs-ot)

### Testing
- [Testing Guide](server/TESTING.md)
- [Auth Test Examples](server/src/__tests__/routes/auth.test.ts)
- [Document Test Examples](server/src/__tests__/routes/documents.test.ts)

### Security
- [Security Practices](SECURITY.md)
- [JWT Best Practices](SECURITY.md#authentication)
- [Rate Limiting Details](SECURITY.md#rate-limiting)

### API
- [Complete API Reference](server/API.md)
- [Swagger UI](http://localhost:4000/api/docs) (when running)
- [Error Handling](server/API.md#error-response-format)

---

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000 (frontend)
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 4000 (backend)
lsof -i :4000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### MongoDB Connection Error
- Ensure MongoDB Atlas account is created
- Whitelist your IP in MongoDB Atlas → Network Access
- Check `MONGODB_URI` in `server/.env`

### Redis Connection Error
- Ensure Upstash Redis account is created
- Copy correct `REDIS_URL` from Upstash console
- Check `REDIS_URL` in `server/.env`

### Tests Failing
```bash
# Clear Jest cache
npm run test -- --clearCache

# Run with verbose output
npm run test:watch -- --verbose
```

### Socket.IO Connection Fails
- Check browser console for errors
- Verify `NEXT_PUBLIC_SOCKET_URL` in `client/.env.local`
- Ensure backend is running on correct port
- Check CORS config in `server/src/index.ts`

---

## Next Steps

1. **Run locally**: `npm install && npm run dev`
2. **Explore API docs**: Open http://localhost:4000/api/docs
3. **Run tests**: `npm run test --workspace=server`
4. **Read CONTRIBUTING.md**: Understand dev workflow
5. **Deploy**: Follow deployment section in [README.md](README.md)

---

## Need Help?

- **Setup issues?** See CONTRIBUTING.md → Development Setup
- **API questions?** See server/API.md or http://localhost:4000/api/docs
- **Security concerns?** See SECURITY.md
- **Contributing?** See CONTRIBUTING.md
- **Bug report?** Use .github/ISSUE_TEMPLATE/bug_report.md

---

**Last updated:** 2025-04-30

**Status:** Production-ready with comprehensive tests and documentation!
