import request from 'supertest';
import express, { Express } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import authRoutes from '../../routes/auth';
import { User } from '../../models';
import { createTestUser, cleanupTestDB } from '../helpers';
import cookieParser from 'cookie-parser';
import { sendOAuthResetNoticeEmail } from '../../utils/mailer';

// Mock the mailer so no real email is dispatched and we can assert on which
// notification was chosen. Each fn resolves — the routes fire-and-forget with
// `.catch()`, so a non-promise return would throw.
jest.mock('../../utils/mailer', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOAuthResetNoticeEmail: jest.fn().mockResolvedValue(undefined),
}));

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
    jest.clearAllMocks();
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
      // clearCookie emits an empty value with an expiry in the past
      expect(setCookie).toContain('refreshToken=;');
      expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
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

  describe('PATCH /me - update profile', () => {
    it('updates display name, username, and avatar', async () => {
      const { accessToken } = await createTestUser(app, { email: 'profile@example.com' });
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ displayName: 'New Name', username: '@New User', avatarUrl: 'https://example.com/a.png' });

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('New Name');
      expect(res.body.username).toBe('new_user'); // normalized
      expect(res.body.avatarUrl).toBe('https://example.com/a.png');
    });

    it('rejects an empty display name (400)', async () => {
      const { accessToken } = await createTestUser(app, { email: 'profile2@example.com' });
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ displayName: '   ' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-http avatar URL (400)', async () => {
      const { accessToken } = await createTestUser(app, { email: 'profile3@example.com' });
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ avatarUrl: 'javascript:alert(1)' });
      expect(res.status).toBe(400);
    });

    it('requires authentication (401)', async () => {
      const res = await request(app).patch('/api/auth/me').send({ displayName: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /change-password', () => {
    it('changes the password with a correct current password', async () => {
      const { accessToken } = await createTestUser(app, { email: 'cp@example.com' });
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'TestPassword123', newPassword: 'NewerPassword456' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'cp@example.com', password: 'NewerPassword456' });
      expect(login.status).toBe(200);
    });

    it('rejects an incorrect current password (401)', async () => {
      const { accessToken } = await createTestUser(app, { email: 'cp2@example.com' });
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'WrongPassword', newPassword: 'NewerPassword456' });
      expect(res.status).toBe(401);
    });

    it('rejects a weak new password (400)', async () => {
      const { accessToken } = await createTestUser(app, { email: 'cp3@example.com' });
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'TestPassword123', newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('rejects change for an OAuth-only account (400)', async () => {
      await User.create({ email: 'oauthcp@example.com', displayName: 'O', passwordHash: null, oauthProvider: 'google', oauthId: 'gx' });
      const { generateAccessToken } = await import('../helpers');
      const oauthUser = await User.findOne({ email: 'oauthcp@example.com' });
      const token = generateAccessToken(oauthUser!.id);
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'whatever', newPassword: 'NewerPassword456' });
      expect(res.status).toBe(400);
    });
  });

  describe('Email verification enforcement at login', () => {
    afterEach(() => {
      delete process.env.REQUIRE_EMAIL_VERIFICATION;
    });

    it('blocks an unverified user when enforcement is on', async () => {
      await createTestUser(app, { email: 'unverified@example.com' });
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'unverified@example.com', password: 'TestPassword123' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('allows a verified user when enforcement is on', async () => {
      await createTestUser(app, { email: 'verified@example.com' });
      await User.updateOne({ email: 'verified@example.com' }, { emailVerified: true });
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'verified@example.com', password: 'TestPassword123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('allows an unverified user when enforcement is off (default)', async () => {
      await createTestUser(app, { email: 'unverified2@example.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'unverified2@example.com', password: 'TestPassword123' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /forgot-password (OTP)', () => {
    it('returns a generic message for an existing account and stores a hashed OTP', async () => {
      await createTestUser(app, { email: 'reset@example.com' });
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account exists/i);
      const user = await User.findOne({ email: 'reset@example.com' });
      expect(user!.passwordResetOtpHash).toBeTruthy();
      expect(user!.passwordResetOtpExpiry).toBeTruthy();
      // The raw code must never be persisted, only a bcrypt hash.
      expect(user!.passwordResetOtpHash).toMatch(/^\$2[aby]\$/);
    });

    it('returns the same generic message for a non-existent account (no enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it('does not disclose a Google-only account inline — notifies over email, issues no OTP', async () => {
      await User.create({ email: 'oauth@example.com', displayName: 'OAuth', passwordHash: null, oauthProvider: 'google', oauthId: 'g1' });
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'oauth@example.com' });

      // Response is byte-for-byte identical to the unknown-email case — no
      // OAUTH_ACCOUNT code, just the generic message.
      expect(res.status).toBe(200);
      expect(res.body.code).toBeUndefined();
      expect(res.body.message).toMatch(/if an account exists/i);

      // No password OTP is minted (there's no password to reset)...
      const user = await User.findOne({ email: 'oauth@example.com' });
      expect(user!.passwordResetOtpHash).toBeNull();
      // ...but the owner is told, over email, to sign in with Google.
      expect(sendOAuthResetNoticeEmail as jest.Mock).toHaveBeenCalledWith('oauth@example.com', 'OAuth');
    });

    it('does not leak account existence via the resend cooldown (no 429 oracle)', async () => {
      await createTestUser(app, { email: 'cooldown@example.com' });

      // First request issues an OTP and starts the per-account cooldown.
      const first = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'cooldown@example.com' });
      expect(first.status).toBe(200);
      expect(first.body.message).toMatch(/if an account exists/i);

      // Immediate second request is inside the cooldown window. It must return
      // the SAME generic 200 as an unknown email — never a distinguishing 429 —
      // otherwise the status code confirms the account exists.
      const second = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'cooldown@example.com' });
      expect(second.status).toBe(200);
      expect(second.body.message).toMatch(/if an account exists/i);

      const unknown = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'stranger@example.com' });
      expect(second.status).toBe(unknown.status);
      expect(second.body).toEqual(unknown.body);
    });
  });

  describe('POST /verify-otp', () => {
    // Seed a user with a known OTP and return the raw code.
    async function seedUserWithOtp(email: string, opts: { expiry?: Date; attempts?: number } = {}) {
      await createTestUser(app, { email });
      const otp = '483912';
      const user = await User.findOne({ email });
      user!.passwordResetOtpHash = await bcrypt.hash(otp, 10);
      user!.passwordResetOtpExpiry = opts.expiry ?? new Date(Date.now() + 10 * 60 * 1000);
      user!.passwordResetOtpAttempts = opts.attempts ?? 0;
      await user!.save();
      return { user: user!, otp };
    }

    it('returns a reset ticket for a correct OTP and consumes the OTP', async () => {
      const { otp } = await seedUserWithOtp('vo@example.com');
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'vo@example.com', otp });

      expect(res.status).toBe(200);
      expect(res.body.resetToken).toEqual(expect.any(String));

      const user = await User.findOne({ email: 'vo@example.com' });
      expect(user!.passwordResetOtpHash).toBeNull(); // consumed
      expect(user!.passwordResetToken).toBeTruthy(); // ticket minted
    });

    it('rejects an incorrect OTP and increments the attempt counter', async () => {
      await seedUserWithOtp('vo2@example.com');
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'vo2@example.com', otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_OTP');
      const user = await User.findOne({ email: 'vo2@example.com' });
      expect(user!.passwordResetOtpAttempts).toBe(1);
    });

    it('rejects an expired OTP and clears it', async () => {
      const { otp } = await seedUserWithOtp('vo3@example.com', { expiry: new Date(Date.now() - 1000) });
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'vo3@example.com', otp });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('OTP_EXPIRED');
      const user = await User.findOne({ email: 'vo3@example.com' });
      expect(user!.passwordResetOtpHash).toBeNull();
    });

    it('locks out after too many attempts', async () => {
      const { otp } = await seedUserWithOtp('vo4@example.com', { attempts: 5 });
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'vo4@example.com', otp });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('OTP_LOCKED');
    });

    it('rejects a malformed OTP (400)', async () => {
      await seedUserWithOtp('vo5@example.com');
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email: 'vo5@example.com', otp: '12' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /reset-password', () => {
    const rawToken = 'a'.repeat(64);
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    async function seedUserWithResetToken(expiry: Date) {
      await createTestUser(app, { email: 'pwreset@example.com' });
      const user = await User.findOne({ email: 'pwreset@example.com' });
      user!.passwordResetToken = hashedToken;
      user!.passwordResetExpiry = expiry;
      await user!.save();
      return user!;
    }

    it('resets the password with a valid token and invalidates old sessions', async () => {
      const before = await seedUserWithResetToken(new Date(Date.now() + 60 * 60 * 1000));
      const oldVersion = before.tokenVersion;

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'BrandNewPass123' });

      expect(res.status).toBe(200);

      // Can log in with the new password
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pwreset@example.com', password: 'BrandNewPass123' });
      expect(login.status).toBe(200);

      const after = await User.findOne({ email: 'pwreset@example.com' });
      expect(after!.passwordResetToken).toBeNull();
      expect(after!.tokenVersion).toBe(oldVersion + 1);
    });

    it('rejects an invalid token (400)', async () => {
      await seedUserWithResetToken(new Date(Date.now() + 60 * 60 * 1000));
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'wrong-token', password: 'BrandNewPass123' });
      expect(res.status).toBe(400);
    });

    it('rejects an expired token (400)', async () => {
      await seedUserWithResetToken(new Date(Date.now() - 1000));
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'BrandNewPass123' });
      expect(res.status).toBe(400);
    });

    it('rejects a weak password (400)', async () => {
      await seedUserWithResetToken(new Date(Date.now() + 60 * 60 * 1000));
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'short' });
      expect(res.status).toBe(400);
    });

    it('requires a token (400)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'BrandNewPass123' });
      expect(res.status).toBe(400);
    });
  });

  // Google login is unchanged by the enumeration work — only the forgot-password
  // "you use Google" *screen* was removed, never the OAuth sign-in itself.
  describe('GET /google (OAuth login entrypoint)', () => {
    it('still redirects the browser to Google\'s consent screen', async () => {
      const res = await request(app).get('/api/auth/google');

      // passport hands off with a 302 to Google's OAuth server.
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2/);
      // Requests the email + profile scopes the app relies on.
      expect(res.headers.location).toContain('scope=');
      expect(decodeURIComponent(res.headers.location)).toContain('profile');
      expect(decodeURIComponent(res.headers.location)).toContain('email');
    });
  });
});
