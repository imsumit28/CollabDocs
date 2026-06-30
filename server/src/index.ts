import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './models/db';
import { logger } from './utils/logger';
import { initSocket, flushAllRooms } from './socket';
import { swaggerSpec } from './swagger';
import { validateEnvVars, warnMissingOptionalVars } from './utils/envValidation';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import versionRoutes from './routes/versions';
import aiRoutes from './routes/ai';
import exportRoutes from './routes/export';
import commentRoutes from './routes/comments';
import notificationRoutes from './routes/notifications';
import folderRoutes from './routes/folders';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
dotenv.config(envPath ? { path: envPath, override: true } : { override: true });

const app = express();
const server = http.createServer(app);

// In production we run behind a reverse proxy (Render/Railway/Nginx/etc.).
// Trusting the first proxy hop lets express-rate-limit key off the real client
// IP via X-Forwarded-For and lets `secure` cookies detect HTTPS correctly.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
// HTTP request logging via pino. Quiet under test; /health is logged at trace
// so the self-ping and uptime probes don't flood the logs.
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check — reports DB connectivity so load balancers / uptime monitors
// can tell a live-but-degraded instance (DB down) from a healthy one.
app.get('/health', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation (Swagger/OpenAPI)
app.use('/api/swagger', swaggerUi.serve);
app.get('/api/swagger', swaggerUi.setup(swaggerSpec, { swaggerOptions: { persistAuthorization: true } }));
app.get('/api/swagger/swagger.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Routes
app.use('/api/auth', authRoutes as any);
app.use('/api/docs', documentRoutes as any);
app.use('/api/versions', versionRoutes as any);
app.use('/api/ai', aiRoutes as any);
app.use('/api/export', exportRoutes as any);
app.use('/api/comments', commentRoutes as any);
app.use('/api/notifications', notificationRoutes as any);
app.use('/api/folders', folderRoutes as any);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
// ─── Self-Ping to prevent Render free-tier spin-down ─────────────────────────
// Render spins down the server after 15 min of inactivity on the free tier.
// This pings our own /health endpoint every 14 minutes to keep it alive.
function startSelfPing() {
  const RENDER_URL = process.env.API_URL || `http://localhost:${PORT}`;
  const pingUrl = `${RENDER_URL}/health`;

  const ping = () => {
    const client = pingUrl.startsWith('https') ? https : http;
    client.get(pingUrl, (res) => {
      logger.debug({ statusCode: res.statusCode }, '[Self-Ping] /health');
    }).on('error', (err) => {
      logger.warn({ err: err.message }, '[Self-Ping] Failed');
    });
  };

  // Wait 30s after startup before first ping, then every 14 minutes
  setTimeout(() => {
    ping();
    setInterval(ping, 14 * 60 * 1000); // every 14 minutes
  }, 30_000);

  logger.info({ pingUrl }, '[Self-Ping] Scheduled every 14 min');
}

// ─── Graceful shutdown ───────────────────────────────────────────────────────
// On deploy/restart, persist every open document room before exiting so edits
// made within the last debounce window aren't lost, then close cleanly.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, '[shutdown] received — flushing open documents…');
  try {
    await flushAllRooms();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    logger.info('[shutdown] Clean exit');
  } catch (err) {
    logger.error({ err }, '[shutdown] Error during shutdown');
  } finally {
    process.exit(0);
  }
}
async function start() {
  validateEnvVars();
  warnMissingOptionalVars();
  await connectDB();
  initSocket(server);
  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'CollabDocs server running');
    startSelfPing(); // start pinging after server is up
  });
}

// Don't launch the server or register signal handlers under Jest — importing
// this module in tests should only build the Express app (for supertest).
if (!process.env.JEST_WORKER_ID) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  start().catch((err) => logger.error({ err }, 'Failed to start server'));
}

export default app;
