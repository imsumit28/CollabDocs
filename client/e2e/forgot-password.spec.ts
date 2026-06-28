import { test, expect } from '@playwright/test';
import { mockLoggedOut } from './helpers';

test.describe('Forgot password', () => {
  test('shows a confirmation after submitting an email', async ({ page }) => {
    await mockLoggedOut(page);
    await page.route('**/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );

    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();

    await page.getByPlaceholder('you@example.com').fill('jane@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    await expect(page.getByText('jane@example.com')).toBeVisible();
  });
});
