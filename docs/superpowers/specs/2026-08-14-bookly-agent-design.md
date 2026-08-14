# Bookly Support Agent — Design Spec

**Date:** 2026-08-14
**Status:** Approved

---

## Overview

A conversational AI customer support agent for Bookly, a fictional online bookstore. Built as a Decagon SE take-home: TypeScript + Express backend, vanilla TS chat frontend, direct Anthropic Messages API orchestration (no agentic platform wrappers).

**Success criteria:**
- Multi-turn conversation with per-session memory
- Agent asks clarifying questions before acting (e.g., asks for order number if not provided)
- Three tools working end-to-end: order status, return initiation, policy lookup
- UI shows "thinking..." indicator during tool-use loops
- Code is readable enough to walk through live in a demo

---

## Architecture

Single-repo full-stack app. Express serves both the API and the static frontend.

```
Browser (chat UI)
    ↕ POST /api/chat
Express server
    → AgentLoop
        → Anthropic Messages API (claude-sonnet-5)
        ← tool_use blocks
        → ToolRegistry.execute(toolName, input)
        ← tool_result blocks
        → loop until end_turn
    ← text response
Browser renders response, clears "thinking..." indicator
```

### Session Management

- Session ID: UUID set as an HTTP cookie on first visit
- History: `Map<sessionId, Message[]>` on the server
- No persistence — restarts clear all sessions (intentional for prototype)

---

## Components

### `src/agent/index.ts` — AgentLoop

Class with one public method: `chat(sessionId: string, userMessage: string): Promise<string>`

Loop:
1. Append user message to session history
2. Call `anthropic.messages.create()` with model, system prompt, full history, and all tool schemas
3. If `stop_reason === "tool_use"`: execute each tool block via ToolRegistry, append assistant message + `tool_result` blocks to history, go to step 2
4. If `stop_reason === "end_turn"`: append assistant message to history, return text content

No retry logic, no timeouts, no streaming — intentional for prototype scope.

### `src/agent/tools.ts` — ToolRegistry

A plain object mapping tool names to `{ schema, handler }` pairs:

```typescript
type ToolEntry = {
  schema: Tool;                          // Anthropic tool definition
  handler: (input: unknown) => ToolResult;
}
const ToolRegistry: Record<string, ToolEntry> = { ... }
```

`AgentLoop` calls `ToolRegistry[name].handler(input)` — decoupled from individual tool implementations.

**Tools:**

| Tool | Input | Mock behavior |
|------|-------|---------------|
| `get_order_status` | `order_id: string` | Returns `{ orderId, status, items: [{title, qty}], estimatedDelivery }` keyed by order ID; unknown IDs return a "not found" message |
| `initiate_return` | `order_id: string`, `reason: string` | Returns `{ rmaNumber, message }` with a generated RMA string (e.g. `RMA-20260814-4821`) |
| `search_policy` | `topic: string` | Returns static policy text for topics: `shipping`, `returns`, `payment`, `account`; unknown topics return a "no policy found" message |

All tools are mocked with deterministic data. Swapping in a real backend is one function change per tool.

### `src/agent/prompts.ts` — System Prompt

Constructs the system prompt string. Key instructions:
- Agent is a Bookly customer support agent
- Scope: order status, returns, policy questions only — decline anything else politely
- Ask for order number before calling `get_order_status` or `initiate_return` if not present in the conversation
- Never fabricate order data — always use tools

### `src/agent/memory.ts` — Session Store

```typescript
const sessions = new Map<string, Message[]>();
export function getHistory(sessionId: string): Message[] { ... }
export function appendMessages(sessionId: string, ...messages: Message[]): void { ... }
```

### `src/server/session.ts` — Session Middleware

Express middleware that reads the `bookly_session` cookie, generates a UUID if absent, and sets it on the response. Attaches `sessionId` to `req` for downstream handlers.

### `src/server/index.ts` — Express App

- `POST /api/chat` — reads `{ message }` from body, resolves `sessionId` from `req` (set by session middleware), calls `AgentLoop.chat()`, returns `{ response }`
- Serves static frontend from `src/frontend/`
- Mounts session middleware on all routes

### `src/frontend/` — Chat UI

Vanilla TypeScript, no framework.

- `index.html`: chat container, input bar, send button
- `chat.ts`: sends `POST /api/chat`, renders user/assistant bubbles, shows "thinking..." indicator on send, hides it on response
- Minimal CSS: dark background, message bubbles — clean enough to look intentional, no external dependencies

### `src/types.ts` — Shared Types

`Message`, `ToolCall`, `ToolResult`, `SessionState` — consumed by both agent and server modules.

---

## Model

**`claude-sonnet-5`** — fast, capable, cost-effective. More than sufficient for a 3-tool customer support agent. Free Anthropic credits cover dozens of demo conversations at this context size.

---

## Key Design Decisions

1. **Manual agentic loop over SDK Tool Runner** — writing the `while stop_reason === "tool_use"` loop explicitly demonstrates understanding of how agentic systems work. This is the core of what the take-home evaluates.

2. **ToolRegistry over inline handlers** — decouples tool definitions from the loop. Adding a fourth tool is one new entry. Gives a clean architecture slide for the pitch deck.

3. **System prompt as the guardrail surface** — out-of-scope refusals and clarifying question behavior are controlled in `prompts.ts`, not in code. Keeps decision logic inspectable without touching orchestration.

4. **Mocked tools with real schema** — schemas are real Anthropic `tool` definitions. Mock handlers return realistic response shapes. Swapping in a real backend is a one-line change per tool.

5. **No streaming** — a "thinking..." UI indicator gives the live feel without SSE complexity. Appropriate under time pressure.

---

## File Structure

```
src/
  agent/
    index.ts        # AgentLoop class
    tools.ts        # ToolRegistry + all tool handlers
    prompts.ts      # System prompt construction
    memory.ts       # Session store (Map<sessionId, Message[]>)
  server/
    index.ts        # Express app + /api/chat endpoint
    session.ts      # Cookie-based session middleware
  frontend/
    index.html      # Chat UI
    chat.ts         # Client-side fetch + DOM updates
    styles.css      # Minimal chat UI styles
  types.ts          # Shared types
```

---

## Out of Scope

- Streaming responses (SSE)
- Persistent session storage
- Authentication
- Real order/return backend
- Error recovery / retries
- Rate limiting
