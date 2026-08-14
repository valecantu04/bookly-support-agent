# Bookly Support Agent

A conversational AI customer support agent for a fictional online bookstore, built as a Decagon SE take-home.

Demonstrates direct Anthropic API orchestration — no agentic platform wrappers. The agent drives a synchronous tool-use loop against the Claude Messages API, handling multi-turn conversations, clarifying questions, and tool calls from scratch.

## What it does

- Answers order status and return inquiries via natural language
- Asks clarifying questions when needed (e.g. missing order number) before calling tools
- Looks up shipping, return, and password policy on demand
- Recommends books on request
- Maintains per-session conversation history server-side
- **Help button** — a `?` popover in the header lists all supported use-cases at a glance

## Tech stack

- **Backend:** Node.js + Express + TypeScript
- **AI:** Anthropic Claude via `@anthropic-ai/sdk` (raw Messages API loop, no framework)
- **Frontend:** Vanilla TypeScript chat UI served by Express

## Architecture

```
src/
  agent/
    index.ts      # AgentLoop — synchronous tool-use loop
    tools.ts      # Tool definitions (Anthropic schema) + mock handlers
    prompts.ts    # System prompt construction
    memory.ts     # In-memory session store
  server/
    index.ts      # Express app, /api/chat endpoint
    session.ts    # Session middleware
  frontend/
    index.html    # Chat UI
    chat.ts       # Client-side fetch + DOM updates
  types.ts        # Shared types
```

The agent loop: append user message → call `messages.create()` → if `tool_use`, execute tool and loop → if `end_turn`, return response.

## Getting started

```bash
# Install dependencies
npm install

# Set your Anthropic API key
cp .env.example .env
# then add: ANTHROPIC_API_KEY=sk-...

# Run dev server (backend + frontend hot-reload)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting.

## Available tools

| Tool | Purpose |
|------|---------|
| `get_order_status` | Look up an order by ID |
| `initiate_return` | Start a return, get an RMA number |
| `search_policy` | Retrieve policy text (shipping, returns, passwords) |

All tools use deterministic mock data — swap handlers in `src/agent/tools.ts` to connect a real backend.

## Design decisions

**Tool-use loop over intent classification** — the agent decides when to call tools based on conversation context, not hardcoded routing. More robust to ambiguous phrasing.

**System prompt as the guardrail surface** — out-of-scope refusals and hallucination prevention live in `src/agent/prompts.ts`, not in code. Inspectable and editable without touching orchestration.

**Mocked tools with real schema** — tool schemas are real Anthropic `tool` definitions. Swapping in a real backend is a one-line change per handler.
