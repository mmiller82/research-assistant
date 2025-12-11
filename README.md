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
langgraph up or langraph build -t {myimage} and docker compose up

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

## Documentation 📚
- [LangGraph Platform Docs](https://langchain-ai.github.io/langgraph/cloud/deployment/cloud/)
