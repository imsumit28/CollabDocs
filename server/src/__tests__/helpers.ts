import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

export async function createTestUser(app: Express, overrides = {}) {
  const userData = {
    email: 'test@example.com',
    password: 'TestPassword123',
    displayName: 'Test User',
    ...overrides,
  };

  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      email: userData.email,
      password: userData.password,
      displayName: userData.displayName,
    });

  return {
    user: res.body.user,
    accessToken: res.body.accessToken,
    refreshToken: res.headers['set-cookie']?.[0], // HttpOnly cookie
  };
}

export async function loginUser(app: Express, email: string, password: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return {
    user: res.body.user,
    accessToken: res.body.accessToken,
    refreshToken: res.headers['set-cookie']?.[0],
  };
}

export function generateAccessToken(userId: string, overrides = {}) {
  return jwt.sign(
    {
      sub: userId,
      email: 'test@example.com',
      displayName: 'Test User',
      ...overrides,
    },
    process.env.JWT_ACCESS_SECRET || 'test-secret',
    { expiresIn: '15m' }
  );
}

export function generateRefreshToken(userId: string, tokenVersion = 0) {
  return jwt.sign(
    { sub: userId, tokenVersion },
    process.env.JWT_REFRESH_SECRET || 'test-secret',
    { expiresIn: '7d' }
  );
}

export async function cleanupTestDB() {
  // Clean up test database after tests
  try {
    await User.deleteMany({});
  } catch (err) {
    // Database may not be connected in test
  }
}
