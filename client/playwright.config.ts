import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against a production build of the Next.js app. All API
// calls (`**/api/**`) are intercepted with Playwright route mocks, so the tests
// need no backend or database — they're deterministic and CI-friendly (free).
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start the app before tests. In CI the client is built first (npm run build),
  // then `next start` serves it. Locally we reuse a running server if present.
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
