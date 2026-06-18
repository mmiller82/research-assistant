import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:4173',
    headless: true,
    viewport: { width: 1256, height: 1024 },
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  snapshotDir: './tests/testdata',
  snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',
});
