# Contributing to CollabDocs

We love your input! We want to make contributing to CollabDocs as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## Development Setup

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (free tier)
- Upstash Redis account (free tier)
- Groq API key (free at console.groq.com)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/collabdocs.git
cd collabdocs

# Install dependencies
npm install

# Set up environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Edit the files with your credentials
# See .env.example for detailed instructions on obtaining each credential

# Start development servers
npm run dev
```

The frontend runs at `http://localhost:3000` and backend at `http://localhost:4000`.

## Code Standards

### TypeScript
- All code must be in TypeScript (no plain JavaScript)
- Run `npm run type-check` before submitting PRs
- No `any` types unless absolutely unavoidable with a comment explaining why

### Formatting
- ESLint and Prettier are enforced via husky pre-commit hooks
- Format with: `npm run lint` (fixes auto-fixable issues)
- Install IDE extensions for real-time feedback (ESLint, Prettier)

### Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes and React components
- Use CONSTANT_CASE for environment variables

## Submitting Changes

### Process

1. **Fork the repository** and create your feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes** and ensure they work locally
   ```bash
   npm run dev
   npm run type-check
   npm run lint
   ```

3. **Write tests** for new functionality (see [Testing](#testing))

4. **Commit with a clear message**
   ```bash
   git commit -m "feat: add real-time presence indicators"
   ```
   Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

5. **Push to your fork** and **open a Pull Request**
   - Fill out the PR template completely
   - Link any related issues
   - Add screenshots/GIFs for UI changes

### PR Requirements
-  All tests pass (or new tests added)
-  TypeScript type checking passes
-  ESLint passes (no warnings)
-  Code is documented (comments for non-obvious logic)
-  One commit per logical change (or squash if needed)

## Testing

### Running Tests
```bash
npm run test --workspace=server
npm run test --workspace=client
```

### What to Test
- **API changes**: Add route tests in `server/src/__tests__/routes/`
- **WebSocket logic**: Test sync behavior in `server/src/__tests__/socket/`
- **Components**: Add snapshot + behavior tests in `client/__tests__/`
- **Auth flows**: Ensure JWT handling is tested end-to-end

### Test Standards
- Aim for >60% code coverage on critical paths (auth, sync, persistence)
- Use descriptive test names: `should sync edits across two clients in <100ms`
- Mock external services (Groq, MongoDB) where appropriate
- Integration tests should use a test database

## Reporting Bugs

Use the [GitHub issue template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
- **Environment**: OS, Node version, browser (if frontend)
- **Steps to reproduce**: Detailed steps, ideally with a minimal example
- **Expected vs. actual behavior**
- **Screenshots/video** if it's a UI issue
- **Logs**: Any relevant error messages

## Feature Requests

Open an issue with the title `[FEATURE] Your idea here` and describe:
- What problem it solves
- How it would work
- Why it's valuable to CollabDocs users

## Architecture Decisions

Before making significant architectural changes (e.g., replacing Y.js, changing database schema), **open a discussion issue first**. We value your input on design decisions.

### Key Architectural Principles
1. **CRDT-based conflict resolution** — clients can apply updates immediately, server is a dumb relay
2. **Stateless backend** — every instance is interchangeable via Redis adapter
3. **TypeScript everywhere** — type safety across the stack
4. **Security-first** — JWT in memory, rate limiting, CORS, helmet
5. **Scalability** — design for horizontal scaling from day one

## Questions?

- Check the [README](README.md) for project overview
- Read [SECURITY.md](SECURITY.md) for security practices
- Open a discussion issue for architectural questions

---

**Thank you for contributing to CollabDocs!**
