# CollabDocs API Documentation

Complete REST API reference for CollabDocs. Swagger/OpenAPI documentation is available at `GET /api/docs` when running the server.

## Authentication

All protected endpoints require one of:

1. **Access Token** (recommended)
   ```
   Authorization: Bearer <accessToken>
   ```
   - Short-lived (15 minutes)
   - Stored in memory on client (XSS-safe)
   - Required for API calls

2. **Refresh Token** (automatic)
   ```
   Cookie: refreshToken=<token>
   ```
   - Long-lived (7 days)
   - HttpOnly cookie (cannot be read by JavaScript)
   - Automatically sent with requests
   - Used to obtain new access tokens

### Error Codes
- `401 Unauthorized` — Missing or invalid token
- `403 Forbidden` — Valid token but insufficient permissions
- `429 Too Many Requests` — Rate limited

---

## Authentication Routes

### POST `/api/auth/signup`

Create a new user account with email/password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "displayName": "John Doe"
}
```

**Response: 201 Created**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "displayName": "John Doe",
    "emailVerified": false
  }
}
```

**Error Responses:**
- `400` — Missing fields or password < 8 characters
- `409` — Email already in use
- `500` — Server error

**Headers Set:**
- `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict`

---

### POST `/api/auth/login`

Authenticate with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response: 200 OK**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "displayName": "John Doe",
    "emailVerified": true,
    "avatarUrl": null
  }
}
```

**Error Responses:**
- `401` — Invalid credentials
- `429` — Too many login attempts (rate limited: 5/15min per IP)

---

### POST `/api/auth/refresh`

Obtain a new access token using refresh token from cookie.

**Request:** No body required. Refresh token sent via cookie automatically.

**Response: 200 OK**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401` — Missing or invalid refresh token
- `401` — Token version mismatch (user logged out elsewhere)

---

### POST `/api/auth/logout`

Logout current session and invalidate refresh tokens.

**Request:** No body required.

**Response: 200 OK**
```json
{
  "message": "Logged out"
}
```

**Headers Set:**
- `Set-Cookie: refreshToken=; Max-Age=0; HttpOnly; Secure`

---

### GET `/api/auth/me`

Get current authenticated user's profile.

**Authentication Required:** Yes (Bearer token)

**Response: 200 OK**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "displayName": "John Doe",
  "avatarUrl": null,
  "emailVerified": true
}
```

**Error Responses:**
- `401` — Missing or invalid token
- `404` — User not found (token is for deleted user)

---

### GET `/api/auth/verify-email/:token`

Verify user's email address via link sent to their inbox.

**Parameters:**
- `token` — Verification token from email link

**Response:** 302 Redirect
- Success: `${CLIENT_URL}/login?verified=1`
- Failure: `${CLIENT_URL}/login?error=invalid-verification-token`

---

### POST `/api/auth/resend-verification`

Resend email verification link to unverified user.

**Authentication Required:** Yes (Bearer token)

**Response: 200 OK**
```json
{
  "message": "If your email is unverified, a new link has been sent."
}
```

---

### GET `/api/auth/google`

Redirect to Google OAuth consent screen.

**Redirects to:** Google login page

---

### GET `/api/auth/google/callback`

Google OAuth callback (handled by Passport.js).

**Returns:** 302 Redirect to `${CLIENT_URL}/auth/callback`

Sets refresh token cookie on success.

---

## Document Routes

### POST `/api/documents`

Create a new document.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "title": "My Document"  // optional, defaults to "Untitled"
}
```

**Response: 201 Created**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "title": "My Document",
  "ownerId": "507f1f77bcf86cd799439011",
  "collaborators": [],
  "createdAt": "2025-04-30T10:00:00Z",
  "updatedAt": "2025-04-30T10:00:00Z"
}
```

---

### GET `/api/documents`

List all documents user has access to (owned or collaborated on).

**Authentication Required:** Yes

**Response: 200 OK**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "title": "My Document",
    "ownerId": "507f1f77bcf86cd799439011",
    "collaborators": [
      {
        "userId": "507f1f77bcf86cd799439013",
        "permission": "edit"
      }
    ],
    "updatedAt": "2025-04-30T10:00:00Z"
  }
]
```

Note: `yjsState` (binary CRDT state) is excluded from list responses for performance.

---

### GET `/api/documents/:id`

Get single document with full content.

**Authentication Required:** Yes

**Response: 200 OK**
```json
{
  "document": {
    "_id": "507f1f77bcf86cd799439012",
    "title": "My Document",
    "ownerId": "507f1f77bcf86cd799439011",
    "yjsState": "<binary Buffer>",  // CRDT state for editor
    "collaborators": []
  },
  "permission": "owner"  // owner | edit | view
}
```

**Error Responses:**
- `404` — Document not found
- `403` — User doesn't have access to this document

---

### PATCH `/api/documents/:id`

Update document title.

**Authentication Required:** Yes (require edit permission)

**Request Body:**
```json
{
  "title": "Updated Title"
}
```

**Response: 200 OK**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "title": "Updated Title",
  "updatedAt": "2025-04-30T10:30:00Z"
}
```

---

### DELETE `/api/documents/:id`

Soft delete document (move to trash). Only owner can delete.

**Authentication Required:** Yes

**Response: 200 OK**
```json
{
  "message": "Document moved to trash"
}
```

Auto-purged after 7 days.

---

### GET `/api/documents/trash`

List deleted documents (for current user, who is the owner).

**Authentication Required:** Yes

**Response: 200 OK**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "title": "Deleted Doc",
    "deletedAt": "2025-04-30T11:00:00Z"
  }
]
```

---

