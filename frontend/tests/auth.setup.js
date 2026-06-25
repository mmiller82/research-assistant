// spec: frontend/specs/test.plan.md
// Saves authenticated token data so test suites can inject Firebase auth via IndexedDB.
// Firebase v9+ uses IndexedDB (not localStorage) for auth persistence, so Playwright's
// storageState() cannot capture it. Instead we save raw token data to a JSON file and
// each authenticated test injects it via addInitScript before page.goto().

import { test as setup, expect } from '@playwright/test';
import { signInTestUser, buildFirebaseUser } from './helpers/firebase.js';
import fs from 'fs';
import path from 'path';

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const AUTH_FILE = 'tests/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const tokenData = await signInTestUser(FIREBASE_API_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD);
  const user = buildFirebaseUser(FIREBASE_API_KEY, tokenData);

  // Save token data as plain JSON (not Playwright storageState).
  // Tests will inject this into Firebase's IndexedDB via addInitScript.
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ firebaseUser: user }, null, 2));

  // Verify the injection works end-to-end before declaring setup done.
  const idbKey = `firebase:authUser:${FIREBASE_API_KEY}:[DEFAULT]`;
  await page.addInitScript(({ key, userRecord }) => {
    // Runs in browser before any page script — pre-seeds Firebase's IndexedDB.
    const openReq = indexedDB.open('firebaseLocalStorageDb', 1);
    openReq.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    };
    openReq.onsuccess = (e) => {
      const tx = e.target.result.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value: userRecord });
    };
  }, { key: idbKey, userRecord: user });

  await page.goto('/');

  // Verify authenticated state — the start button only appears when authenticated.
  await expect(page.locator('#btn-primary')).toBeVisible();
});
