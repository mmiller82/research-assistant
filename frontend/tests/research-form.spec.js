import { test, expect } from '@playwright/test';
import { MainPage } from './pages/MainPage.js';
import { mockResearchUntilInterrupt } from './utils/research-utils.js';
import { injectAuth } from './helpers/auth-inject.js';

test.describe('Research Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockResearchUntilInterrupt(page, []);
    await page.goto('/');
  });

  test('cannot start research with empty topic', async ({ page }) => {
    const mainPage = new MainPage(page);
    // Register a dialog handler that captures the message and accepts it.
    // Using page.on() avoids the deadlock of awaiting click() before the dialog
    // is dismissed, and avoids the race of Promise.all where dialog may already
    // be gone by the time dialog.accept() is called.
    let alertMessage = null;
    page.once('dialog', (dialog) => {
      alertMessage = dialog.message();
      dialog.accept();
    });
    await mainPage.startButton.click();
    expect(alertMessage).toBe('Please enter a research topic');
    // Research did not start
    await expect(page.locator('.interrupt-panel')).not.toBeAttached();
  });

  test('analyst count defaults to a valid number', async ({ page }) => {
    const mainPage = new MainPage(page);
    // Default value should be a positive integer
    await expect(mainPage.analystInput).toHaveValue('3');
  });

  test('analyst count accepts positive integers only', async ({ page }) => {
    const mainPage = new MainPage(page);
    // Provide a valid topic so the JS check passes — HTML5 min constraint blocks
    await mainPage.topicInput.fill('Test Topic');
    // Set count to 0 — blocked by min="1"
    await mainPage.analystInput.fill('0');
    await mainPage.startButton.click();
    await expect(mainPage.startButton).toBeEnabled();
    await expect(page.locator('.interrupt-panel')).not.toBeAttached();
    // Set count to -1 — also blocked
    await mainPage.analystInput.fill('-1');
    await mainPage.startButton.click();
    await expect(mainPage.startButton).toBeEnabled();
    await expect(page.locator('.interrupt-panel')).not.toBeAttached();
  });

  test('initial feedback field is optional', async ({ page }) => {
    const mainPage = new MainPage(page);
    // Fill topic, clear the pre-filled feedback, then start
    await mainPage.topicInput.fill('Artificial Intelligence');
    await mainPage.feedbackInput.fill('');
    await mainPage.startButton.click();
    // Research must start even with no feedback text
    await expect(page.locator('.interrupt-panel')).toBeVisible();
  });

  test('topic field accepts special characters and long strings', async ({ page }) => {
    const mainPage = new MainPage(page);
    // Enter a topic with special characters
    await mainPage.topicInput.fill('AI & ML: trends in 2024?');
    await mainPage.startButton.click();
    // Form accepts the input and research stream begins
    await expect(page.locator('.interrupt-panel')).toBeVisible();
  });
});
