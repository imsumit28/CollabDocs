import { Page } from '@playwright/test';

// JSON route fulfiller.
const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * Put the app into a logged-out state: the AuthContext calls /auth/refresh on
 * mount, so we reject it (401) to ensure no session is restored.
 */
export async function mockLoggedOut(page: Page) {
  await page.route('**/auth/refresh', (route) => route.fulfill(json({ error: 'No session' }, 401)));
}

/**
 * Mock a logged-in session plus empty document/folder lists, so the dashboard
 * renders without a real backend.
 */
export async function mockLoggedIn(page: Page) {
  const user = { id: 'u1', email: 'jane@example.com', displayName: 'Jane', username: 'jane', hasPassword: true };
  await page.route('**/auth/refresh', (route) => route.fulfill(json({ accessToken: 'tok' })));
  await page.route('**/auth/me', (route) => route.fulfill(json(user)));
  await page.route('**/docs/trash', (route) => route.fulfill(json([])));
  await page.route('**/folders', (route) => route.fulfill(json([])));
  await page.route('**/notifications', (route) => route.fulfill(json({ notifications: [], unread: 0 })));
  // Plain doc list (and anything else under /docs that isn't trash).
  await page.route('**/docs', (route) => route.fulfill(json([])));
  return user;
}
