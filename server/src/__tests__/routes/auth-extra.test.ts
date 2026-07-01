import request from 'supertest';
import express, { Express } from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import authRoutes from '../../routes/auth';
import { User } from '../../models';
import { createTestUser, generateAccessToken } from '../helpers';

// Mailer is mocked so nothing is actually sent; we assert it was invoked.
jest.mock('../../utils/mailer', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOAuthResetNoticeEmail: jest.fn().mockResolvedValue(undefined),
}));
import { sendVerificationEmail } from '../../utils/mailer';

describe('Auth Routes — email verification', () => {
  let app: Express;

  beforeAll(() => {
    process.env.CLIENT_URL = 'http://localhost:3000';
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRoutes);
  });

  afterEach(async () => {
    await User.deleteMany({});
    jest.clearAllMocks();
  });

  // ─── GET /verify-email/:token ────────────────────────────────────────────────
  describe('GET /verify-email/:token', () => {
    async function seedUnverified(rawToken: string, expiry: Date) {
      const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
      return User.create({
        email: 'verify@example.com',
        displayName: 'V',
        passwordHash: 'x',
        emailVerified: false,
        emailVerificationToken: hashed,
        emailVerificationExpiry: expiry,
      });
    }

    it('verifies the email and redirects to login?verified=1', async () => {
      const raw = 'a'.repeat(64);
      await seedUnverified(raw, new Date(Date.now() + 60_000));

      const res = await request(app).get(`/api/auth/verify-email/${raw}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:3000/login?verified=1');

      const user = await User.findOne({ email: 'verify@example.com' });
      expect(user!.emailVerified).toBe(true);
      expect(user!.emailVerificationToken).toBeNull();
    });

    it('redirects with an error for an unknown token', async () => {
      const res = await request(app).get('/api/auth/verify-email/not-a-real-token');
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/error=invalid-verification-token/);
    });

    it('rejects an expired token (does not verify)', async () => {
      const raw = 'b'.repeat(64);
      await seedUnverified(raw, new Date(Date.now() - 1000));
      const res = await request(app).get(`/api/auth/verify-email/${raw}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/error=invalid-verification-token/);
      const user = await User.findOne({ email: 'verify@example.com' });
      expect(user!.emailVerified).toBe(false);
    });
  });

  // ─── POST /resend-verification ───────────────────────────────────────────────
  describe('POST /resend-verification', () => {
    it('issues a fresh token and emails an unverified user', async () => {
      const { user } = await createTestUser(app, { email: 'resend@example.com' });
      const token = generateAccessToken(user.id);
      // signup already sent one verification email — reset so we count only resend.
      (sendVerificationEmail as jest.Mock).mockClear();

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if your email is unverified/i);
      expect(sendVerificationEmail as jest.Mock).toHaveBeenCalledTimes(1);
      const dbUser = await User.findOne({ email: 'resend@example.com' });
      expect(dbUser!.emailVerificationToken).toBeTruthy();
    });

    it('returns the generic message but sends nothing for an already-verified user', async () => {
      const { user } = await createTestUser(app, { email: 'already@example.com' });
      await User.updateOne({ email: 'already@example.com' }, { emailVerified: true });
      const token = generateAccessToken(user.id);
      (sendVerificationEmail as jest.Mock).mockClear();

      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(sendVerificationEmail as jest.Mock).not.toHaveBeenCalled();
    });

    it('requires authentication (401)', async () => {
      const res = await request(app).post('/api/auth/resend-verification');
      expect(res.status).toBe(401);
    });
  });

  // ─── Signup validation gaps ──────────────────────────────────────────────────
  describe('POST /signup validation', () => {
    it('rejects a malformed email (400)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'ValidPass123', displayName: 'X' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('email');
    });

    it('rejects a missing display name (400)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'ok@example.com', password: 'ValidPass123' });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('displayName');
    });

    it('normalizes an @username on signup', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'handle@example.com', password: 'ValidPass123', displayName: 'H', username: '@Cool Name!' });
      expect(res.status).toBe(201);
      expect(res.body.user.username).toBe('cool_name');
    });
  });
});
