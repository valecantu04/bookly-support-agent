import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { runAgentLoop } from '../agent';
import { sessionMiddleware, getSessionId } from './session';
import type { ChatRequest, ChatResponse } from '../types';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/index.html'));
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body as ChatRequest;

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const sessionId = getSessionId(req);

  try {
    const reply = await runAgentLoop(sessionId, message.trim());
    const body: ChatResponse = { reply, sessionId };
    res.json(body);
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Bookly Support Agent → http://localhost:${PORT}`);
});
