import { test, expect } from '@playwright/test';
import { MainPage } from './pages/MainPage.js';
import { mockThreadCreate, mockStreamWithInterrupt, MOCK_ANALYSTS } from './helpers/langgraph-mock.js';
import { injectAuth } from './helpers/auth-inject.js';

test.describe('Research Workflow — Streaming Progress', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockThreadCreate(page);
    await page.goto('/');
  });

  test('streaming status messages appear after starting research', async ({ page }) => {
    const mainPage = new MainPage(page);
    await mockStreamWithInterrupt(page);
    // Start research
    await mainPage.topicInput.fill('Artificial Intelligence');
    await mainPage.analystInput.fill('2');
    await mainPage.startButton.click();
    // A status message and interrupt panel should appear
    await expect(page.locator('.status')).toBeVisible();
    await expect(page.locator('.interrupt-panel')).toBeVisible();
  });

  test('start button is disabled while research is running', async ({ page }) => {
    const mainPage = new MainPage(page);
    // Use a delayed route so we can observe the running state
    await page.route('**/threads/**/runs/stream', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'event: metadata\ndata: {"run_id":"mock-run-001"}\n\n',
          `event: updates\ndata: ${JSON.stringify({ create_analysts: { analysts: MOCK_ANALYSTS } })}\n\n`,
          `event: updates\ndata: ${JSON.stringify({ __interrupt__: [{ value: 'Waiting' }] })}\n\n`,
        ].join(''),
      });
    });
    await mainPage.topicInput.fill('Artificial Intelligence');
    await mainPage.startButton.click();
    // Button must be disabled while the stream is pending
    await expect(mainPage.startButton).toBeDisabled();
    // Once the stream completes, button is re-enabled
    await expect(mainPage.startButton).toBeEnabled();
  });

  test('analyst creation step is reflected in the UI', async ({ page }) => {
    const mainPage = new MainPage(page);
    await mockStreamWithInterrupt(page);
    await mainPage.topicInput.fill('Artificial Intelligence');
    await mainPage.startButton.click();
    // create_analysts step name must appear in the Research Progress log
    await expect(page.getByText('create_analysts')).toBeVisible();
    // An analyst card (Dr. Alice Chen) from the mock should be visible
    await expect(page.getByRole('heading', { name: 'Dr. Alice Chen' }).first()).toBeVisible();
  });
});
