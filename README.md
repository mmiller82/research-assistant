# Research Assistant 🔍
This server uses a Agentic workflow that combines Human-in-the-Loop capabilities with [Tavily's](https://tavily.com/) real-time search and is accessed by a vite frontend
Powered by [LangGraph](https://www.langchain.com/langgraph), it simplifies complex research tasks, making them more interactive and efficient.


## Quick Start 🚀

### 1. Prerequisites
This projects uses the following tools:

- [pnpm](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/)
- [Langgraph CLI](https://langchain-ai.github.io/langgraph/cloud/reference/cli/)

### 2. API Keys Needed
Running locally, you'll need the following API keys:

- [OpenAI](https://platform.openai.com/api-keys)
- [Tavily](https://tavily.com/#pricing)
- [LangSmith](https://docs.smith.langchain.com/administration/how_to_guides/organization_management/create_account_api_key)

### 3. Start the Agent
There are two main components to this project: the agent and the frontend. First, we'll start the agent.

```bash
cd agent

# Create and populate .env
cat << EOF > .env
OPENAI_API_KEY=your_key
TAVILY_API_KEY=your_key
LANGSMITH_API_KEY=your_key
EOF

## Start the agent
langgraph up or langgraph build -t research-assistant:latest and docker compose up

# Note the API URL from the output (e.g., http://localhost:8123)
```


### 4. Start the Frontend
Next, we'll start the frontend.

```bash
cd frontend
pnpm install

# Start the app
pnpm run dev
```

## Testing

The frontend has a Selenium WebDriver E2E test suite driven by Jest (`frontend/tests/auth.test.mjs`). Tests cover the login page (unauthenticated) and the main research page (authenticated).

### Running locally

```bash
cd frontend

# Build and serve the production bundle (tests run against the preview server)
pnpm run build
pnpm run preview &

# Run the tests
pnpm run test
```

### Environment variables

Create `frontend/.env.local` with the following to enable the authenticated-page tests:

```
VITE_FIREBASE_API_KEY=your_key
TEST_USER_EMAIL=your_test_user@example.com
TEST_USER_PASSWORD=your_test_password
```

The authenticated tests sign in a real Firebase email/password account via the Firebase REST API and inject the token into `localStorage`. If any of these three variables are missing the authenticated tests are automatically skipped rather than failed.

### CI

The frontend pipeline builds the app with all `VITE_*` secrets baked in, starts a Vite preview server, and runs the full test suite. The following GitHub Actions secrets are required:

| Secret | Used by |
|---|---|
| `VITE_FIREBASE_API_KEY` | Build + tests |
| `VITE_FIREBASE_APP_ID` | Build |
| `VITE_FIREBASE_AUTH_DOMAIN` | Build |
| `VITE_FIREBASE_PROJECT_ID` | Build |
| `VITE_API_GATEWAY_KEY` | Build |
| `VITE_API_GATEWAY_URL` | Build |
| `VITE_CLOUD_RUN_URL` | Build |
| `TEST_USER_EMAIL` | Tests |
| `TEST_USER_PASSWORD` | Tests |

## Documentation 📚
- [LangGraph Platform Docs](https://langchain-ai.github.io/langgraph/cloud/deployment/cloud/)
