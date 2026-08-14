interface ChatResponse {
  reply: string;
  sessionId: string;
  error?: string;
}

const form = document.getElementById('chat-form') as HTMLFormElement;
const input = document.getElementById('input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const messages = document.getElementById('messages') as HTMLDivElement;

function appendMessage(role: 'user' | 'assistant', text: string, typing = false): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `message ${role}${typing ? ' typing' : ''}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function setLoading(loading: boolean): void {
  sendBtn.disabled = loading;
  input.disabled = loading;
}

async function sendMessage(text: string): Promise<void> {
  appendMessage('user', text);
  setLoading(true);

  const indicator = appendMessage('assistant', '…', true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    const data = (await res.json()) as ChatResponse;
    indicator.remove();

    appendMessage('assistant', res.ok ? data.reply : (data.error ?? 'Something went wrong.'));
  } catch {
    indicator.remove();
    appendMessage('assistant', 'Connection error. Please try again.');
  } finally {
    setLoading(false);
    input.focus();
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  void sendMessage(text);
});

// Greet the user on load
window.addEventListener('DOMContentLoaded', async () => {
  setLoading(true);
  try {
    const res = await fetch('/api/chat/greeting');
    const data = (await res.json()) as { reply: string; error?: string };
    appendMessage('assistant', res.ok ? data.reply : (data.error ?? 'Something went wrong.'));
  } catch {
    appendMessage('assistant', "Hi! I'm Paige, your Bookly support assistant. How can I help you today?");
  } finally {
    setLoading(false);
    input.focus();
  }
});
