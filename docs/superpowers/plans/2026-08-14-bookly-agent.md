# Bookly Support Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working conversational AI customer support agent for Bookly with three mocked tools, multi-turn session memory, and a vanilla TS chat UI.

**Architecture:** Express backend drives a manual Anthropic Messages API agentic loop. Tools are registered in a ToolRegistry (name → schema + handler). Session history lives in a server-side Map keyed by cookie UUID.

**Tech Stack:** TypeScript, Node.js, Express, `@anthropic-ai/sdk`, `uuid`, `cookie-parser`, `concurrently`, `ts-node`, `jest`

**Spec:** `docs/superpowers/specs/2026-08-14-bookly-agent-design.md`

## Global Constraints

- Model: `claude-sonnet-5` (exact string — do not substitute)
- No agentic platform wrappers (no LangChain, no Vercel AI SDK, no Tool Runner)
- Vanilla TypeScript frontend — no React, no Vue, no framework
- No streaming (SSE) — request/response only
- All Anthropic SDK calls go through `src/agent/index.ts` only
- Tool handlers are pure functions — no side effects except mock state
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Branch per feature, PR to `main`

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Create | Shared types: `Message`, `ToolCall`, `ToolResult` |
| `src/agent/prompts.ts` | Create | System prompt string |
| `src/agent/memory.ts` | Create | `Map<sessionId, Message[]>` store with `getHistory` / `appendMessages` |
| `src/agent/tools.ts` | Create | ToolRegistry: `{ schema, handler }` for all three tools |
| `src/agent/index.ts` | Create | `AgentLoop` class with `chat()` method and manual tool-use loop |
| `src/server/session.ts` | Create | Cookie middleware: read/set `bookly_session` UUID, attach to `req` |
| `src/server/index.ts` | Create | Express app: `/api/chat` endpoint + static frontend |
| `src/frontend/index.html` | Create | Chat UI markup |
| `src/frontend/styles.css` | Create | Minimal dark-theme chat styles |
| `src/frontend/chat.ts` | Create | Client fetch, DOM rendering, thinking indicator |
| `package.json` | Create | Dependencies, scripts (`dev`, `build`, `typecheck`, `test`) |
| `tsconfig.json` | Create | TypeScript config for backend |
| `tsconfig.frontend.json` | Create | TypeScript config for frontend (DOM lib) |

---

## Task 1: Project Scaffold

**Branch:** `feat/scaffold`

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.frontend.json`
- Create: `.env.example`
- Create: `.gitignore`

**Interfaces:**
- Produces: `npm install`, `npm run dev`, `npm run build`, `npm run typecheck`, `npm test` all work

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bookly-support-agent",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npx ts-node src/server/index.ts\" \"npx tsc -p tsconfig.frontend.json --watch\"",
    "build": "tsc && tsc -p tsconfig.frontend.json",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.frontend.json --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.55.0",
    "cookie-parser": "^1.4.7",
    "express": "^4.19.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/uuid": "^9.0.8",
    "concurrently": "^8.2.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.5",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (backend — Node, no DOM)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/frontend/**", "node_modules", "dist"]
}
```

- [ ] **Step 3: Create `tsconfig.frontend.json`** (browser — needs DOM)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM"],
    "outDir": "src/frontend/dist",
    "rootDir": "src/frontend",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/frontend/**/*.ts"]
}
```

- [ ] **Step 4: Create `.env.example`**

```
ANTHROPIC_API_KEY=your_api_key_here
PORT=3001
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
src/frontend/dist/
.env
*.js.map
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Verify typecheck passes on empty project**

```bash
npm run typecheck
```

