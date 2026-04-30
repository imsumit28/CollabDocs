import rateLimit from 'express-rate-limit';

// Stricter limit for signup — one-time action, lower tolerance for abuse
export const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many signup attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resendVerificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many resend attempts. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => (req as any).user?.sub || req.ip,
  message: { error: 'AI rate limit reached. Max 20 requests per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});
