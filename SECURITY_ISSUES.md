# Security Issues Found & Fixes

## Critical Issues (Must Fix Before Upload)

### 1. Missing Email Format Validation
**Severity:** Medium
**Location:** `server/src/routes/auth.ts` - signup & login
**Issue:** Email only checks for presence, not valid format
**Fix:** Add email regex validation
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ error: 'Invalid email format' });
}
```

### 2. Weak Password Requirements
**Severity:** Medium
**Location:** `server/src/routes/auth.ts` - signup (line 79)
**Issue:** Only 8 character minimum, no complexity rules
**Fix:** Add to .env and validate:
```env
# Password policy
PASSWORD_MIN_LENGTH=10
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL_CHARS=true
```

### 3. Missing Input Length Validation
**Severity:** Medium
**Location:** Multiple routes
**Issue:** No max length on:
- Document title
- Comment body
- displayName
- AI endpoint text inputs

**Fix:** Add validation:
```typescript
const MAX_TITLE_LENGTH = 500;
const MAX_COMMENT_LENGTH = 5000;
const MAX_DISPLAY_NAME = 100;
const MAX_AI_INPUT = 10000;
```

### 4. Missing Required Environment Variables Validation
**Severity:** Medium
**Location:** `server/src/routes/ai.ts` (line 9)
**Issue:** DEEPSEEK_API_KEY only checked when request comes in, not at startup
**Fix:** Add startup validation in `server/src/index.ts`

### 5. Missing MongoDB ObjectId Validation
**Severity:** Low
**Location:** All routes using `req.params.id`
**Issue:** Should validate before querying to prevent NoSQL injection
**Fix:** Add helper:
```typescript
function isValidObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/.test(id);
}
```

### 6. Missing Request Timeout
**Severity:** Low
**Location:** `server/src/index.ts`
**Issue:** No timeout middleware for slow HTTP DoS protection
**Fix:** Add to middleware stack

### 7. Helmet CSP Too Permissive
**Severity:** Low
**Location:** `server/src/index.ts` (line 32)
**Issue:** Only disables embedder policy, could be stricter
**Fix:** Configure CSP headers more strictly

### 8. Rate Limit Bypass Risk
**Severity:** Low
**Location:** `server/src/middleware/rateLimit.ts` (line 31)
**Issue:** AI endpoint uses user.sub which could be undefined
**Fix:** Fallback to IP but validate user exists

---

## Recommended Environment Variables to Add

Create a `server/.env.validation.ts` file to validate these at startup:

```typescript
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'NODE_ENV',
  'CLIENT_URL',
];

const optionalEnvVars = [
  'DEEPSEEK_API_KEY',
  'REDIS_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

export function validateEnvVars() {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}
```

---

## Safe to Upload: YES
- ✓ No hardcoded secrets
- ✓ No exposed API keys
- ✓ No credentials in code
- ✓ All validation issues are non-critical functional issues, not security holes
- ✓ Already have .gitignore, Helmet, CORS, rate limiting, JWT auth

**Recommendation:** Fix the 3 input validation issues above before production deployment, but code is safe to push to GitHub.
