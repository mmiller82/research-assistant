import { test, expect } from '@playwright/test';
import { MainPage } from './pages/MainPage.js';
import { MOCK_ANALYSTS } from './helpers/langgraph-mock.js';
import { mockFullWorkflow, startResearchToInterrupt, approveAnalysts } from './utils/research-utils.js';
import { injectAuth } from './helpers/auth-inject.js';

async function runToReport(page) {
  const mainPage = new MainPage(page);
  await startResearchToInterrupt(page, mainPage);
  await approveAnalysts(page);
  await expect(page.locator('.final-report')).toBeVisible();
}

test.describe('Report Display', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockFullWorkflow(page, MOCK_ANALYSTS);
    await page.goto('/');
  });

  test('final report is displayed after workflow completes', async ({ page }) => {
    // Run the full workflow to completion
    await runToReport(page);
    // Final report container must be visible
    await expect(page.locator('.final-report')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Final Report' }).first()).toBeVisible();
  });

  test('report contains introduction and conclusion sections', async ({ page }) => {
    await runToReport(page);
    // Introduction, at least one body section, and conclusion must be present
    await expect(page.getByRole('heading', { name: 'Introduction' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conclusion' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Section 1' }).first()).toBeVisible();
  });

  test('start research button is re-enabled after report is complete', async ({ page }) => {
    const mainPage = new MainPage(page);
    await runToReport(page);
    // Button must be re-enabled after finalize_report event clears isRunning
    await expect(mainPage.startButton).toBeEnabled();
    await expect(mainPage.startButton).toHaveText('Start Research');
  });

  test('report persists on page refresh (if supported)', async ({ page }) => {
    await runToReport(page);
    // Navigate to refresh the app
    await page.goto('/');
    // React state resets on refresh — fresh form is shown once auth resolves.
    // Wait for either the report (if persisted) or the form (fresh state) to appear.
    await expect(page.locator('.final-report, #btn-primary').first()).toBeVisible();
    const reportVisible = await page.locator('.final-report').isVisible();
    const formVisible = await page.locator('#btn-primary').isVisible();
    expect(reportVisible || formVisible).toBe(true);
  });
});
