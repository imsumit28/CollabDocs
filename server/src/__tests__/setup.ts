import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load test environment variables
const envPath = path.resolve(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Set defaults for testing
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-chars-minimum-okay';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-minimum-okay';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/collabdocs-test';
  process.env.CLIENT_URL = 'http://localhost:3000';
}

// Suppress console logs during tests
global.console.log = jest.fn();
global.console.warn = jest.fn();
