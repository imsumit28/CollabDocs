import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
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
app.use('/api/auth', authRoutes);
app.use('/api/docs', documentRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/comments', commentRoutes);

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

async function start() {
  validateEnvVars();
  warnMissingOptionalVars();
  await connectDB();
  initSocket(server);
  server.listen(PORT, () => {
    console.log(`CollabDocs server running on port ${PORT}`);
  });
}

start().catch(console.error);

export default app;
