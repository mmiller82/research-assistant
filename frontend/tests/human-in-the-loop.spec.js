import { test, expect } from '@playwright/test';
import { MainPage } from './pages/MainPage.js';
import { mockThreadCreate, mockStreamWithInterrupt, mockResumeStream, buildSseBody, MOCK_ANALYSTS } from './helpers/langgraph-mock.js';
import { startResearchToInterrupt } from './utils/research-utils.js';
import { injectAuth } from './helpers/auth-inject.js';

const REGENERATED_ANALYSTS = [
  {
    name: 'Dr. Eve Nakamura',
    role: 'Ethics Researcher',
    affiliation: 'Oxford',
    description: 'Expert in AI ethics and societal impact.',
    focus: 'Ethics in AI',
  },
];

test.describe('Human-in-the-Loop — Analyst Review', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockThreadCreate(page);
    await mockStreamWithInterrupt(page);
    // State endpoint used by updateState() when user clicks Continue Research
    await page.route('**/threads/**/state', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/');
  });

  test('analyst cards are displayed at the interrupt point', async ({ page }) => {
    const mainPage = new MainPage(page);
    await startResearchToInterrupt(page, mainPage);
    // Analyst cards from MOCK_ANALYSTS should be visible
    await expect(page.getByRole('heading', { name: 'Dr. Alice Chen' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prof. Bob Martinez' }).first()).toBeVisible();
  });

  test('feedback input appears at the interrupt point', async ({ page }) => {
    const mainPage = new MainPage(page);
    await startResearchToInterrupt(page, mainPage);
    // Continue feedback input and Continue Research button must be present
    await expect(page.locator('#continueFeedback')).toBeVisible();
    await expect(page.locator('.btn-continue')).toBeVisible();
  });

  test("typing 'yes' proceeds to interview phase", async ({ page }) => {
    const mainPage = new MainPage(page);
    await mockResumeStream(page);
    await startResearchToInterrupt(page, mainPage);
    // Submit 'yes' — workflow should continue to final report
    await page.locator('#continueFeedback').fill('yes');
    await page.locator('.btn-continue').click();
    // Interrupt panel disappears and the report section appears
    await expect(page.locator('.interrupt-panel')).not.toBeVisible();
    await expect(page.locator('.final-report')).toBeVisible();
  });

  test("typing 'YES' (uppercase) also proceeds — case-insensitive", async ({ page }) => {
    const mainPage = new MainPage(page);
    await mockResumeStream(page);
    await startResearchToInterrupt(page, mainPage);
    // Submit uppercase 'YES' — should behave the same as lowercase
    await page.locator('#continueFeedback').fill('YES');
    await page.locator('.btn-continue').click();
    await expect(page.locator('.interrupt-panel')).not.toBeVisible();
    await expect(page.locator('.final-report')).toBeVisible();
  });

  test('providing non-yes feedback regenerates analysts', async ({ page }) => {
    const mainPage = new MainPage(page);
    // The LangGraph SDK doesn't include the resume value in the stream body,
    // so distinguish calls by count: first = initial interrupt, second = regenerated analysts.
    let streamCall = 0;
    await page.route('**/threads/**/runs/stream', async (route) => {
      streamCall++;
      if (streamCall > 1) {
        await route.fulfill({
          status: 200, contentType: 'text/event-stream',
          body: buildSseBody([
            { event: 'metadata', data: { run_id: 'mock-run-002' } },
            { event: 'updates', data: { create_analysts: { analysts: REGENERATED_ANALYSTS } } },
            { event: 'updates', data: { __interrupt__: [{ value: 'Waiting' }] } },
          ]),
        });
      } else {
        await route.fulfill({
          status: 200, contentType: 'text/event-stream',
          body: buildSseBody([
            { event: 'metadata', data: { run_id: 'mock-run-001' } },
            { event: 'updates', data: { create_analysts: { analysts: MOCK_ANALYSTS } } },
            { event: 'updates', data: { __interrupt__: [{ value: 'Waiting' }] } },
          ]),
        });
      }
    });
    await startResearchToInterrupt(page, mainPage);
    // Submit non-yes feedback
    await page.locator('#continueFeedback').fill('Please add an expert in ethics');
    await page.locator('.btn-continue').click();
    // A new interrupt panel appears with regenerated analysts
    await expect(page.locator('.interrupt-panel')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dr. Eve Nakamura' }).first()).toBeVisible();
  });

  test('submitting empty feedback does not crash the app', async ({ page }) => {
    const mainPage = new MainPage(page);
    await startResearchToInterrupt(page, mainPage);
    // Clear the feedback field and submit
    await page.locator('#continueFeedback').fill('');
    await page.locator('.btn-continue').click();
    // App should remain functional — either validation or graceful handling
    await expect(page.locator('#header-heading')).toBeVisible();
  });
});