### PATCH `/api/documents/:id/restore`

Restore document from trash.

**Authentication Required:** Yes (owner only)

**Response: 200 OK**
```json
{
  "message": "Document restored",
  "document": { /* ... */ }
}
```

---

### DELETE `/api/documents/:id/permanent`

Permanently delete document from trash (cannot be undone).

**Authentication Required:** Yes (owner only)

**Response: 200 OK**
```json
{
  "message": "Document permanently deleted"
}
```

---

### POST `/api/documents/:id/share`

Create or update share link for document.

**Authentication Required:** Yes (owner only)

**Request Body:**
```json
{
  "permission": "view",  // view | edit
  "disable": false
}
```

**Response: 200 OK**
```json
{
  "shareLink": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "shareLinkPermission": "view",
  "shareUrl": "http://localhost:3000/doc/507f1f77bcf86cd799439012?share=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Disable sharing:**
```json
{
  "disable": true
}
```

---

### POST `/api/documents/:id/collaborators`

Add or update collaborator permissions.

**Authentication Required:** Yes (owner only)

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439013",
  "permission": "edit"  // view | edit | comment
}
```

**Response: 200 OK**
```json
[
  {
    "userId": "507f1f77bcf86cd799439013",
    "permission": "edit"
  }
]
```

---

## Comment Routes

### POST `/api/comments`

Create a comment on a document.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "documentId": "507f1f77bcf86cd799439012",
  "anchorText": "highlighted text",
  "body": "This needs revision",
  "parentId": null  // optional, for replies
}
```

**Response: 201 Created**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "documentId": "507f1f77bcf86cd799439012",
  "authorId": "507f1f77bcf86cd799439011",
  "anchorText": "highlighted text",
  "body": "This needs revision",
  "resolved": false,
  "createdAt": "2025-04-30T10:00:00Z"
}
```

---

### GET `/api/comments/:documentId`

Get all comments for a document.

**Authentication Required:** Yes

**Response: 200 OK**
```json
[
  {
    "_id": "507f1f77bcf86cd799439014",
    "documentId": "507f1f77bcf86cd799439012",
    "authorId": {
      "displayName": "John Doe",
      "avatarUrl": null
    },
    "body": "This needs revision",
    "resolved": false
  }
]
```

---

### PATCH `/api/comments/:id/resolve`

Mark comment as resolved or reopen it.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "resolved": true  // toggle resolved status
}
```

**Response: 200 OK**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "resolved": true,
  "updatedAt": "2025-04-30T10:30:00Z"
}
```

---

### DELETE `/api/comments/:id`

Delete a comment (comment author only).

**Authentication Required:** Yes

**Response: 200 OK**
```json
{
  "message": "Deleted"
}
```

**Error Responses:**
- `403` — Not the comment author

---

## WebSocket Events (Socket.IO)

Real-time collaboration happens via WebSocket. Connect with:

```
POST /socket.io/?EIO=4&transport=websocket
Authorization: Bearer <accessToken>
```

### Events

**Client → Server:**
- `doc:join {docId}` — Join a document room
- `yjs:update {data}` — Send Y.js CRDT delta

**Server → Client:**
- `yjs:sync {data}` — Full Y.js document state (on join)
- `yjs:update {data}` — Y.js delta from peers
- `doc:saved` — Document persisted to DB
- `doc:awareness {data}` — User presence/cursor updates

---

## Rate Limiting

Endpoints are rate limited to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/signup` | 10 requests | 1 hour |
| `POST /api/auth/login` | 5 requests | 15 minutes |
| `POST /api/auth/resend-verification` | 3 requests | 1 hour |
| `POST /api/ai/*` | 30 requests | 1 minute |

Exceeding limits returns `429 Too Many Requests`.

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:
- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing/invalid auth)
- `403` — Forbidden (insufficient permissions)
- `404` — Not Found
- `409` — Conflict (duplicate email, etc)
- `429` — Too Many Requests (rate limited)
- `500` — Internal Server Error

---

## CORS & Credentials

CORS is enabled for the configured client URL (via `CLIENT_URL` env var).

Include credentials in cross-origin requests:
```javascript
fetch('/api/auth/me', {
  credentials: 'include'  // Include cookies
})
```

---

## Health Check

**GET `/health`**

```json
{
  "status": "ok",
  "timestamp": "2025-04-30T10:00:00.000Z"
}
```

No authentication required. Use to verify server is running.

---

## Testing Endpoints

For local development and testing, you can:

1. **Get Swagger UI:** `http://localhost:4000/api/docs`
2. **Download OpenAPI spec:** `http://localhost:4000/api/docs/swagger.json`
3. **Use example curl commands:**

```bash
# Signup
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123",
    "displayName": "Test User"
  }'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Get current user (with token)
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# List documents
curl -X GET http://localhost:4000/api/documents \
  -H "Authorization: Bearer <accessToken>"
```

---

## Troubleshooting

### 401 Unauthorized on protected endpoints
- Ensure access token is valid and not expired (15 min TTL)
- Check `Authorization` header format: `Bearer <token>`
- Verify refresh token in cookie if using token refresh

### 403 Forbidden on document operations
- Verify you're the owner (for delete, share operations)
- Check collaborator permissions (view/edit/comment)

### 429 Too Many Requests
- Wait for rate limit window to reset
- Check error response headers for `Retry-After`

### WebSocket connection fails
- Ensure valid JWT access token in connection
- Verify `NEXT_PUBLIC_SOCKET_URL` in client env vars
- Check CORS configuration

---

**Last updated:** 2025-04-30

For questions or contributions, see [CONTRIBUTING.md](CONTRIBUTING.md)
