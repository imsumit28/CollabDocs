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
import { signupRateLimit, authRateLimit, resendVerificationRateLimit, forgotPasswordRateLimit, verifyOtpRateLimit, resendOtpRateLimit, resetPasswordRateLimit } from '../middleware/rateLimit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail, sendPasswordResetOtpEmail } from '../utils/mailer';
import { validateEmail, validatePassword, validateOtp, validateDisplayName, validateAvatarUrl, firstError } from '../utils/validation';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
// Don't load the production .env during Jest — the test harness controls the
// environment (NODE_ENV=test, secrets, etc.). Loading it here with override:true
// would clobber those values (e.g. flipping NODE_ENV back to development).
if (!process.env.JEST_WORKER_ID) {
  dotenv.config(envPath ? { path: envPath, override: true } : { override: true });
}

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

// ─── Password-reset OTP configuration ─────────────────────────────────────────
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_TTL_MS = parseInt(process.env.OTP_TTL_MINUTES || '10', 10) * 60 * 1000;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
const OTP_RESEND_COOLDOWN_MS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10) * 1000;
// How long the post-verification reset ticket is valid for completing the reset.
const RESET_TICKET_TTL_MS = parseInt(process.env.RESET_TICKET_TTL_MINUTES || '10', 10) * 60 * 1000;

// Cryptographically secure numeric OTP, zero-padded to OTP_LENGTH digits.
function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
}

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

// Clear every password-reset artifact (OTP + ticket) from a user document.
function clearResetState(user: IUser): void {
  user.passwordResetOtpHash = null;
  user.passwordResetOtpExpiry = null;
  user.passwordResetOtpAttempts = 0;
  user.passwordResetOtpSentAt = null;
  user.passwordResetToken = null;
  user.passwordResetExpiry = null;
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
    const validationError = firstError(
      validateEmail(email),
      validatePassword(password),
      validateDisplayName(displayName),
    );
    if (validationError) {
      res.status(400).json({ error: validationError.message, field: validationError.field });
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

    // Optional enforcement: when REQUIRE_EMAIL_VERIFICATION=true, block login for
    // unverified password accounts. Off by default so local/dev (where SMTP may
    // be unconfigured) and existing users aren't locked out. OAuth users are
    // always verified, so they're unaffected.
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.emailVerified) {
      res.status(403).json({
        error: 'Please verify your email address before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
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
    hasPassword: !!user.passwordHash,
  });
});

// ─── Update profile ─────────────────────────────────────────────────────────
router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.sub);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const { displayName, username, avatarUrl } = req.body;

    if (displayName !== undefined) {
      const err = validateDisplayName(displayName);
      if (err) { res.status(400).json({ error: err.message, field: err.field }); return; }
      user.displayName = displayName.trim();
    }
    if (username !== undefined) {
      user.username = normalizeUsername(username);
    }
    if (avatarUrl !== undefined) {
      const err = validateAvatarUrl(avatarUrl);
      if (err) { res.status(400).json({ error: err.message, field: err.field }); return; }
      user.avatarUrl = avatarUrl ? avatarUrl.trim() : null;
    }

    await user.save();
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      username: user.username ?? null,
      avatarUrl: user.avatarUrl ?? null,
      emailVerified: user.emailVerified,
    });
  } catch {
    res.status(500).json({ error: 'Could not update profile' });
  }
});

// ─── Change password ──────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user?.sub);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (!user.passwordHash) {
      res.status(400).json({ error: 'Your account uses Google sign-in, so there is no password to change.' });
      return;
    }
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required' });
      return;
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const err = validatePassword(newPassword);
    if (err) { res.status(400).json({ error: err.message, field: 'newPassword' }); return; }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    // Invalidate sessions on other devices, then re-issue this session's tokens
    // so the user stays logged in where they made the change.
    user.tokenVersion += 1;
    await user.save();

    const accessToken = signAccessToken({ sub: user.id, email: user.email, displayName: user.displayName, username: user.username });
    const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });
    setRefreshCookie(res, refreshToken);

    res.json({ accessToken, message: 'Password updated' });
  } catch {
    res.status(500).json({ error: 'Could not change password' });
  }
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

// ─── Password Reset (OTP flow) ────────────────────────────────────────────────
// Flow: request OTP → verify OTP (get reset ticket) → reset password with ticket.
// The emailed code is short-lived, single-use, hashed at rest, and brute-force
// protected by a per-user attempt counter plus IP rate limits.

// Issues (or re-issues) an OTP for a manual account. Shared by /forgot-password
// and /resend-otp. Returns a response code the caller maps to a status/body.
async function issuePasswordResetOtp(email: unknown): Promise<
  | { code: 'OK' }
  | { code: 'OAUTH_ACCOUNT' }
  | { code: 'COOLDOWN'; retryAfterSec: number }
