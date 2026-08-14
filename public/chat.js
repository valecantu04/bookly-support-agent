"use strict";
(() => {
  // src/frontend/chat.ts
  var form = document.getElementById("chat-form");
  var input = document.getElementById("input");
  var sendBtn = document.getElementById("send-btn");
  var messages = document.getElementById("messages");
  function appendMessage(role, text, typing = false) {
    const div = document.createElement("div");
    div.className = `message ${role}${typing ? " typing" : ""}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }
  function setLoading(loading) {
    sendBtn.disabled = loading;
    input.disabled = loading;
  }
  async function sendMessage(text) {
    appendMessage("user", text);
    setLoading(true);
    const indicator = appendMessage("assistant", "\u2026", true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      indicator.remove();
      appendMessage("assistant", res.ok ? data.reply : data.error ?? "Something went wrong.");
    } catch {
      indicator.remove();
      appendMessage("assistant", "Connection error. Please try again.");
    } finally {
      setLoading(false);
      input.focus();
    }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    void sendMessage(text);
  });
  window.addEventListener("DOMContentLoaded", async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/greeting");
      const data = await res.json();
      appendMessage("assistant", res.ok ? data.reply : data.error ?? "Something went wrong.");
    } catch {
      appendMessage("assistant", "Hi! I'm Paige, your Bookly support assistant. How can I help you today?");
    } finally {
      setLoading(false);
      input.focus();
    }
  });
})();
