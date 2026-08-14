import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, handleToolCall } from './tools';
import { buildSystemPrompt } from './prompts';
import { memory } from './memory';

const client = new Anthropic();

export async function runAgentLoop(sessionId: string, userMessage: string): Promise<string> {
  memory.append(sessionId, { role: 'user', content: userMessage });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: toolDefinitions,
      messages: memory.getHistory(sessionId),
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text');
      const reply = textBlock?.type === 'text' ? textBlock.text : '';
      memory.append(sessionId, { role: 'assistant', content: response.content });
      return reply;
    }

    if (response.stop_reason === 'tool_use') {
      memory.append(sessionId, { role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map((b) => ({
          type: 'tool_result' as const,
          tool_use_id: b.id,
          content: handleToolCall(b.name, b.input as Record<string, string>),
        }));

      memory.append(sessionId, { role: 'user', content: toolResults });
      continue;
    }

    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
  }
}