> {
  if (!email || typeof email !== 'string') return { code: 'OK' };

  const user = await User.findOne({ email: email.toLowerCase() });

  // Google-only accounts have no password to reset. We intentionally surface
  // this so the UI can steer the user to "Continue with Google" (a deliberate
  // UX choice that reveals account type for this case only).
  if (user && !user.passwordHash && user.oauthProvider) {
    return { code: 'OAUTH_ACCOUNT' };
  }

  // Unknown email or a non-OAuth account without a password: respond as success
  // without sending anything, so we don't leak which emails are registered.
  if (!user || !user.passwordHash) return { code: 'OK' };

  // Throttle resends per account, independent of IP rate limiting.
  if (user.passwordResetOtpSentAt) {
    const elapsed = Date.now() - user.passwordResetOtpSentAt.getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      return { code: 'COOLDOWN', retryAfterSec: Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000) };
    }
  }

  const otp = generateOtp();
  user.passwordResetOtpHash = await bcrypt.hash(otp, 10);
  user.passwordResetOtpExpiry = new Date(Date.now() + OTP_TTL_MS);
  user.passwordResetOtpAttempts = 0;
  user.passwordResetOtpSentAt = new Date();
  // A fresh OTP supersedes any previously issued reset ticket.
  user.passwordResetToken = null;
  user.passwordResetExpiry = null;
  await user.save();

  sendPasswordResetOtpEmail(user.email, otp, user.displayName).catch(() => {});
  return { code: 'OK' };
}

const GENERIC_OTP_MESSAGE = 'If an account exists for that email, a verification code has been sent.';

router.post('/forgot-password', forgotPasswordRateLimit, async (req: Request, res: Response) => {
  try {
    const result = await issuePasswordResetOtp(req.body?.email);
    if (result.code === 'OAUTH_ACCOUNT') {
      res.status(200).json({
        code: 'OAUTH_ACCOUNT',
        message:
          'This account was created using Google Sign-In. Please continue using "Continue with Google". ' +
          'Password reset is only available for accounts registered with email and password.',
      });
      return;
    }
    if (result.code === 'COOLDOWN') {
      res.status(429).json({ error: `Please wait ${result.retryAfterSec}s before requesting another code.`, retryAfterSec: result.retryAfterSec });
      return;
    }
    res.json({ message: GENERIC_OTP_MESSAGE });
  } catch {
    res.status(500).json({ error: 'Could not process password reset request' });
  }
});

// Resend uses a slightly more permissive limiter; logic is otherwise identical.
router.post('/resend-otp', resendOtpRateLimit, async (req: Request, res: Response) => {
  try {
    const result = await issuePasswordResetOtp(req.body?.email);
    if (result.code === 'OAUTH_ACCOUNT') {
      res.status(200).json({ code: 'OAUTH_ACCOUNT' });
      return;
    }
    if (result.code === 'COOLDOWN') {
      res.status(429).json({ error: `Please wait ${result.retryAfterSec}s before requesting another code.`, retryAfterSec: result.retryAfterSec });
      return;
    }
    res.json({ message: GENERIC_OTP_MESSAGE });
  } catch {
    res.status(500).json({ error: 'Could not resend verification code' });
  }
});

// Verify the OTP. On success, returns a single-use reset ticket the client must
// present to /reset-password. The OTP itself is consumed (cleared) here.
router.post('/verify-otp', verifyOtpRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const validationError = firstError(validateEmail(email), validateOtp(otp));
    if (validationError) {
      res.status(400).json({ error: validationError.message, field: validationError.field });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    // Generic failure when there's no pending OTP — avoids leaking account state.
    if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiry) {
      res.status(400).json({ error: 'Invalid or expired code', code: 'INVALID_OTP' });
      return;
    }

    if (user.passwordResetOtpExpiry.getTime() < Date.now()) {
      clearResetState(user);
      await user.save();
      res.status(400).json({ error: 'Your code has expired. Please request a new one.', code: 'OTP_EXPIRED' });
      return;
    }

    // Too many wrong guesses — burn the OTP so it can't be brute-forced further.
    if (user.passwordResetOtpAttempts >= OTP_MAX_ATTEMPTS) {
      clearResetState(user);
      await user.save();
      res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.', code: 'OTP_LOCKED' });
      return;
    }

    const match = await bcrypt.compare(otp, user.passwordResetOtpHash);
    if (!match) {
      user.passwordResetOtpAttempts += 1;
      await user.save();
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - user.passwordResetOtpAttempts);
      res.status(400).json({ error: 'Invalid code', code: 'INVALID_OTP', attemptsRemaining: remaining });
      return;
    }

    // Success: consume the OTP and mint a single-use reset ticket.
    const rawTicket = crypto.randomBytes(32).toString('hex');
    user.passwordResetOtpHash = null;
    user.passwordResetOtpExpiry = null;
    user.passwordResetOtpAttempts = 0;
    user.passwordResetOtpSentAt = null;
    user.passwordResetToken = sha256(rawTicket);
    user.passwordResetExpiry = new Date(Date.now() + RESET_TICKET_TTL_MS);
    await user.save();

    res.json({ resetToken: rawTicket, message: 'Code verified.' });
  } catch {
    res.status(500).json({ error: 'Could not verify code' });
  }
});

// Complete the reset using the ticket from /verify-otp.
router.post('/reset-password', resetPasswordRateLimit, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Reset token is required' });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError.message, field: 'password' });
      return;
    }

    const user = await User.findOne({
      passwordResetToken: sha256(token),
      passwordResetExpiry: { $gt: new Date() },
    });
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    // Wipe any reset artifacts and invalidate all existing sessions — a reset
    // should log the account out everywhere.
    clearResetState(user);
    user.tokenVersion += 1;
    await user.save();

    res.json({ message: 'Password has been reset. You can now log in with your new password.' });
  } catch {
    res.status(500).json({ error: 'Could not reset password' });
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
