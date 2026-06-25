// Shared LangGraph API mock helpers for Playwright tests.
// Sets up page.route() mocks for the LangGraph SDK endpoints.

const MOCK_ANALYSTS = [
  {
    name: 'Dr. Alice Chen',
    role: 'Technology Researcher',
    affiliation: 'MIT',
    description: 'Expert in emerging technologies and AI applications.',
    focus: 'AI impact on society',
  },
  {
    name: 'Prof. Bob Martinez',
    role: 'Policy Analyst',
    affiliation: 'Stanford University',
    description: 'Specialist in technology policy and governance.',
    focus: 'Regulatory frameworks for AI',
  },
];

export function buildSseBody(events) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n`)
    .join('\n') + '\n';
}

/**
 * Mock only the thread create endpoint — returns a thread id immediately.
 * Useful when the stream itself is not the focus of the test.
 */
export async function mockThreadCreate(page, threadId = 'mock-thread-001') {
  await page.route('**/threads', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ thread_id: threadId }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the stream endpoint to emit metadata → create_analysts → __interrupt__ → (end).
 * Triggers the human-in-the-loop interrupt panel.
 */
export async function mockStreamWithInterrupt(page) {
  await page.route('**/threads/**/runs/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: buildSseBody([
        { event: 'metadata', data: { run_id: 'mock-run-001' } },
        { event: 'updates', data: { create_analysts: { analysts: MOCK_ANALYSTS } } },
        { event: 'updates', data: { __interrupt__: [{ value: 'Waiting for human feedback' }] } },
      ]),
    });
  });
}

/**
 * Mock the stream endpoint to emit a complete workflow through to finalise_report.
 */
export async function mockStreamComplete(page) {
  await page.route('**/threads/**/runs/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: buildSseBody([
        { event: 'metadata', data: { run_id: 'mock-run-001' } },
        { event: 'updates', data: { create_analysts: { analysts: MOCK_ANALYSTS } } },
        { event: 'updates', data: { __interrupt__: [{ value: 'Waiting for human feedback' }] } },
      ]),
    });
  });
}

/**
 * Mock the thread updateState and resume stream after the interrupt is approved.
 * Emits interview → introduction → conclusion → finalize_report → end.
 */
export async function mockResumeStream(page) {
  await page.route('**/threads/**/state', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // The LangGraph SDK does not include a 'command' field in the HTTP body for resume calls.
  // Distinguish initial vs. resume by call count: first call = interrupt, subsequent = report.
  let callCount = 0;
  await page.route('**/threads/**/runs/stream', async (route) => {
    callCount++;
    if (callCount > 1) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: buildSseBody([
          { event: 'updates', data: { conduct_interview: { sections: ['## Section 1\nContent here.'] } } },
          { event: 'updates', data: { write_introduction: { introduction: '# Introduction\nThis report covers...' } } },
          { event: 'updates', data: { write_conclusion: { conclusion: '# Conclusion\nIn summary...' } } },
          {
            event: 'updates',
            data: {
              finalize_report: {
                final_report: '# Final Report\n## Introduction\nThis report covers...\n## Section 1\nContent here.\n## Conclusion\nIn summary...',
              },
            },
          },
          { event: 'end', data: {} },
        ]),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: buildSseBody([
          { event: 'metadata', data: { run_id: 'mock-run-001' } },
          { event: 'updates', data: { create_analysts: { analysts: MOCK_ANALYSTS } } },
          { event: 'updates', data: { __interrupt__: [{ value: 'Waiting for human feedback' }] } },
        ]),
      });
    }
  });
}

export { MOCK_ANALYSTS };
