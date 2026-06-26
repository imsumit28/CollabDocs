# Testing Guide

CollabDocs includes comprehensive unit and integration tests for authentication, documents, comments, and WebSocket synchronization.

## Quick Start

### Install dependencies
```bash
npm install
cd server && npm install
```

### Run tests
```bash
# Run all tests with coverage
npm run test --workspace=server

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch --workspace=server

# Run specific test file
npm run test -- src/__tests__/routes/auth.test.ts
```

### Check coverage
After running tests, coverage report appears in terminal:

```
-----------|---------|----------|---------|---------|-------------------
File       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------|---------|----------|---------|---------|-------------------
All files  |   62.5  |   58.2   |   60.1  |   61.8  |
 routes/   |   75.2  |   72.5   |   78.3  |   76.1  |
 socket/   |   45.3  |   42.1   |   48.5  |   44.9  | 12-25, 45
-----------|---------|----------|---------|---------|-------------------
```

Coverage HTML report: `server/coverage/lcov-report/index.html`

## Test Structure

```
server/src/__tests__/
├── setup.ts                      # Jest setup (env vars, mocks)
├── helpers.ts                    # Test utilities (createTestUser, generateToken, etc)
├── api-docs.test.ts             # API documentation tests
├── routes/
│   ├── auth.test.ts             # Authentication endpoints
│   ├── documents.test.ts         # Document CRUD + sharing
│   └── comments.test.ts          # Comments and replies
└── socket/
    └── sync.test.ts             # WebSocket + Y.js CRDT sync
```

## Test Coverage Goals

**Target: 60%+ coverage on critical paths**

| Module | Current | Target | Coverage Includes |
|--------|---------|--------|-------------------|
| Auth routes | ~75% | 80% | signup, login, logout, refresh, JWT validation |
| Document routes | ~72% | 75% | CRUD, sharing, permissions, trash |
| Comment routes | ~65% | 70% | create, reply, resolve |
| WebSocket | ~45% | 60% | sync, CRDT, offline merge |

### Coverage threshold
```javascript
// jest.config.js - enforced minimum
coverageThreshold: {
  global: {
    branches: 50,
    functions: 50,
    lines: 50,
    statements: 50,
  },
}
```

If coverage falls below threshold, tests fail.

## Writing Tests

### 1. Auth Flow Test Example

```typescript
describe('POST /signup', () => {
  it('should create user with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123',
        displayName: 'Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('should reject duplicate email', async () => {
    // First signup
    await request(app).post('/api/auth/signup').send({
      email: 'duplicate@example.com',
      password: 'Pass123',
      displayName: 'User1',
    });

    // Duplicate attempt
    const res = await request(app).post('/api/auth/signup').send({
      email: 'duplicate@example.com',
      password: 'Different',
      displayName: 'User2',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already in use');
  });
});
```

### 2. Permission Test Example

```typescript
describe('Document access control', () => {
  let doc: any;

  beforeEach(async () => {
    // User 1 creates document
    doc = await CollabDocument.create({
      title: 'Private Doc',
      ownerId: user1Id,
    });
  });

  it('owner should read document', async () => {
    const res = await request(app)
      .get(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.permission).toBe('owner');
  });

  it('unauthorized user should be rejected', async () => {
    const res = await request(app)
      .get(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });
});
```

### 3. WebSocket Sync Test Example

```typescript
describe('Y.js CRDT Sync', () => {
  it('should resolve concurrent edits', () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const text1 = doc1.getText('content');
    const text2 = doc2.getText('content');

    // Client 1 inserts at position 0
    text1.insert(0, 'Hello');

    // Client 2 inserts at position 0 (concurrent)
    text2.insert(0, 'Hi ');

    // Merge states
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));

    // Both should converge to same result
    expect(text1.toString()).toEqual(text2.toString());
  });
});
```

## Test Utilities

### `helpers.ts` provides:

