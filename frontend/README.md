# Research Assistant Frontend

A React frontend for the LangGraph Research Assistant that uses streaming to display real-time research progress.

## Features

- Stream-based UI using LangGraph SDK
- Real-time display of research progress
- Interactive analyst creation and interview process
- Markdown rendering for the final report
- Beautiful gradient UI with responsive design

## Prerequisites

- Node.js 18+ and pnpm
- LangGraph API running on `http://localhost:8123`

## Installation

```bash
pnpm install
```

## Running the Development Server

```bash
pnpm run dev
```

The application will be available at `http://localhost:3000`

## Building for Production

```bash
pnpm run build
```

This runs `vite build` and outputs static files to the `dist/` directory.

## Deploying to Firebase Hosting

### Prerequisites

1. Install the Firebase CLI:

   ```bash
   npm install -g firebase-tools
   ```

2. Log in to Firebase:

   ```bash
   firebase login
   ```

### Deploy

From the `frontend/` directory:

```bash
pnpm run build
firebase deploy --only hosting
```

This deploys the `dist/` directory to the `research-assistant` Firebase project as configured in `.firebaserc` and `firebase.json`.

The `firebase.json` hosting config includes rewrites that proxy `/threads` and `/threads/**` requests to the API gateway, so the deployed app can communicate with the LangGraph backend.

### Preview (optional)

To test the production build locally before deploying:

```bash
firebase emulators:start --only hosting
```

## Playwright Tests

End-to-end tests live in `frontend/tests/` and are run with [Playwright](https://playwright.dev/).

### Prerequisites

- A built app served at `http://localhost:4173` (`pnpm run build && pnpm run preview`)
- A Firebase test user account created in the Firebase console
- Environment variables set in `frontend/.env.local`:

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `TEST_USER_EMAIL` | Email of the Firebase test user |
| `TEST_USER_PASSWORD` | Password of the Firebase test user |

### Running the tests

```bash
# Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# Build and serve the app, then run tests
pnpm run build
pnpm run preview &
pnpm run test
```

### How authentication works

Firebase v9 stores auth state in IndexedDB, which Playwright's `storageState` cannot capture. Instead:

1. A global setup step (`tests/auth.setup.js`) signs in via the Firebase REST API and writes the user token to `tests/.auth/user.json`.
2. Each authenticated test calls `injectAuth(page)` from `tests/helpers/auth-inject.js` before `page.goto()`. This registers an `addInitScript` that pre-seeds Firebase's IndexedDB so the app boots in an authenticated state.

### Test structure

| File | What it covers |
|------|----------------|
| `tests/auth.spec.js` | Login page, authenticated main page, sign-out flows |
| `tests/research-form.spec.js` | Form validation (empty topic, analyst count, special characters) |
| `tests/research-workflow.spec.js` | Streaming progress, status messages, button states |
| `tests/human-in-the-loop.spec.js` | Analyst review panel, feedback submission, analyst regeneration |
| `tests/report.spec.js` | Final report display and structure |

LangGraph API calls are intercepted with `page.route()` mocks (see `tests/helpers/langgraph-mock.js`) so tests run without a live backend.

### Playwright config

The config (`playwright.config.js`) runs two projects:

- **setup** — runs `*.setup.js` files before any spec; creates `tests/.auth/user.json`
- **chromium** — runs all `*.spec.js` files; depends on setup completing successfully

On CI, retries are set to 2 and workers to 1. Traces are always captured; video and screenshots are retained on failure.

## CI/CD — GitHub Actions

The workflow at `.github/workflows/frontend-pipeline.yaml` builds the frontend and deploys it to Firebase Hosting automatically through the following triggers.

### Triggers

| Event | Condition |
|-------|-----------|
| `push` | Any commit that changes a file under `frontend/` |
| `workflow_dispatch` | Manual run from the GitHub Actions UI (requires the workflow to be on the default branch) |

### What it does

1. Checks out the repo and sets up pnpm 9 + Node 22.
2. Runs `pnpm install` and `pnpm run build` inside the `frontend/` directory.
3. Deploys the `dist/` 
4. Outputs to Firebase Hosting via `FirebaseExtended/action-hosting-deploy@v0`.

### Required secrets

Add these under **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Description |
|--------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_RESEARCH_ASSISTANT_6603F` | Firebase service account JSON with Hosting deploy permissions |
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (e.g. `your-project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket (e.g. `your-project.appspot.com`) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics measurement ID |
| `VITE_API_GATEWAY_KEY` | API Gateway key passed as `X-Api-Key` on every request |
| `VITE_API_GATEWAY_URL` | API Gateway URL the frontend posts to (proxies to the LangGraph backend) |
| `VITE_CLOUD_RUN_URL` | Cloud Run service URL |

`GITHUB_TOKEN` is provided automatically by GitHub and does not need to be added manually.

### Manual trigger

The "Run workflow" button appears in the **Actions** tab only after the workflow file has been merged into the default branch (`master`). Until then, push any change under `frontend/` to trigger the pipeline via the `push` path.

## How It Works

The frontend uses the `@langchain/langgraph-sdk` Client to:

1. Connect to the LangGraph API running in Docker
2. Create a thread for the research session
3. Stream updates as the graph executes
4. Display real-time progress for each node:
   - Analyst creation
   - Interview conduction
   - Report writing
   - Introduction and conclusion generation
   - Final report assembly

## Usage

1. Enter a research topic (e.g., "The impact of AI on healthcare")
2. Choose the number of analysts (1-5)
3. Click "Start Research"
4. Provide human feedback (use "yes" to accept analysts)
5. Click "Continue Research"
6. View the final report when complete

## Configuration

The API URL is configured in the `ResearchAssistant.jsx` component:

```javascript
const client = new Client({ apiUrl: 'http://localhost:8123' })
```

Update this URL if your LangGraph API is running on a different host/port.

## Components

- `App.jsx` - Main application component
- `ResearchAssistant.jsx` - Core research interface with streaming
- Styled with CSS modules for a modern, gradient design

## Streaming Architecture

The application uses the LangGraph SDK's streaming capabilities:

```javascript
const streamResponse = client.runs.stream(
  thread.thread_id,
  'research_assistant',
  {
    input,
    streamMode: 'updates'
  }
)

for await (const chunk of streamResponse) {
  // Process streaming updates
}
```

This provides real-time updates as the research graph executes, showing progress for each node.
