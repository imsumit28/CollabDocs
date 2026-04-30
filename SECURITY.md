# Security Policy

CollabDocs is designed with security as a first-class concern. This document outlines the security practices, threat model, and how to report vulnerabilities.

## Security Measures

### Authentication

#### JWT Token Strategy
- **Access tokens** (short-lived, ~15 min)
  - Stored in memory (NOT localStorage to prevent XSS)
  - Sent via `Authorization: Bearer <token>` header
  - HS256 algorithm with 256-bit secret
  
- **Refresh tokens** (long-lived, ~7 days)
  - Stored in **HttpOnly cookies** (prevents JavaScript access)
  - Sampled, Secure flags enabled (HTTPS-only)
  - Used to issue new access tokens without re-authentication

#### Why This Approach?
- XSS attack cannot steal tokens from localStorage
- CSRF attacks cannot forge refresh tokens (HttpOnly + SameSite)
- Access token expiration limits damage if compromised
- Token rotation ensures old tokens expire

#### Google OAuth
- Implemented via Passport.js
- Credentials not stored; only `sub` (user ID) and email cached
- Tokens flow directly Google → Server (never exposed to client)

### Authorization

- **Documents**: Users can only access documents they own, are shared with, or collaborate on
- **Socket.IO**: JWT verified on handshake; unauthenticated sockets never reach handlers
- **API routes**: All modifying endpoints require authentication

### Rate Limiting

- **Auth endpoints** (`/auth/login`, `/auth/signup`, `/auth/refresh`)
  - 5 requests per 15 minutes per IP
  - Prevents brute-force password attacks
  
- **AI endpoints** (`/ai/*`)
  - 30 requests per minute per user
  - Prevents abuse of free Groq tier

Implemented via `express-rate-limit` with Redis store for distributed rate limiting.

### Network Security

#### HTTPS/TLS
- All traffic encrypted in transit
- HSTS headers enforce HTTPS-only (Helmet.js)
- CORS restricted to known origins

#### CORS
- Whitelist only necessary origins (configured via `CLIENT_URL` env var)
- Credentials allowed only for same-origin requests
- Preflight requests cached to reduce overhead

#### Security Headers (Helmet.js)
- `Content-Security-Policy` — restricts script sources
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Strict-Transport-Security` — enforces HTTPS

### Database Security

#### MongoDB
- Database access only from whitelisted IPs (backend servers)
- No public internet exposure
- Credentials rotated regularly

#### Secrets Management
- All secrets in environment variables (never committed)
- `.env.example` does NOT contain real values
- CI/CD secrets stored in GitHub encrypted secrets

### Data Privacy

#### User Data
- Passwords hashed with **bcryptjs** (10 salt rounds, adaptive cost)
- Email verified before account activation
- Users can request data export or deletion

#### Document Content
- Stored encrypted at rest in MongoDB (via Atlas encryption)
- Shared only with explicitly authorized users
- GDPR/CCPA compliance measures:
  - Data retention policy: deleted after 2 years of inactivity
  - User can export all personal data
  - User can request deletion (deletes account + documents)

### Code Security

#### Dependencies
- Regularly updated via Dependabot
- Security audits: `npm audit` runs in CI/CD
- Minimal dependencies (no unnecessary packages)

#### Input Validation
- Socket.IO payloads validated before processing
- Document changes validated against user permissions
- Query parameters sanitized

#### Output Encoding
- React components automatically escape dangerous content (JSX)
- TipTap sanitizes HTML to prevent XSS in rich text

## Threat Model

### In Scope

| Threat | Mitigation |
|--------|-----------|
| Brute-force auth attacks | Rate limiting on login (5 req/15 min) |
| Session hijacking | JWT + HttpOnly cookies, token expiration |
| XSS via localStorage | Tokens in memory, CSP headers |
| CSRF attacks | SameSite cookies, token-based auth |
| Unauthorized document access | JWT verification, permission checks |
| Unauthorized edits via WebSocket | JWT handshake validation |
| Privilege escalation | Role-based access (owner/editor/viewer) |
| Man-in-the-middle | HTTPS/TLS enforcement, HSTS |
| Brute-force password | Rate limiting, bcryptjs hashing |

### Out of Scope

- DDoS attacks (mitigated by CDN in production)
- Side-channel attacks on cryptographic functions
- Physical attacks on servers
- Social engineering attacks
- Zero-day vulnerabilities in upstream dependencies (monitored continuously)

## Reporting Security Issues

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, email **ersumitkumar45@gmail.com** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your contact information
- Proof of concept (if applicable)

We will:
1. Acknowledge receipt within 24 hours
2. Investigate and confirm within 7 days
3. Develop a fix and issue a patch
4. Coordinate public disclosure with you
5. Credit you in the security advisory (unless you prefer anonymity)

## Security Checklist for Deployment

Before deploying to production:

- [ ] All environment secrets configured (never hardcoded)
- [ ] HTTPS/TLS certificate installed
- [ ] CORS origins whitelist updated
- [ ] Rate limiting thresholds reviewed
- [ ] MongoDB backups enabled
- [ ] Database access restricted to backend IPs only
- [ ] Redis password configured
- [ ] Helmet.js security headers enabled
- [ ] HSTS enabled for ≥1 year
- [ ] CSP headers reviewed
- [ ] `NODE_ENV=production` set
- [ ] Cookie flags: `Secure`, `HttpOnly`, `SameSite=Strict`
- [ ] Monitoring/logging configured
- [ ] Regular security audits scheduled

## Recommended Reading

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/nodejs-security/)
- [JSON Web Tokens Best Practices](https://tools.ietf.org/html/rfc8725)
- [CRDT Security Considerations](https://yjs.dev/)

## Questions?

Open an issue or email **ersumitkumar45@gmail.com** with questions.

---

**Last updated**: 2025-04-30
