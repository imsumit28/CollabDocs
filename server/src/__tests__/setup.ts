import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Load test environment variables (if a .env.test file is provided)
const envPath = path.resolve(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Always set safe test defaults — these never depend on a real .env
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-32-chars-minimum-okay';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-32-chars-minimum-okay';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
// Passport's GoogleStrategy throws on construction with an empty clientID, so
// provide harmless dummy OAuth credentials for the test environment.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';

// Suppress noisy console output during tests
global.console.log = jest.fn();
global.console.warn = jest.fn();

// ─── In-memory MongoDB ──────────────────────────────────────────────────────
// Spins up a real MongoDB instance in memory so tests run anywhere — offline,
// in CI, with no local mongod and no paid cluster required.
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

// Clean every collection between tests so suites don't leak state into each other
afterEach(async () => {
  if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});
