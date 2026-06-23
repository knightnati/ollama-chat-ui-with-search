import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { searxngSearch, buildSearchContextMessage } from "./search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const DB_PATH = path.join(__dirname, "data", "conversations.json");
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const PORT = process.env.PORT || 3001;
const app = express();
app.use(
  cors({
    exposedHeaders: ["X-Search-Status", "X-Search-Error", "X-Search-Sources"],
  })
);
app.use(express.json({ limit: "10mb" }));

// ---------- tiny file-based "database" ----------

async function readDB() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return { conversations: [] };
    throw err;
  }
}

async function writeDB(db) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// ---------- model list (proxied from Ollama) ----------

app.get("/api/models", async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error(`Ollama responded ${r.status}`);
    const data = await r.json();
    const models = (data.models || []).map((m) => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
      family: m.details?.family,
      paramSize: m.details?.parameter_size,
    }));
    res.json({ models });
  } catch (err) {
    res.status(502).json({
      error:
        "Could not reach Ollama. Is it running? (Tried " + OLLAMA_URL + "/api/tags)",
      detail: String(err.message || err),
    });
  }
});



// ---------- streaming chat proxy ----------

app.post("/api/chat", async (req, res) => {
  const { model, messages, webSearch } = req.body;

  if (!model || !Array.isArray(messages)) {
    return res.status(400).json({ error: "model and messages are required" });
  }

  const controller = new AbortController();
  // Use res "close" (fires when the client disconnects/cancels), not req
  // "close" (which can fire as soon as the request body has been read).
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  // Optionally run a web search and inject the results as context. This
  // never blocks the chat entirely - if it fails (no API key, rate limit,
  // network issue) we just proceed without it and tell the frontend why.
  let upstreamMessages = messages;
  let searchStatus = "skipped";
  let searchError = null;
  let sources = [];

  if (webSearch) {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const query = lastUserMessage?.content?.trim();

    if (query) {
      try {
        const results = await searxngSearch(query);
        sources = results.map((r) => ({ title: r.title, url: r.url }));
        upstreamMessages = [buildSearchContextMessage(query, results), ...messages];
        searchStatus = "ok";
      } catch (err) {
        searchStatus = "error";
        searchError = String(err.message || err);
        console.error("Web search failed:", searchError);
      }
    }
  }

  res.setHeader("X-Search-Status", searchStatus);
  if (searchError) {
    res.setHeader("X-Search-Error", Buffer.from(searchError).toString("base64"));
  }
  if (sources.length > 0) {
    res.setHeader("X-Search-Sources", Buffer.from(JSON.stringify(sources)).toString("base64"));
  }

  try {
    const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: upstreamMessages, stream: true }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return res
        .status(502)
        .json({ error: "Ollama chat request failed", detail: text });
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    if (controller.signal.aborted) return; // client navigated away, nothing to do
    if (!res.headersSent) {
      res.status(502).json({
        error: "Failed to reach Ollama",
        detail: String(err.message || err),
      });
    } else {
      res.end();
    }
  }
});

// ---------- conversation CRUD ----------

app.get("/api/conversations", async (req, res) => {
  const db = await readDB();
  const summaries = db.conversations
    .map(({ id, title, model, updatedAt, createdAt }) => ({
      id,
      title,
      model,
      updatedAt,
      createdAt,
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ conversations: summaries });
});

app.get("/api/conversations/:id", async (req, res) => {
  const db = await readDB();
  const convo = db.conversations.find((c) => c.id === req.params.id);
  if (!convo) return res.status(404).json({ error: "Not found" });
  res.json({ conversation: convo });
});

app.post("/api/conversations", async (req, res) => {
  const { title, model, messages } = req.body;
  const db = await readDB();
  const now = new Date().toISOString();
  const convo = {
    id: randomUUID(),
    title: title || "New chat",
    model: model || null,
    messages: messages || [],
    createdAt: now,
    updatedAt: now,
  };
  db.conversations.push(convo);
  await writeDB(db);
  res.status(201).json({ conversation: convo });
});

app.put("/api/conversations/:id", async (req, res) => {
  const db = await readDB();
  const idx = db.conversations.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const { title, model, messages } = req.body;
  const convo = db.conversations[idx];
  if (title !== undefined) convo.title = title;
  if (model !== undefined) convo.model = model;
  if (messages !== undefined) convo.messages = messages;
  convo.updatedAt = new Date().toISOString();

  await writeDB(db);
  res.json({ conversation: convo });
});

app.delete("/api/conversations/:id", async (req, res) => {
  const db = await readDB();
  const before = db.conversations.length;
  db.conversations = db.conversations.filter((c) => c.id !== req.params.id);
  if (db.conversations.length === before) {
    return res.status(404).json({ error: "Not found" });
  }
  await writeDB(db);
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Ollama chat backend listening on http://localhost:${PORT}`);
  console.log(`Proxying to Ollama at ${OLLAMA_URL}`);
});