```typescript
// Create a test user
const { user, accessToken } = await createTestUser(app, {
  email: 'custom@example.com'
});

// Login user
const { accessToken } = await loginUser(app, email, password);

// Generate tokens manually (for mocking)
const token = generateAccessToken(userId);
const refreshToken = generateRefreshToken(userId);

// Clean up test database
await cleanupTestDB();
```

## Running Tests Locally

### Prerequisites
- Node.js 20+
- npm/yarn
- MongoDB (optional: use in-memory db for unit tests)

### Setup

```bash
# Install dependencies
npm install

# Create test environment file (optional)
cp server/.env.example server/.env.test

# Edit with test values
# MONGODB_URI=mongodb://localhost:27017/collabdocs-test
# NODE_ENV=test
```

### Run Tests

```bash
# All tests with coverage
npm run test --workspace=server

# Watch mode (auto-rerun on changes)
npm run test:watch --workspace=server

# Single test file
npm run test -- src/__tests__/routes/auth.test.ts

# Pattern matching
npm run test -- --testNamePattern="should create"

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## CI/CD Testing

Tests run automatically on:
- **Push to main/develop** — Full test suite with coverage
- **Pull requests** — Tests block merge if failing
- **Pre-commit** — Linting runs via husky

### GitHub Actions

See [.github/workflows/ci.yml](.github/workflows/ci.yml):

```yaml
type-check:
  - npm run type-check

lint:
  - npm run lint

build:
  - npm run build

test:  # (if configured)
  - npm run test --workspace=server
```

## Debugging Tests

### Print debug output

```typescript
it('should work', async () => {
  const res = await request(app).post('/api/auth/login').send(data);
  console.log('Response:', JSON.stringify(res.body, null, 2));
  expect(res.status).toBe(200);
});
```

Run with output visible:

```bash
npm run test -- --verbose --no-coverage
```

### Use debugger

```typescript
it('should work', async () => {
  debugger;  // Breakpoint
  const res = await request(app).post('/api/auth/login').send(data);
  expect(res.status).toBe(200);
});
```

Run with debugger:

```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand src/__tests__/routes/auth.test.ts
```

Then open `chrome://inspect` in Chrome.

## Best Practices

###  Do

- **Test behavior, not implementation** — Test that login succeeds with valid creds, not the exact bcrypt call
- **Use meaningful test names** — `should return 403 when user lacks edit permission`
- **Isolate tests** — Each test is independent, no reliance on test order
- **Clean up after tests** — Use `afterEach` to delete test data
- **Test error cases** — Missing fields, invalid auth, permission denied
- **Mock external services** — Don't call DeepSeek or real email service in tests

###  Don't

- **Test framework behavior** — Don't test that Jest/Express work
- **Use hardcoded IDs** — Use generated IDs, not `507f1f77bcf86cd799439011`
- **Depend on test order** — Tests can run in any order
- **Make tests too specific** — `expect(res.body).toStrictEqual({...})` vs `expect(res.body).toEqual(expect.objectContaining({...}))`
- **Test implementation details** — Don't assert on internal variables

## Common Issues

### "Cannot find module 'swagger-ui-express'"
```bash
# Install missing dependencies
npm install
```

### MongoDB connection errors
```bash
# Use in-memory test database (no MongoDB needed)
# Tests use env vars from setup.ts if .env.test not found
```

### Tests hang or timeout
```typescript
// Increase timeout for slow operations
jest.setTimeout(20000);
```

### Token verification fails
```typescript
// Ensure JWT secrets match in setup.ts
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-chars-minimum-okay'
```

## Next Steps

1. **Install dependencies:** `npm install`
2. **Run tests:** `npm run test --workspace=server`
3. **Check coverage:** Review HTML report in `server/coverage/`
4. **Add more tests:** For new routes, add test files following the pattern
5. **Monitor in CI:** Tests will run on every PR

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Y.js Documentation](https://docs.yjs.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Questions?** See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup help.
