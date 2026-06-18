import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage.js';
import { MainPage } from './pages/MainPage.js';
import { signInTestUser, buildFirebaseUser } from './helpers/firebase.js';

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

const canRunAuth = !!(FIREBASE_API_KEY && TEST_USER_EMAIL && TEST_USER_PASSWORD);

// ── Login page (unauthenticated) ──────────────────────────────────────────

test.describe('Login page', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('page title is Research Assistant', async ({ page }) => {
    await expect(page).toHaveTitle('Research Assistant');
  });

  test('login heading and subtitle are visible', async () => {
    await expect(loginPage.heading).toHaveText('Research Assistant');
    await expect(loginPage.subtitle).toBeVisible();
  });

  test('sign in with GitHub button is visible and enabled', async () => {
    await expect(loginPage.signInButton).toHaveText('Sign in with GitHub');
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.signInButton).toBeEnabled();
  });

  test('compare login modal', async () => {
    await expect(loginPage.authModal).toHaveScreenshot('reference-login-modal.png');
  });
});

// ── Main page (authenticated) ─────────────────────────────────────────────
// Signs in a real Firebase test user via REST API, injects the returned tokens
// into localStorage, then reloads so Firebase picks up a valid cached session.
// Requires VITE_FIREBASE_API_KEY, TEST_USER_EMAIL, and TEST_USER_PASSWORD.
// Create the test account once in the Firebase console and add credentials to
// .env.local (local) or CI secrets (workflow).

test.describe('Main page (authenticated)', () => {
  test.skip(!canRunAuth, 'VITE_FIREBASE_API_KEY / TEST_USER_EMAIL / TEST_USER_PASSWORD not set');

  let mainPage;

  test.beforeEach(async ({ page }) => {
    const tokenData = await signInTestUser(FIREBASE_API_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    const user = buildFirebaseUser(FIREBASE_API_KEY, tokenData);
    mainPage = new MainPage(page);
    await mainPage.injectAuthUser(FIREBASE_API_KEY, user);
  });

  test('header is visible with correct heading', async () => {
    await expect(mainPage.headerHeading).toHaveText('Research Assistant');
    await expect(mainPage.headerHeading).toBeVisible();
  });

  test('research form inputs are visible', async () => {
    await expect(mainPage.inputForm).toBeVisible();
    await expect(mainPage.topicInput).toBeVisible();
    await expect(mainPage.analystInput).toBeVisible();
    await expect(mainPage.feedbackInput).toBeVisible();
  });

  test('start research button is present and enabled', async () => {
    await expect(mainPage.startButton).toHaveText('Start Research');
    await expect(mainPage.startButton).toBeEnabled();
  });

  test('sign out button is visible in the header', async () => {
    await expect(mainPage.userInfo).toBeVisible();
    await expect(mainPage.signOutButton).toHaveText('Sign Out');
    await expect(mainPage.signOutButton).toBeVisible();
  });
});
