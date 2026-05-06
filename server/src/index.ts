import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './models/db';
import { initSocket } from './socket';
import { swaggerSpec } from './swagger';
import { validateEnvVars, warnMissingOptionalVars } from './utils/envValidation';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import versionRoutes from './routes/versions';
import aiRoutes from './routes/ai';
import exportRoutes from './routes/export';
import commentRoutes from './routes/comments';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
dotenv.config(envPath ? { path: envPath, override: true } : { override: true });

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
// ─── Self-Ping to prevent Render free-tier spin-down ─────────────────────────
// Render spins down the server after 15 min of inactivity on the free tier.
// This pings our own /health endpoint every 10 minutes to keep it alive.
function startSelfPing() {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const pingUrl = `${RENDER_URL}/health`;

  const ping = () => {
    const client = pingUrl.startsWith('https') ? https : http;
    client.get(pingUrl, (res) => {
      console.log(`[Self-Ping] /health → ${res.statusCode}`);
    }).on('error', (err) => {
      console.warn(`[Self-Ping] Failed: ${err.message}`);
    });
  };

  // Wait 30s after startup before first ping, then every 10 minutes
  setTimeout(() => {
    ping();
    setInterval(ping, 10 * 60 * 1000); // every 10 minutes
  }, 30_000);

  console.log(`[Self-Ping] Scheduled every 10 min → ${pingUrl}`);
}

async function start() {
  validateEnvVars();
  warnMissingOptionalVars();
  await connectDB();
  initSocket(server);
  server.listen(PORT, () => {
    console.log(`CollabDocs server running on port ${PORT}`);
    startSelfPing(); // start pinging after server is up
  });
}

start().catch(console.error);

export default app;
