# Research Assistant

An agentic research tool that spins up multiple AI analyst personas to interview domain experts in parallel, then synthesizes the findings into a structured report. A Vite/React frontend drives the workflow with real-time streaming and human-in-the-loop feedback.

Built with [LangGraph](https://www.langchain.com/langgraph), [Tavily](https://tavily.com/) search, and Firebase authentication.

## Repository layout

```
agent/       LangGraph backend — graph definition, tools, CI/Cloud Run docs
frontend/    Vite/React frontend — UI, Firebase auth, streaming
```

See each directory's `README.md` for detailed setup and architecture notes.

## Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/)
- [LangGraph CLI](https://langchain-ai.github.io/langgraph/cloud/reference/cli/)

## Quick start

**1. Start the agent**

```bash
cd agent
# populate .env with OPENAI_API_KEY, TAVILY_API_KEY, LANGSMITH_API_KEY
langgraph up
```

**2. Start the frontend**

```bash
cd frontend
pnpm install
pnpm run dev   # http://localhost:3000
```

## Testing

The frontend has a Selenium WebDriver E2E test suite driven by Jest. Tests cover the login page (unauthenticated) and the main research page (authenticated).

```bash
cd frontend
pnpm run build && pnpm run preview &
pnpm run test
```

See `frontend/README.md` for environment variables and CI configuration.

## Documentation

- [LangGraph Platform Docs](https://langchain-ai.github.io/langgraph/cloud/deployment/cloud/)
