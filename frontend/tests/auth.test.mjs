import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import * as fs from 'node:fs/promises';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4173';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const MODAL_IMAGE = 'login-modal.png';
const REFERENCE_MODAL_PATH = 'tests/testdata/reference-login-modal.png';

// Signs in the Firebase test user via REST API and returns real tokens.
// Requires TEST_USER_EMAIL and TEST_USER_PASSWORD to be set (see Readme)
async function signInTestUser(apiKey, email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(`Firebase sign-in failed: ${error?.message}`);
  }
  return res.json(); // { localId, email, idToken, refreshToken, expiresIn, ... }
}

// Builds the Firebase auth localStorage cache entry from real sign-in token data.
function buildFirebaseUser(apiKey, { localId, email, idToken, refreshToken, expiresIn }) {
  const now = Date.now();
  return {
    uid: localId,
    email,
    emailVerified: true,
    displayName: 'E2E Test User',
    isAnonymous: false,
    photoURL: null,
    providerData: [{ uid: email, displayName: 'E2E Test User', photoURL: null, email, phoneNumber: null, providerId: 'password' }],
    stsTokenManager: {
      refreshToken,
      accessToken: idToken,
      expirationTime: now + parseInt(expiresIn, 10) * 1000
    },
    createdAt: String(now),
    lastLoginAt: String(now),
    apiKey,
    appName: '[DEFAULT]'
  };
}

async function takeScreenshot(driver, file) {
  await driver.executeScript('document.documentElement.style.overflow = "hidden";');
  const modal = await driver.wait(until.elementLocated(By.id('auth-modal')), 10000);
  const image = await modal.takeScreenshot();
  await fs.writeFile(file, image, 'base64');
  return image;
}

async function performComparison(screenshotBase64, referenceBuffer) {
  const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');

  const [screenshot, reference] = await Promise.all([
    sharp(screenshotBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(referenceBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  expect(screenshot.info.width).toBe(reference.info.width);
  expect(screenshot.info.height).toBe(reference.info.height);

  const { width, height } = screenshot.info;
  const diffBuffer = Buffer.alloc(width * height * 4);

  const numDiffPixels = pixelmatch(
    screenshot.data, reference.data, diffBuffer,
    width, height,
    { threshold: 0.1 }
  );

  await sharp(diffBuffer, { raw: { width, height, channels: 4 } })
    .png()
    .toFile('diff-login-modal.png');

  const diffPercent = (numDiffPixels / (width * height)) * 100;
  expect(diffPercent).toBeLessThan(1);
}

describe('Research Assistant', () => {
  let driver;

  beforeAll(async () => {
    const options = new chrome.Options();
    options.addArguments(
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1256,1024'
    );
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  }, 30000);

  afterAll(async () => {
    if (driver) await driver.quit();
  });

  // ── Login page (unauthenticated) ──────────────────────────────────────────

  describe('Login page', () => {
    beforeEach(async () => {
      await driver.get(BASE_URL);
      await driver.executeScript('localStorage.clear();');
      await driver.navigate().refresh();
    });

    test('page title is Research Assistant', async () => {
      expect(await driver.getTitle()).toBe('Research Assistant');
    }, 15000);

    test('login heading and subtitle are visible', async () => {
      const heading = await driver.wait(
        until.elementLocated(By.id('auth-heading')),
        10000
      );
      expect(await heading.getText()).toBe('Research Assistant');

      const subtitle = await driver.findElement(By.id('auth-subtitle'));
      expect(await subtitle.isDisplayed()).toBe(true);
    }, 15000);

    test('sign in with GitHub button is visible and enabled', async () => {
      const btn = await driver.wait(
        until.elementLocated(By.id('btn-signin')),
        10000
      );
      expect(await btn.getText()).toBe('Sign in with GitHub');
      expect(await btn.isDisplayed()).toBe(true);
      expect(await btn.isEnabled()).toBe(true);
    }, 15000);

    test('compare login modal', async () => {
      const modalImage = await takeScreenshot(driver, MODAL_IMAGE);
      const referenceImage = await fs.readFile(REFERENCE_MODAL_PATH);

      await performComparison(modalImage, referenceImage);
    }, 15000);


  });

  // ── Main page (authenticated) ─────────────────────────────────────────────
  // Signs in a real Firebase test user via REST API, injects the returned tokens
  // into localStorage, then reloads so Firebase picks up a valid cached session.
  // Requires VITE_FIREBASE_API_KEY, TEST_USER_EMAIL, and TEST_USER_PASSWORD.
  // Create the test account once in the Firebase console and add credentials to
  // .env.local (local) or CI secrets (workflow).

  describe('Main page (authenticated)', () => {
    const canRunAuth = !!(FIREBASE_API_KEY && TEST_USER_EMAIL && TEST_USER_PASSWORD);

    if (!canRunAuth) {
      console.warn(
        '\nVITE_FIREBASE_API_KEY / TEST_USER_EMAIL / TEST_USER_PASSWORD not set — ' +
        'authenticated page tests will be skipped.\n'
      );
    }

    const itAuth = canRunAuth ? test : test.skip;

    beforeEach(async () => {
      if (!canRunAuth) return;
      const tokenData = await signInTestUser(FIREBASE_API_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD);
      const user = buildFirebaseUser(FIREBASE_API_KEY, tokenData);
      await driver.get(BASE_URL);
      await driver.executeScript(
        'localStorage.setItem(arguments[0], arguments[1]);',
        `firebase:authUser:${FIREBASE_API_KEY}:[DEFAULT]`,
        JSON.stringify(user)
      );
      await driver.navigate().refresh();
    });

    itAuth('header is visible with correct heading', async () => {
      const heading = await driver.wait(
        until.elementLocated(By.id('header-heading')),
        10000
      );
      expect(await heading.getText()).toBe('Research Assistant');
      expect(await heading.isDisplayed()).toBe(true);
    }, 15000);  

    itAuth('research form inputs are visible', async () => {
      await driver.wait(until.elementLocated(By.id('input-form')), 10000);

      const topicInput = await driver.findElement(By.id('topic'));
      expect(await topicInput.isDisplayed()).toBe(true);

      const analystInput = await driver.findElement(By.id('maxAnalysts'));
      expect(await analystInput.isDisplayed()).toBe(true);

      const feedbackInput = await driver.findElement(By.id('feedback'));
      expect(await feedbackInput.isDisplayed()).toBe(true);
    }, 15000);

    itAuth('start research button is present and enabled', async () => {
      const btn = await driver.wait(
        until.elementLocated(By.id('btn-primary')),
        10000
      );
      expect(await btn.getText()).toBe('Start Research');
      expect(await btn.isEnabled()).toBe(true);
    }, 15000);

    itAuth('sign out button is visible in the header', async () => {
      await driver.wait(until.elementLocated(By.id('user-info')), 10000);
      const signOutBtn = await driver.findElement(By.id('btn-signout'));
      expect(await signOutBtn.getText()).toBe('Sign Out');
      expect(await signOutBtn.isDisplayed()).toBe(true);
    }, 15000);
  });
});
