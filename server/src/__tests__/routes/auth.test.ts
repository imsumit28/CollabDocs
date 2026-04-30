import request from 'supertest';
import express, { Express } from 'express';
import authRoutes from '../../routes/auth';
import { User } from '../../models';
import { createTestUser, loginUser, cleanupTestDB, generateAccessToken } from '../helpers';
import cookieParser from 'cookie-parser';

describe('Auth Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRoutes);
  });

  afterEach(async () => {
    await cleanupTestDB();
  });

  describe('POST /signup', () => {
    it('should create a new user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePassword123',
          displayName: 'New User',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toEqual(expect.objectContaining({
        email: 'newuser@example.com',
        displayName: 'New User',
        emailVerified: false,
      }));
    });

    it('should reject signup with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          // missing password
          displayName: 'Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject signup with short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'short',
          displayName: 'Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 8');
    });

    it('should reject duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'Password123',
          displayName: 'User 1',
        });

      // Try to create another with same email
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'Password456',
          displayName: 'User 2',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Email already in use');
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      await createTestUser(app);
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should set refresh token in HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
        });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie']?.[0] || '';
      expect(setCookie).toContain('refreshToken');
      expect(setCookie).toContain('HttpOnly');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid credentials');
    });
  });

  describe('POST /refresh', () => {
    it('should return new access token with valid refresh token', async () => {
      const { refreshToken: refreshCookie } = await createTestUser(app);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie || '');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject without refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('No refresh token');
    });
  });

  describe('POST /logout', () => {
    it('should clear refresh token cookie', async () => {
      const { refreshToken: refreshCookie } = await createTestUser(app);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', refreshCookie || '');

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie']?.[0] || '';
      expect(setCookie).toContain('refreshToken');
      expect(setCookie).toContain('Max-Age=0'); // Cleared
    });
  });

  describe('GET /me', () => {
    it('should return authenticated user data', async () => {
      const { user, accessToken } = await createTestUser(app);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({
        email: user.email,
        displayName: user.displayName,
      }));
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
