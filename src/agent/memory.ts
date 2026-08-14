import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

const store = new Map<string, MessageParam[]>();

export const memory = {
  getHistory(sessionId: string): MessageParam[] {
    return store.get(sessionId) ?? [];
  },

  append(sessionId: string, message: MessageParam): void {
    const history = store.get(sessionId) ?? [];
    history.push(message);
    store.set(sessionId, history);
  },

  clear(sessionId: string): void {
    store.delete(sessionId);
  },
};
