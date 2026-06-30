import rateLimit from 'express-rate-limit';

// Rate limiting is disabled under test so suites that exercise many requests
// (e.g. creating multiple users) aren't throttled by shared in-memory counters.
const skipInTest = () => process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;

// Stricter limit for signup — one-time action, lower tolerance for abuse
export const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many signup attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

export const resendVerificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many resend attempts. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

export const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: { error: 'Too many password reset requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

// OTP verification — cap guesses per IP across the window. This is a coarse
// network-level guard; the per-user attempt counter in the route is the precise
// brute-force defense.
export const verifyOtpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: 'Too many verification attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

// Resending an OTP — slightly more permissive than the initial request so a user
// who mistyped their email or lost the first code isn't locked out, but still
// bounded to prevent using us as an email-spam relay.
export const resendOtpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many code requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => (req as any).user?.sub || req.ip,
  message: { error: 'AI rate limit reached. Max 20 requests per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});
