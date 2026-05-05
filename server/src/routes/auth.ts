import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User, IUser } from '../models';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} from '../utils/jwt';
import { signupRateLimit, authRateLimit, resendVerificationRateLimit } from '../middleware/rateLimit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail } from '../utils/mailer';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
dotenv.config(envPath ? { path: envPath, override: true } : { override: true });

const router = Router();

function normalizeUsername(value?: string): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

// ─── Passport Google Setup ────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: `${process.env.API_URL || 'http://localhost:4000'}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) return done(new Error('No email from Google'));

        let user = await User.findOne({ oauthId: profile.id });
        if (!user) user = await User.findOne({ email });

        if (!user) {
          user = await User.create({
            email,
            passwordHash: null,
            oauthProvider: 'google',
            oauthId: profile.id,
            displayName: profile.displayName || email.split('@')[0],
            username: normalizeUsername(email.split('@')[0]),
            avatarUrl: profile.photos?.[0].value || null,
            emailVerified: true, // Google already verified this address
          });
        } else if (!user.oauthId) {
          user.oauthId = profile.id;
          user.oauthProvider = 'google';
          user.emailVerified = true;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

// ─── Email / Password ─────────────────────────────────────────────────────────
router.post('/signup', signupRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, username } = req.body;
    if (!email || !password || !displayName) {
      res.status(400).json({ error: 'email, password, and displayName are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      email,
      passwordHash,
      displayName,
      username: normalizeUsername(username),
      oauthProvider: null,
      oauthId: null,
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: expiry,
      emailVerified: false,
    });

    sendVerificationEmail(user.email, rawToken).catch(() => {});

    const accessToken = signAccessToken({ sub: user.id, email: user.email, displayName: user.displayName, username: user.username });
    const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      accessToken,
      user: { id: user.id, email: user.email, displayName: user.displayName, username: user.username, emailVerified: false },
    });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, displayName: user.displayName, username: user.username });
    const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });
    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, displayName: user.displayName, username: user.username, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Reject tokens issued before the user's last logout
    if (payload.tokenVersion !== user.tokenVersion) {
      res.status(401).json({ error: 'Refresh token has been revoked' });
      return;
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, displayName: user.displayName, username: user.username });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  // Use the refresh token from cookie to find the user and invalidate all their tokens
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      const user = await User.findById(payload.sub);
      if (user) {
        user.tokenVersion += 1;
        await user.save();
      }
    } catch { /* ignore — clear cookie regardless */ }
  }
  clearRefreshCookie(res);
  res.json({ message: 'Logged out' });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user?.sub).select('-passwordHash');
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl ?? null,
    emailVerified: user.emailVerified,
  });
});

// ─── Email Verification ───────────────────────────────────────────────────────
router.get('/verify-email/:token', async (req: Request, res: Response) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: { $gt: new Date() },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    if (!user) {
      res.redirect(`${clientUrl}/login?error=invalid-verification-token`);
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpiry = null;
    await user.save();

    res.redirect(`${clientUrl}/login?verified=1`);
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/resend-verification', resendVerificationRateLimit, authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.sub);
    // Return OK regardless to avoid leaking whether an account exists
    if (!user || user.emailVerified) {
      res.json({ message: 'If your email is unverified, a new link has been sent.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    sendVerificationEmail(user.email, rawToken).catch(() => {});
    res.json({ message: 'If your email is unverified, a new link has been sent.' });
  } catch {
    res.status(500).json({ error: 'Could not resend verification email' });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth` }),
  (req: AuthRequest, res: Response) => {
    const user = req.user as unknown as IUser;
    const accessToken = signAccessToken({ sub: user.id, email: user.email, displayName: user.displayName, username: user.username });
    const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });
    setRefreshCookie(res, refreshToken);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${accessToken}`);
  }
);

export default router;
