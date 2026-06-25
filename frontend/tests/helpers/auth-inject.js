// Helper to inject Firebase auth state into IndexedDB before a page loads.
// Firebase v9+ uses IndexedDB (not localStorage) for auth persistence; Playwright's
// storageState() cannot capture IndexedDB, so each authenticated test must call
// injectAuth() before page.goto() instead of relying on storageState.

import fs from 'fs';

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
const AUTH_FILE = 'tests/.auth/user.json';

/**
 * Registers an addInitScript on the page that pre-seeds Firebase's IndexedDB
 * with the saved auth token before any page script runs.
 * Must be called BEFORE page.goto().
 *
 * NOTE: addInitScript fires on EVERY navigation in the page context, including
 * navigations after sign-out. Use injectAuthOnce() instead for tests that sign
 * out and then navigate again.
 */
export async function injectAuth(page) {
  const { firebaseUser } = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  const idbKey = `firebase:authUser:${FIREBASE_API_KEY}:[DEFAULT]`;

  await page.addInitScript(({ key, userRecord }) => {
    const openReq = indexedDB.open('firebaseLocalStorageDb', 1);
    openReq.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    };
    openReq.onsuccess = (e) => {
      const tx = e.target.result.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value: userRecord });
    };
  }, { key: idbKey, userRecord: firebaseUser });
}

/**
 * Imperatively writes Firebase auth into IndexedDB on a page that has ALREADY loaded.
 * Then reloads the page so Firebase picks up the auth state.
 *
 * Unlike injectAuth(), this does NOT register an addInitScript, so it will NOT
 * re-inject on subsequent page.goto() calls. Use this for tests that need auth
 * for the initial load but then sign out and navigate again to verify auth is gone.
 */
export async function injectAuthOnce(page) {
  const { firebaseUser } = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  const idbKey = `firebase:authUser:${FIREBASE_API_KEY}:[DEFAULT]`;

  await page.evaluate(({ key, userRecord }) => {
    return new Promise((resolve, reject) => {
      const openReq = indexedDB.open('firebaseLocalStorageDb', 1);
      openReq.onupgradeneeded = (e) => {
        e.target.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
      };
      openReq.onsuccess = (e) => {
        const tx = e.target.result.transaction('firebaseLocalStorage', 'readwrite');
        const req = tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value: userRecord });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });
  }, { key: idbKey, userRecord: firebaseUser });

  await page.reload();
}
