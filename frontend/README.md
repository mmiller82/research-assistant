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
