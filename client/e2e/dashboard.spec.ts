import { test, expect } from '@playwright/test';
import { mockLoggedIn } from './helpers';

// Authenticated dashboard journey: the AuthContext restores the session on mount
// (via the mocked /auth/refresh + /auth/me), the dashboard renders, and Sign out
// clears the session and returns to /login. All API calls are route-mocked, so
// this runs with no backend.
test.describe('Dashboard (authenticated)', () => {
  test('restores the session and renders the dashboard shell', async ({ page }) => {
    await mockLoggedIn(page);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard/);
    // The signed-in user's name comes from the mocked /auth/me.
    await expect(page.getByText('Jane').first()).toBeVisible();
    // Core dashboard affordances render even with an empty document list.
    await expect(page.getByPlaceholder(/search documents/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /new document/i }).first()).toBeVisible();
  });

  test('signs out and returns to the login page', async ({ page }) => {
    await mockLoggedIn(page);
    await page.route('**/auth/logout', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Logged out' }) }),
    );

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Open the profile menu (the button carries the user's display name).
    await page.getByRole('button', { name: /Jane/i }).first().click();
    await page.getByRole('button', { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });
});
