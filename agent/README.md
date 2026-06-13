# Agent

LangGraph-powered agentic backend that orchestrates multiple AI analyst personas to research a topic via parallel interviews and synthesizes the findings into a structured report.

## Architecture

The graph is defined in `research_assistant.py` and exposes the compiled `graph` object. There are two nested `StateGraph`s:

**Outer graph** (`ResearchGraphState`) — top-level workflow:
```
create_analysts → human_feedback (interrupt) → conduct_interview (parallel) → write_report + write_introduction + write_conclusion → finalize_report
```

**Inner graph** (`InterviewState`) — one per analyst, runs in parallel:
```
ask_question → search_web + search_wikipedia (parallel) → answer_question → (loop via route_messages) → save_interview → write_section
```

### Key files

| File | Purpose |
|------|---------|
| `research_assistant.py` | All graph nodes, edges, prompts, and graph compilation |
| `common.py` | Shared Pydantic models: `Analyst`, `InterviewState` |
| `constants.py` | Model name, turn limits, word counts, separators |
| `graphs/interview.py` | Interview sub-graph definition |
| `tools/search_web.py` | Tavily search tool (returns 3 results) |
| `tools/search_wikipedia.py` | Wikipedia loader (returns 2 docs) |
| `tools/search_instructions.py` | Shared `SearchQuery` schema and system prompt |
| `langgraph.json` | Graph registration, CORS config, Python version |

### Human-in-the-Loop

The graph interrupts before `human_feedback`. The frontend detects the `__interrupt__` event in the stream, displays the created analysts, and lets the user modify them. Resuming sends `command: { resume: humanFeedback }` via the LangGraph SDK. Typing `"yes"` (case-insensitive) proceeds; any other value triggers analyst regeneration.

## Local Development

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [LangGraph CLI](https://langchain-ai.github.io/langgraph/cloud/reference/cli/)

### API keys

Create `agent/.env`:

```bash
OPENAI_API_KEY=your_key
TAVILY_API_KEY=your_key
LANGSMITH_API_KEY=your_key
```

### Running

```bash
cd agent

# Option 1: Dev server with hot reload
langgraph up

# Option 2: Build image + docker compose
langgraph build -t research-assistant:latest
docker compose up
```

The API is available at `http://localhost:8123`. The graph name is `research_assistant`.

## CI / Cloud Run Deployment

The backend pipeline (`.github/workflows/backend-pipeline.yaml`) triggers on any push to `agent/**` and can also be run manually via `workflow_dispatch`. It runs two sequential jobs:

### `build` job

1. Computes the image URI using the short commit SHA (`${GITHUB_SHA::7}`) and writes it to `$GITHUB_ENV`.
2. Authenticates to Google Cloud via [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) (no long-lived service account key stored in GitHub).
3. Runs `langgraph build -t "$IMAGE_URI"` and pushes the image to Artifact Registry at `us-west1-docker.pkg.dev/<project>/cloud-run-source-deploy/research-assistant:<sha>`.

### `test-image` job

Runs after `build` succeeds (`needs: build`).

1. Re-authenticates to Google Cloud and pulls the image built by the `build` job.
2. Starts the container on port `8123` and waits up to 120 seconds for `/ok` to respond.
3. Outputs log on failure
4. Runs the research client against the live container (`RESEARCH_TOPIC` and `REPORT_FILE` are defined as workflow-level env vars).
5. Evaluates the report using the LLM-as-judge evaluator.
6. Stops and removes the container (`if: always()` ensures cleanup on failure).

### GitHub Actions secrets required

| Secret | Used by |
|---|---|
| `OPENAI_API_KEY` | LangGraph build + evaluation |
| `TAVILY_API_KEY` | LangGraph build |
| `LANGSMITH_API_KEY` | LangGraph build |
| `GCP_WORKLOAD_PROVIDER` | Workload Identity authentication |
| `GCP_SA_EMAIL` | Workload Identity authentication |
| `GCP_PROJECT_ID` | Artifact Registry image URI |
