// spec: frontend/specs/test.plan.md
// seed: frontend/tests/seed.spec.js

import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage.js';
import { MainPage } from './pages/MainPage.js';
import { injectAuth, injectAuthOnce } from './helpers/auth-inject.js';

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;

test.describe('Login Page (Unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('page title is correct', async ({ page }) => {
    // Navigate to the app without auth
    await page.goto('/');
    await expect(page).toHaveTitle('Research Assistant');
  });

  test('heading and subtitle are visible', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/');
    // Verify heading and subtitle text
    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.subtitle).toBeVisible();
  });

  test('sign in with GitHub button is visible and enabled', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/');
    // Verify sign-in button is present and clickable
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.signInButton).toBeEnabled();
  });

  test('no research form is shown before authentication', async ({ page }) => {
    await page.goto('/');
    // Research form inputs must not be in the DOM
    await expect(page.locator('#topic')).not.toBeAttached();
    await expect(page.locator('#maxAnalysts')).not.toBeAttached();
    await expect(page.locator('#feedback')).not.toBeAttached();
    await expect(page.locator('#btn-primary')).not.toBeAttached();
  });

  test('login modal visual regression', async ({ page }) => {
    await page.goto('/');
    // Visual regression against reference screenshot
    await expect(page).toHaveScreenshot('reference-login-modal.png');
  });
});

test.describe('Main Page (Authenticated)', () => {
  // Firebase v9+ stores auth in IndexedDB which Playwright storageState cannot capture.
  // We inject auth via IndexedDB before each page load instead.
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('header shows app name after login', async ({ page }) => {
    const mainPage = new MainPage(page);
    await page.goto('/');
    // Header heading is visible when authenticated
    await expect(mainPage.headerHeading).toBeVisible();
  });

  test('research form inputs are all visible', async ({ page }) => {
    const mainPage = new MainPage(page);
    await page.goto('/');
    // All form fields must be visible
    await expect(mainPage.topicInput).toBeVisible();
    await expect(mainPage.analystInput).toBeVisible();
    await expect(mainPage.feedbackInput).toBeVisible();
  });

  test('start research button is enabled with default state', async ({ page }) => {
    const mainPage = new MainPage(page);
    await page.goto('/');
    // Start Research is visible and not disabled
    await expect(mainPage.startButton).toBeVisible();
    await expect(mainPage.startButton).toBeEnabled();
  });

  test('user info and sign out button are visible in header', async ({ page }) => {
    const mainPage = new MainPage(page);
    await page.goto('/');
    // User info area and Sign Out are present in the header
    await expect(mainPage.userInfo).toBeVisible();
    await expect(mainPage.signOutButton).toBeVisible();
  });
});

test.describe('Sign Out', () => {
  // Firebase v9+ stores auth in IndexedDB which Playwright storageState cannot capture.
  // We inject auth via IndexedDB before each page load instead.
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('sign out returns user to login page', async ({ page }) => {
    const mainPage = new MainPage(page);
    await page.goto('/');
    // Click Sign Out
    await mainPage.signOutButton.click();
    // Login modal with sign-in button must appear
    await expect(page.locator('#btn-signin')).toBeVisible();
  });

  test('sign out clears auth tokens from localStorage', async ({ page }) => {
    const mainPage = new MainPage(page);
    await page.goto('/');
    await mainPage.signOutButton.click();
    // Firebase auth entry is removed from localStorage
    await expect.poll(() => mainPage.getFirebaseAuthEntry(FIREBASE_API_KEY)).toBeNull();
  });
});

// This test needs its own describe block so no addInitScript is registered via beforeEach.
// addInitScript fires on every navigation; re-injecting auth after sign-out would make
// the test pass for the wrong reason. injectAuthOnce() writes directly to IndexedDB and
// reloads once — it does not re-inject on subsequent navigations.
test.describe('Sign Out — back navigation', () => {
  test('navigating back after sign out does not restore authenticated state', async ({ page }) => {
    const mainPage = new MainPage(page);
    await page.goto('/');
    // Inject auth imperatively (no addInitScript) then reload so Firebase picks it up
    await injectAuthOnce(page);
    // Confirm we are authenticated
    await expect(mainPage.signOutButton).toBeVisible();
    // Sign out
    await mainPage.signOutButton.click();
    await expect(page.locator('#btn-signin')).toBeVisible();
    // Back navigation (SPA — may land on about:blank)
    await page.goBack();
    // Re-navigate to the app; auth should still be absent
    await page.goto('/');
    await expect(page.locator('#btn-signin')).toBeVisible();
  });
});
