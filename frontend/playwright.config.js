import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',  
  /* Run tests in files in parallel */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /* Retry on CI 2 times and locally 1 time */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['line']],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:4173',
    headless: true,
    viewport: { width: 1256, height: 1024 },
    trace: "on",
    actionTimeout: 0,
    ignoreHTTPSErrors: true,
    video: "retain-on-failure",
    screenshot: "retain-on-failure",
    headless: true,  
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  snapshotDir: './tests/testdata',
  snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',

  /* Configure projects for browser */
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },    
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["clipboard-read"],
      },
    },
  ]
});
