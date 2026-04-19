# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A LangGraph-powered agentic research assistant that orchestrates multiple AI analyst personas to research a topic via parallel interviews, then synthesizes findings into a structured report. A Vite/React frontend communicates with the LangGraph API using streaming updates and supports human-in-the-loop feedback.

## Running Locally

### Agent (LangGraph)

```bash
cd agent
# Populate .env with OPENAI_API_KEY, TAVILY_API_KEY, LANGSMITH_API_KEY

# Option 1: Dev server (hot reload)
langgraph up

# Option 2: Build image + docker compose
langgraph build -t research-assistant:latest
docker compose up
```

The API is available at `http://localhost:8123`. The graph name is `research_assistant`.

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev   # starts at http://localhost:3000
```

Frontend env vars (create `frontend/.env.local`):
- `VITE_FIREBASE_*` — Firebase project config
- `VITE_API_GATEWAY_KEY` — API Gateway key
- `VITE_API_GATEWAY_URL` — URL the frontend posts to (proxies to LangGraph API)
- `VITE_CLOUD_RUN_URL` — Cloud Run URL (for reference)

## Architecture

### Agent (`agent/`)

The graph is defined in `research_assistant.py` and exposes the compiled `graph` object. There are two nested StateGraphs:

1. **Outer graph** (`ResearchGraphState`) — top-level workflow:
   - `create_analysts` → `human_feedback` *(interrupt here)* → `conduct_interview` (parallel, via `Send()` API) → `write_report` + `write_introduction` + `write_conclusion` → `finalize_report`

2. **Inner graph** (`InterviewState`) — one per analyst, runs in parallel:
   - `ask_question` → `search_web` + `search_wikipedia` (parallel) → `answer_question` → (loop via `route_messages`) → `save_interview` → `write_section`

Key files:
- `research_assistant.py` — all graph nodes, edges, prompts, and graph compilation
- `common.py` — shared Pydantic models: `Analyst`, `InterviewState`
- `constants.py` — model name (`gpt-4o-mini`), turn limits, word counts, separators
- `tools/search_web.py` — Tavily search tool (returns 3 results)
- `tools/search_wikipedia.py` — Wikipedia loader (returns 2 docs)
- `tools/seach_instructions.py` — shared `SearchQuery` schema and system prompt used by both tools
- `langgraph.json` — graph registration, CORS config, Python version

### Human-in-the-Loop

The graph interrupts before `human_feedback`. The frontend detects the `__interrupt__` event in the stream, displays the created analysts, and lets the user modify feedback. Resuming sends `command: { resume: humanFeedback }` via the LangGraph SDK. Typing `"yes"` (case-insensitive) proceeds; any other value triggers analyst regeneration.

### Frontend (`frontend/src/`)

- `ResearchAssistant.jsx` — single main component; manages all state, streaming, and human-in-the-loop flow
- `firebase.js` — Firebase init, GitHub OAuth (`GithubAuthentication`), `signOutUser`; also exports `firebaseConfig.apiUrl` used as the LangGraph API endpoint
- Auth: GitHub OAuth via Firebase. Every API request attaches `Authorization: Bearer <Firebase ID token>` and `X-Api-Key` for the API Gateway.

### Dependencies

Python runtime: 3.11 (pinned in `agent/.python-version`).  
Frontend package manager: `pnpm`.
