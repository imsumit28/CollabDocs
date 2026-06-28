import { test, expect } from '@playwright/test';
import { mockLoggedOut, mockLoggedIn } from './helpers';

test.describe('Login', () => {
  test('renders the sign-in form', async ({ page }) => {
    await mockLoggedOut(page);
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
  });

  test('signs in and navigates to the dashboard', async ({ page }) => {
    await mockLoggedIn(page);
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'tok',
          user: { id: 'u1', email: 'jane@example.com', displayName: 'Jane', username: 'jane' },
        }),
      }),
    );

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('jane@example.com');
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows an error on bad credentials', async ({ page }) => {
    await mockLoggedOut(page);
    await page.route('**/auth/login', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid credentials' }) }),
    );

    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('jane@example.com');
    await page.getByPlaceholder('••••••••').fill('wrongpass');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('links to the sign-up page', async ({ page }) => {
    await mockLoggedOut(page);
    await page.goto('/login');
    await page.getByRole('link', { name: /sign up free/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
