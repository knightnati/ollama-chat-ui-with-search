function base64ToUtf8(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

const BASE = "/api";

async function json(res) {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error || body.detail || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchModels() {
  const res = await fetch(`${BASE}/models`);
  const data = await json(res);
  return data.models;
}

export async function fetchConversations() {
  const res = await fetch(`${BASE}/conversations`);
  const data = await json(res);
  return data.conversations;
}

export async function fetchConversation(id) {
  const res = await fetch(`${BASE}/conversations/${id}`);
  const data = await json(res);
  return data.conversation;
}

export async function createConversation({ title, model, messages }) {
  const res = await fetch(`${BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, model, messages }),
  });
  const data = await json(res);
  return data.conversation;
}

export async function updateConversation(id, patch) {
  const res = await fetch(`${BASE}/conversations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await json(res);
  return data.conversation;
}

export async function deleteConversation(id) {
  const res = await fetch(`${BASE}/conversations/${id}`, { method: "DELETE" });
  await json(res);
}

/**
 * Streams a chat completion from the backend.
 * Calls onToken(chunkText) as tokens arrive, and resolves with
 * { text, sources, searchStatus, searchError } when the stream finishes.
 */
export async function streamChat({ model, messages, webSearch, signal, onToken }) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, webSearch }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error || body.detail || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Chat request failed (${res.status})`);
  }

  const searchStatus = res.headers.get("X-Search-Status") || "skipped";
  const searchErrorB64 = res.headers.get("X-Search-Error");
  const sourcesB64 = res.headers.get("X-Search-Sources");
  const searchError = searchErrorB64 ? base64ToUtf8(searchErrorB64) : null;
  const sources = sourcesB64 ? JSON.parse(base64ToUtf8(sourcesB64)) : [];

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd;
    while ((lineEnd = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line) continue;

      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue; // skip malformed line
      }

      if (obj.message?.content) {
        full += obj.message.content;
        onToken(obj.message.content);
      }
      if (obj.error) {
        throw new Error(obj.error);
      }
    }
  }

  return { text: full, sources, searchStatus, searchError };
}



