# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Bookly Support Agent** — a Decagon SE take-home. A conversational AI customer support agent for a fictional online bookstore, built with TypeScript + Anthropic Claude, demonstrating direct API orchestration (no agentic platform wrappers).

## Commands

```bash
# Install dependencies
npm install

# Run the dev server (backend + frontend hot-reload)
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Run tests
npm test

# Run a single test file
npx jest src/agent/tools.test.ts
```

## Architecture

This is a **single-repo full-stack app**: Express backend serving a React (or vanilla TS) chat frontend.

```
src/
  agent/
    index.ts        # AgentLoop — drives the Anthropic Messages API loop
    tools.ts        # Tool definitions (schema) + handlers (mock implementations)
    prompts.ts      # System prompt construction
    memory.ts       # In-memory session store (Map<sessionId, Message[]>)
  server/
    index.ts        # Express app, /api/chat endpoint
    session.ts      # Session middleware
  frontend/
    index.html      # Chat UI entry point
    chat.ts         # Client-side fetch + DOM updates
  types.ts          # Shared types (Message, ToolCall, SessionState)
```

### Agent Loop (`src/agent/index.ts`)

Implements a **synchronous tool-use loop** directly against the Anthropic Messages API:

1. Append user message to session history
2. Call `anthropic.messages.create()` with tools and full history
3. If `stop_reason === "tool_use"`: execute each tool, append `tool_result` blocks, loop back to step 2
4. If `stop_reason === "end_turn"`: return the text response to the caller

No LangChain, no framework — just the raw SDK agentic loop.

### Tools (`src/agent/tools.ts`)

All tools are **mocked** with deterministic fake data. The schema is what matters for demonstrating tool-use architecture:

| Tool | Purpose | Mock behavior |
|------|---------|---------------|
| `get_order_status` | Look up order by ID | Returns fake order data keyed by order number |
| `initiate_return` | Start a return for an order item | Returns a mock RMA confirmation number |
| `search_policy` | Retrieve policy text by topic | Returns static policy strings (shipping, passwords, etc.) |

Tools are defined as Anthropic tool schema objects and passed directly in the messages call.

### Clarifying Question Pattern

The system prompt instructs the agent to ask for an order number before calling `get_order_status` or `initiate_return` if none is present in the conversation. This produces the required multi-turn + clarifying question behavior without hardcoded routing logic.

### Memory

Per-session `Message[]` arrays stored in a server-side `Map`. Session ID is a cookie UUID. No persistence — restarts clear state. This is intentional for the prototype scope.

## Key Design Decisions

1. **Anthropic tool-use loop over intent classification** — Rather than classifying intent and routing to handlers, the agent sees tools and decides when to call them. This is more robust to ambiguous phrasing and more honest about how modern agentic systems work.

2. **Mocked tools with real schema** — Tool schemas are real Anthropic `tool` definitions. The mock handlers simulate latency and realistic response shapes, so swapping in a real backend is a one-line change per tool.

3. **System prompt as the guardrail surface** — Hallucination prevention and out-of-scope refusals are handled in the system prompt (`src/agent/prompts.ts`), not in code. This keeps decision logic inspectable and editable without touching agent orchestration.

## Conventions

- All Anthropic API calls go through `src/agent/index.ts` — nothing else imports the SDK directly.
- Tool handlers in `src/agent/tools.ts` are pure functions: `(input: ToolInput) => ToolResult`. No side effects except the mock state store.
- Session history is the only mutable state; everything else is stateless.
