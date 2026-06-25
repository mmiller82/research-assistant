// Shared utility actions used across multiple test suites.

import { expect } from '@playwright/test';

/**
 * Sets up LangGraph API mocks that drive a research run through to the
 * human-in-the-loop interrupt point (create_analysts → __interrupt__).
 */
export async function mockResearchUntilInterrupt(page, analysts) {
  await page.route('**/threads', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ thread_id: 'mock-thread-001' }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/threads/**/runs/stream', async (route) => {
    const body = [
      'event: metadata\ndata: {"run_id":"mock-run-001"}\n',
      `event: updates\ndata: ${JSON.stringify({ create_analysts: { analysts } })}\n`,
      `event: updates\ndata: ${JSON.stringify({ __interrupt__: [{ value: 'Waiting for human feedback' }] })}\n`,
    ].join('\n') + '\n'; // trailing \n ensures last event is flushed by the SSE parser
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
  });
}

/**
 * Sets up LangGraph API mocks for a full workflow:
 * initial stream → interrupt, then resume stream → finalize_report → end.
 */
export async function mockFullWorkflow(page, analysts) {
  await page.route('**/threads', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ thread_id: 'mock-thread-001' }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/threads/**/state', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  let streamCall = 0;
  await page.route('**/threads/**/runs/stream', async (route) => {
    streamCall++;
    if (streamCall === 1) {
      const body = [
        'event: metadata\ndata: {"run_id":"mock-run-001"}\n',
        `event: updates\ndata: ${JSON.stringify({ create_analysts: { analysts } })}\n`,
        `event: updates\ndata: ${JSON.stringify({ __interrupt__: [{ value: 'Waiting' }] })}\n`,
      ].join('\n') + '\n'; // trailing \n ensures last event is flushed by the SSE parser
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
    } else {
      const body = [
        `event: updates\ndata: ${JSON.stringify({ conduct_interview: { sections: ['## Section 1\nContent here.'] } })}\n`,
        `event: updates\ndata: ${JSON.stringify({ write_introduction: { introduction: '# Introduction\nThis report covers AI.' } })}\n`,
        `event: updates\ndata: ${JSON.stringify({ write_conclusion: { conclusion: '# Conclusion\nIn summary...' } })}\n`,
        `event: updates\ndata: ${JSON.stringify({ finalize_report: { final_report: '# Final Report\n## Introduction\nThis report covers AI.\n## Section 1\nContent here.\n## Conclusion\nIn summary...' } })}\n`,
        'event: end\ndata: {}\n',
      ].join('\n') + '\n'; // trailing \n ensures last event is flushed by the SSE parser
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
    }
  });
}

/**
 * Starts a research run and waits until the interrupt panel is visible.
 */
export async function startResearchToInterrupt(page, mainPage, topic = 'Artificial Intelligence') {
  await mainPage.topicInput.fill(topic);
  await mainPage.startButton.click();
  await expect(page.locator('.interrupt-panel')).toBeVisible();
}

/**
 * Approves analysts by typing feedback and clicking Continue Research.
 */
export async function approveAnalysts(page, feedback = 'yes') {
  await page.locator('#continueFeedback').fill(feedback);
  await page.locator('.btn-continue').click();
}
