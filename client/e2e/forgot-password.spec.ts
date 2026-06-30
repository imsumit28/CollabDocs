import { test, expect } from '@playwright/test';
import { mockLoggedOut } from './helpers';

test.describe('Forgot password (OTP)', () => {
  test('requests an OTP and shows the code-entry step', async ({ page }) => {
    await mockLoggedOut(page);
    await page.route('**/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );

    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();

    await page.getByPlaceholder('you@example.com').fill('jane@example.com');
    await page.getByRole('button', { name: /send otp/i }).click();

    await expect(page.getByRole('heading', { name: /enter the code/i })).toBeVisible();
    await expect(page.getByText('jane@example.com')).toBeVisible();
    await expect(page.getByRole('group', { name: /verification code/i })).toBeVisible();
  });

  test('steers Google accounts to Continue with Google', async ({ page }) => {
    await mockLoggedOut(page);
    await page.route('**/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'OAUTH_ACCOUNT' }) }),
    );

    await page.goto('/forgot-password');
    await page.getByPlaceholder('you@example.com').fill('google@example.com');
    await page.getByRole('button', { name: /send otp/i }).click();

    await expect(page.getByRole('heading', { name: /use google to sign in/i })).toBeVisible();
    await expect(page.getByText(/created using google sign-in/i)).toBeVisible();
  });
});
