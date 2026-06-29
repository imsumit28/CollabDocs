# Deployment

CollabDocs deploys as two services: the **Next.js frontend on Vercel** and the **Express + Socket.IO backend on Render**. Both deploy directly from GitHub with zero custom CI config.

> For local development setup, see [QUICK_START.md](./QUICK_START.md).

---

## Frontend → Vercel

1. Push to GitHub.
2. Import the repo in Vercel, set the **root** to `client`.
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`
4. Add: `NEXT_PUBLIC_SOCKET_URL=https://your-backend.onrender.com`

Vercel auto-detects Next.js — no build command override needed.

---

## Backend → Render

1. Create a new **Web Service** and connect the GitHub repo.
2. Set **Root Directory** to `server`.
3. **Build command:** `npm install && npm run build`
4. **Start command:** `npm run start`
5. Add all variables from `server/.env.example` (MongoDB URI, JWT secrets, etc.). `REDIS_URL` is optional — see the scaling note in [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md#4-single-instance-real-time-with-a-redis-adapter-for-event-fan-out).

---

## Production environment checklist

Generate strong JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Recommended production settings:

```bash
NODE_ENV=production
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
REQUIRE_EMAIL_VERIFICATION=true   # once SMTP_* is configured
```

---

## Operational notes

- **Graceful shutdown** — On `SIGTERM`/`SIGINT` the server persists every open document room before exiting, so edits within the 5-second debounce window survive a deploy/restart.
- **Health checks** — `/health` returns `503` when the database is unreachable, so Render's health checks and external uptime monitors can detect a degraded instance.
- **Single instance** — The free-tier deployment runs one backend instance, which is the configuration the real-time engine is correct for. Do **not** scale the backend to multiple instances without a shared Y.js sync layer or per-document sticky routing (see [Design Decision 4](./DESIGN_DECISIONS.md#4-single-instance-real-time-with-a-redis-adapter-for-event-fan-out)).