Expected: exits 0 (no source files yet — that's fine).

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json tsconfig.frontend.json .env.example .gitignore
git commit -m "chore: scaffold project with tsconfig and deps"
```

---

## Task 2: Shared Types

**Branch:** `feat/types`

**Files:**
- Create: `src/types.ts`
- Create: `src/agent/jest.config.js`

**Interfaces:**
- Produces:
  - `Message`: `{ role: 'user' | 'assistant', content: string | ContentBlock[] }`
  - `ToolResult`: `{ type: 'tool_result', tool_use_id: string, content: string }`

- [ ] **Step 1: Create `jest.config.js`** at project root

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
```

- [ ] **Step 2: Create `src/types.ts`**

```typescript
import type { MessageParam, ToolUseBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages';

// Re-export SDK types we use throughout the app
export type { MessageParam, ToolUseBlock, TextBlock };

// Tool result block sent back to Claude after tool execution
export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

// A single content block in an assistant message
export type ContentBlock = TextBlock | ToolUseBlock;
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts jest.config.js
git commit -m "feat: add shared types and jest config"
```

---

## Task 3: System Prompt

**Branch:** `feat/prompts`

**Files:**
- Create: `src/agent/prompts.ts`

**Interfaces:**
- Produces: `export function buildSystemPrompt(): string`

- [ ] **Step 1: Create `src/agent/prompts.ts`**

```typescript
export function buildSystemPrompt(): string {
  return `You are a customer support agent for Bookly, an online bookstore.

You help customers with three things only:
1. Order status — look up the status of their order
2. Return/refund requests — initiate a return for an order item
3. Policy questions — answer questions about shipping, returns, payment, and account policies

Rules:
- Before calling get_order_status or initiate_return, you MUST have the customer's order ID. If they haven't provided it, ask for it first.
- Never fabricate order data. Always use the get_order_status tool to look up real order information.
- If a customer asks about anything outside these three areas, politely decline and redirect them to what you can help with.
- Be concise, friendly, and professional.
- When you have the information needed to help, act immediately — don't ask unnecessary clarifying questions.`;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/agent/prompts.ts
git commit -m "feat: add system prompt"
```

---

## Task 4: Session Memory

**Branch:** `feat/memory`

**Files:**
- Create: `src/agent/memory.ts`
- Create: `src/agent/memory.test.ts`

**Interfaces:**
- Consumes: `MessageParam` from `@anthropic-ai/sdk/resources/messages`
- Produces:
  - `export function getHistory(sessionId: string): MessageParam[]`
  - `export function appendMessages(sessionId: string, ...messages: MessageParam[]): void`
  - `export function clearHistory(sessionId: string): void`

- [ ] **Step 1: Write failing tests**

Create `src/agent/memory.test.ts`:

```typescript
import { getHistory, appendMessages, clearHistory } from './memory';

describe('memory', () => {
  const sessionId = 'test-session-123';

  afterEach(() => {
    clearHistory(sessionId);
  });

  it('returns empty array for unknown session', () => {
    expect(getHistory('unknown-session')).toEqual([]);
  });

  it('appends messages and retrieves them in order', () => {
    appendMessages(sessionId,
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    );
    const history = getHistory(sessionId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(history[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('accumulates messages across multiple appends', () => {
    appendMessages(sessionId, { role: 'user', content: 'First' });
    appendMessages(sessionId, { role: 'assistant', content: 'Second' });
    expect(getHistory(sessionId)).toHaveLength(2);
  });

  it('clearHistory empties the session', () => {
    appendMessages(sessionId, { role: 'user', content: 'Hello' });
    clearHistory(sessionId);
    expect(getHistory(sessionId)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/agent/memory.test.ts
```

Expected: FAIL — `Cannot find module './memory'`

- [ ] **Step 3: Implement `src/agent/memory.ts`**

```typescript
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

const sessions = new Map<string, MessageParam[]>();

export function getHistory(sessionId: string): MessageParam[] {
  return sessions.get(sessionId) ?? [];
}

export function appendMessages(sessionId: string, ...messages: MessageParam[]): void {
  const history = sessions.get(sessionId) ?? [];
  sessions.set(sessionId, [...history, ...messages]);
}

export function clearHistory(sessionId: string): void {
  sessions.delete(sessionId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/agent/memory.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/agent/memory.ts src/agent/memory.test.ts
git commit -m "feat: add session memory store"
```

---

## Task 5: ToolRegistry

**Branch:** `feat/tools`

**Files:**
- Create: `src/agent/tools.ts`
- Create: `src/agent/tools.test.ts`

**Interfaces:**
- Consumes: `ToolResult` from `../types`
- Produces:
  - `export const ToolRegistry: Record<string, ToolEntry>`
  - `export type ToolEntry = { schema: Tool, handler: (input: unknown) => ToolResult }`
  - `export function getToolSchemas(): Tool[]` — returns all schemas for the Anthropic API call
  - `export function executeTool(name: string, input: unknown): ToolResult`

- [ ] **Step 1: Write failing tests**

Create `src/agent/tools.test.ts`:

```typescript
import { executeTool, getToolSchemas } from './tools';

describe('ToolRegistry', () => {
  describe('getToolSchemas', () => {
    it('returns three tool schemas', () => {
      const schemas = getToolSchemas();
      expect(schemas).toHaveLength(3);
    });

    it('includes required schema fields', () => {
      const schemas = getToolSchemas();
      schemas.forEach(schema => {
        expect(schema).toHaveProperty('name');
        expect(schema).toHaveProperty('description');
        expect(schema).toHaveProperty('input_schema');
      });
    });
  });

  describe('get_order_status', () => {
    it('returns order data for known order ID', () => {
      const result = executeTool('get_order_status', { order_id: 'ORD-001' });
      expect(result.content).toContain('ORD-001');
      expect(result.content).toContain('status');
    });

    it('returns not found message for unknown order ID', () => {
      const result = executeTool('get_order_status', { order_id: 'ORD-999' });
      expect(result.content).toContain('not found');
    });
  });

  describe('initiate_return', () => {
    it('returns an RMA number', () => {
      const result = executeTool('initiate_return', {
        order_id: 'ORD-001',
        reason: 'Wrong item received'
      });
      expect(result.content).toContain('RMA-');
    });
  });

  describe('search_policy', () => {
    it('returns policy text for known topic', () => {
      const result = executeTool('search_policy', { topic: 'shipping' });
      expect(result.content).toBeTruthy();
      expect(result.content).not.toContain('not found');
    });

    it('returns not found for unknown topic', () => {
      const result = executeTool('search_policy', { topic: 'cryptocurrency' });
      expect(result.content).toContain('not found');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/agent/tools.test.ts
```

Expected: FAIL — `Cannot find module './tools'`

- [ ] **Step 3: Implement `src/agent/tools.ts`**

```typescript
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { ToolResult } from '../types';

type ToolEntry = {
  schema: Tool;
  handler: (input: unknown) => ToolResult;
};

// Mock order data — swap handler for real backend call
const MOCK_ORDERS: Record<string, object> = {
  'ORD-001': {
    orderId: 'ORD-001',
    status: 'Shipped',
    items: [{ title: 'The Pragmatic Programmer', qty: 1 }],
    estimatedDelivery: '2026-08-17',
  },
  'ORD-002': {
    orderId: 'ORD-002',
    status: 'Processing',
    items: [
      { title: 'Clean Code', qty: 1 },
      { title: 'Designing Data-Intensive Applications', qty: 1 },
    ],
    estimatedDelivery: '2026-08-20',
  },
  'ORD-003': {
    orderId: 'ORD-003',
    status: 'Delivered',
    items: [{ title: 'The Staff Engineer\'s Path', qty: 2 }],
    estimatedDelivery: '2026-08-10',
  },
};

const POLICIES: Record<string, string> = {
  shipping: 'Standard shipping takes 5-7 business days. Expedited shipping (2-3 days) is available for $9.99. Orders over $35 qualify for free standard shipping.',
  returns: 'Items can be returned within 30 days of delivery. Books must be in original condition. Digital purchases are non-refundable. Initiate a return to receive a prepaid shipping label.',
  payment: 'We accept Visa, Mastercard, American Express, PayPal, and Bookly gift cards. All transactions are encrypted. We do not store full card numbers.',
  account: 'To reset your password, use the "Forgot Password" link on the login page. Account changes take effect immediately. Contact support if you\'re locked out.',
};

const ToolRegistry: Record<string, ToolEntry> = {
  get_order_status: {
    schema: {
      name: 'get_order_status',
      description: 'Look up the current status of a customer order by order ID.',
      input_schema: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order ID to look up (e.g. ORD-001)',
          },
        },
        required: ['order_id'],
      },
    },
    handler: (input: unknown): ToolResult => {
      const { order_id } = input as { order_id: string };
      const order = MOCK_ORDERS[order_id];
      const content = order
        ? JSON.stringify(order)
        : `Order ${order_id} not found. Please check the order ID and try again.`;
      return { type: 'tool_result', tool_use_id: '', content };
    },
  },

  initiate_return: {
    schema: {
      name: 'initiate_return',
      description: 'Initiate a return for a customer order.',
      input_schema: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order ID to return',
          },
          reason: {
            type: 'string',
            description: 'The reason for the return',
          },
        },
        required: ['order_id', 'reason'],
      },
    },
    handler: (input: unknown): ToolResult => {
      const { order_id, reason } = input as { order_id: string; reason: string };
      const rmaNumber = `RMA-${Date.now().toString().slice(-8)}`;
      const content = JSON.stringify({
        rmaNumber,
        message: `Return initiated for order ${order_id}. Reason: ${reason}. Your RMA number is ${rmaNumber}. A prepaid shipping label will be emailed to you within 24 hours.`,
      });
      return { type: 'tool_result', tool_use_id: '', content };
    },
  },

  search_policy: {
    schema: {
      name: 'search_policy',
      description: 'Look up Bookly policy information by topic.',
      input_schema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The policy topic to look up: shipping, returns, payment, or account',
          },
        },
        required: ['topic'],
      },
    },
    handler: (input: unknown): ToolResult => {
      const { topic } = input as { topic: string };
      const policy = POLICIES[topic.toLowerCase()];
      const content = policy ?? `No policy found for topic "${topic}". Available topics: shipping, returns, payment, account.`;
      return { type: 'tool_result', tool_use_id: '', content };
    },
  },
};

export function getToolSchemas(): Tool[] {
  return Object.values(ToolRegistry).map(entry => entry.schema);
}

export function executeTool(name: string, input: unknown): ToolResult {
  const entry = ToolRegistry[name];
  if (!entry) {
    return {
      type: 'tool_result',
      tool_use_id: '',
      content: `Unknown tool: ${name}`,
    };
  }
  return entry.handler(input);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/agent/tools.test.ts
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/agent/tools.ts src/agent/tools.test.ts
git commit -m "feat: add ToolRegistry with three mocked tools"
```

---

## Task 6: AgentLoop

**Branch:** `feat/agent-loop`

**Files:**
- Create: `src/agent/index.ts`
- Create: `src/agent/index.test.ts`

**Interfaces:**
- Consumes:
  - `buildSystemPrompt()` from `./prompts`
  - `getHistory(sessionId)`, `appendMessages(sessionId, ...messages)` from `./memory`
  - `getToolSchemas()`, `executeTool(name, input)` from `./tools`
  - `ToolResult` from `../types`
- Produces: `export class AgentLoop { chat(sessionId: string, userMessage: string): Promise<string> }`

- [ ] **Step 1: Write failing test**

Create `src/agent/index.test.ts`:

```typescript
import { AgentLoop } from './index';

// Mock the Anthropic SDK so no real API calls are made
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
        }),
      },
    })),
  };
});

describe('AgentLoop', () => {
  it('returns a string response for a user message', async () => {
    const loop = new AgentLoop();
    const response = await loop.chat('session-1', 'Hello');
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });

  it('returns a response on end_turn', async () => {
    const loop = new AgentLoop();
    const response = await loop.chat('session-2', 'What are your hours?');
    expect(response).toBe('Hello! How can I help you today?');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/agent/index.test.ts
```

Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Implement `src/agent/index.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { buildSystemPrompt } from './prompts';
import { getHistory, appendMessages } from './memory';
import { getToolSchemas, executeTool } from './tools';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class AgentLoop {
  async chat(sessionId: string, userMessage: string): Promise<string> {
    appendMessages(sessionId, { role: 'user', content: userMessage });

    while (true) {
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: getHistory(sessionId),
        tools: getToolSchemas(),
      });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        const text = textBlock?.type === 'text' ? textBlock.text : '';
        appendMessages(sessionId, { role: 'assistant', content: response.content });
        return text;
      }

      if (response.stop_reason === 'tool_use') {
        // Append assistant message with tool_use blocks
        appendMessages(sessionId, {
          role: 'assistant',
          content: response.content,
        } as MessageParam);

        // Execute each tool and collect results
        const toolResults = response.content
          .filter((b): b is ToolUseBlock => b.type === 'tool_use')
          .map(toolUse => {
            const result = executeTool(toolUse.name, toolUse.input);
            return { ...result, tool_use_id: toolUse.id };
          });

        // Append tool results as a user message
        appendMessages(sessionId, {
          role: 'user',
          content: toolResults,
        } as MessageParam);

        // Loop continues — next iteration sends updated history
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/agent/index.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: PASS (all tests from Tasks 4, 5, 6)

- [ ] **Step 6: Commit**

```bash
git add src/agent/index.ts src/agent/index.test.ts
git commit -m "feat: add AgentLoop with manual tool-use loop"
```

---

## Task 7: Express Server

**Branch:** `feat/server`

**Files:**
- Create: `src/server/session.ts`
- Create: `src/server/index.ts`

**Interfaces:**
- Consumes:
  - `AgentLoop` from `../agent/index`
  - `v4 as uuidv4` from `uuid`
  - `cookieParser` from `cookie-parser`
- Produces: Express app listening on `PORT` (default `3001`), responding to `POST /api/chat`

- [ ] **Step 1: Create `src/server/session.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const COOKIE_NAME = 'bookly_session';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Extend Express Request to include sessionId
declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  let sessionId = req.cookies?.[COOKIE_NAME];

  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
    });
  }

  req.sessionId = sessionId;
  next();
}
```

- [ ] **Step 2: Create `src/server/index.ts`**

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { AgentLoop } from '../agent/index';
import { sessionMiddleware } from './session';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const agentLoop = new AgentLoop();

app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../src/frontend')));
app.use('/frontend-dist', express.static(path.join(__dirname, '../../src/frontend/dist')));

app.post('/api/chat', async (req, res) => {
  const { message } = req.body as { message: string };

  if (!message || typeof message !== 'string' || message.trim() === '') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const response = await agentLoop.chat(req.sessionId, message.trim());
  res.json({ response });
});

app.listen(PORT, () => {
  console.log(`Bookly agent running on http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Smoke test the server manually**

Create a `.env` file with your API key:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

Start the server:
```bash
npx ts-node -r dotenv/config src/server/index.ts
```

In another terminal:
```bash
curl -s -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}' | python3 -m json.tool
```

Expected: `{ "response": "..." }` — a greeting from the agent.

Install dotenv if needed: `npm install dotenv @types/dotenv`

- [ ] **Step 5: Commit**

```bash
git add src/server/session.ts src/server/index.ts
git commit -m "feat: add Express server with session middleware and chat endpoint"
```

---

## Task 8: Frontend

**Branch:** `feat/frontend`

**Files:**
- Create: `src/frontend/index.html`
- Create: `src/frontend/styles.css`
- Create: `src/frontend/chat.ts`

**Interfaces:**
- Consumes: `POST /api/chat` with `{ message: string }`, expects `{ response: string }`
- Produces: Working chat UI in the browser at `http://localhost:3001`

- [ ] **Step 1: Create `src/frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bookly Support</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <span class="logo">📚 Bookly Support</span>
      <span class="status">Online</span>
    </div>
    <div class="chat-messages" id="messages"></div>
    <div class="thinking" id="thinking" style="display:none">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>
    <form class="chat-input-row" id="chat-form">
      <input
        type="text"
        id="input"
        placeholder="Ask about your order, returns, or policies..."
        autocomplete="off"
        autofocus
      />
      <button type="submit" id="send-btn">Send</button>
    </form>
  </div>
  <script type="module" src="dist/chat.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/frontend/styles.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f0f11;
  color: #e8e8ea;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-container {
  width: 100%;
  max-width: 680px;
  height: 90vh;
  background: #18181b;
  border-radius: 16px;
  border: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid #27272a;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo { font-size: 16px; font-weight: 600; }

.status {
  font-size: 12px;
  color: #22c55e;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status::before {
  content: '';
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  display: inline-block;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.message.user {
  background: #3b82f6;
  color: #fff;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

.message.assistant {
  background: #27272a;
  color: #e8e8ea;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.thinking {
  padding: 8px 20px;
  display: flex;
  gap: 4px;
  align-items: center;
}

.dot {
  width: 7px;
  height: 7px;
  background: #52525b;
  border-radius: 50%;
  animation: pulse 1.2s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

.chat-input-row {
  padding: 16px 20px;
  border-top: 1px solid #27272a;
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 10px 14px;
  color: #e8e8ea;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

input:focus { border-color: #3b82f6; }

button {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

button:hover { background: #2563eb; }
button:disabled { background: #3f3f46; cursor: not-allowed; }
```

- [ ] **Step 3: Create `src/frontend/chat.ts`**

```typescript
const messagesEl = document.getElementById('messages') as HTMLDivElement;
const thinkingEl = document.getElementById('thinking') as HTMLDivElement;
const form = document.getElementById('chat-form') as HTMLFormElement;
const input = document.getElementById('input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

function addMessage(role: 'user' | 'assistant', text: string): void {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setThinking(visible: boolean): void {
  thinkingEl.style.display = visible ? 'flex' : 'none';
  sendBtn.disabled = visible;
  input.disabled = visible;
}

async function sendMessage(text: string): Promise<void> {
  addMessage('user', text);
  setThinking(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json() as { response?: string; error?: string };

    if (!res.ok || data.error) {
      addMessage('assistant', 'Sorry, something went wrong. Please try again.');
      return;
    }

    addMessage('assistant', data.response ?? '');
  } catch {
    addMessage('assistant', 'Connection error. Please check the server and try again.');
  } finally {
    setThinking(false);
    input.focus();
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendMessage(text);
});

// Greet on load
window.addEventListener('load', () => {
  addMessage('assistant', 'Hi! I\'m the Bookly support agent. I can help you with order status, returns, and policy questions. How can I help?');
});
```

- [ ] **Step 4: Build the frontend**

```bash
npx tsc -p tsconfig.frontend.json
```

Expected: `src/frontend/dist/chat.js` created, no errors.

- [ ] **Step 5: Smoke test end-to-end in browser**

Start the server:
```bash
npx ts-node -r dotenv/config src/server/index.ts
```

Open `http://localhost:3001` in a browser. Verify:
- Greeting message appears on load
- Typing a message and clicking Send shows "thinking..." dots
- Response appears as an assistant bubble
- Ask "What's the status of order ORD-001?" — agent should ask for order number (if not provided) or return the order status

- [ ] **Step 6: Commit**

```bash
git add src/frontend/index.html src/frontend/styles.css src/frontend/chat.ts
git commit -m "feat: add vanilla TS chat frontend with thinking indicator"
```

---

## Task 9: Dev Scripts + README

**Branch:** `feat/dev-scripts`

**Files:**
- Modify: `package.json` (add `dotenv` to dev startup)
- Create: `README.md`

**Interfaces:**
- Produces: `npm run dev` starts server + watches frontend in one command

- [ ] **Step 1: Install dotenv**

```bash
npm install dotenv
npm install --save-dev @types/dotenv
```

- [ ] **Step 2: Update `package.json` dev script**

Update the `"dev"` script:
```json
"dev": "concurrently \"npx ts-node -r dotenv/config src/server/index.ts\" \"npx tsc -p tsconfig.frontend.json --watch\""
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Bookly Support Agent

A conversational AI customer support agent for Bookly, a fictional online bookstore.

Built with TypeScript + Express + Anthropic Claude (`claude-sonnet-5`). Demonstrates direct Anthropic Messages API orchestration — no agentic platform wrappers.

## Setup

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Create `.env`:**
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   PORT=3001
   ```
   Get an API key at [console.anthropic.com](https://console.anthropic.com).

3. **Run:**
   ```bash
   npm run dev
   ```

4. **Open:** [http://localhost:3001](http://localhost:3001)

## How it works

The agent uses a manual synchronous tool-use loop against the Anthropic Messages API:

1. User message → append to session history
2. Call `claude-sonnet-5` with full history + tool schemas
3. If `stop_reason === "tool_use"`: execute tools, append results, loop
4. If `stop_reason === "end_turn"`: return text response to browser

## Tools

| Tool | What it does |
|------|-------------|
| `get_order_status` | Look up order by ID |
| `initiate_return` | Start a return, get RMA number |
| `search_policy` | Retrieve policy text by topic |

All tools are mocked. Swap the handler function to connect a real backend.

## Try it

- "What's the status of order ORD-001?"
- "I want to return order ORD-002"
- "What's your return policy?"
- "How long does shipping take?"
```

- [ ] **Step 4: Final test suite run**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Final typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json README.md
git commit -m "docs: add README with setup and architecture overview"
```

---

## Self-Review

**Spec coverage:**
- ✅ Multi-turn conversation with per-session memory → Task 4 (memory store)
- ✅ Agent asks clarifying questions → Task 3 (system prompt instructs asking for order ID)
- ✅ Three tools end-to-end → Task 5 (ToolRegistry) + Task 6 (AgentLoop)
- ✅ "thinking..." indicator → Task 8 (frontend)
- ✅ Code readable for live walkthrough → ToolRegistry pattern, manual loop, no magic

**Type consistency check:**
- `ToolResult.type` is `'tool_result'` throughout ✅
- `executeTool` signature: `(name: string, input: unknown): ToolResult` — consistent in Task 5 and consumed in Task 6 ✅
- `getHistory` / `appendMessages` signatures match Task 4 definition and Task 6 consumption ✅
- `AgentLoop.chat` signature: `(sessionId: string, userMessage: string): Promise<string>` — consistent in Task 6 and consumed in Task 7 ✅

**No placeholders:** All steps have actual code. ✅
