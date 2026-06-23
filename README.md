# Local Chat - a web UI for Ollama

A ChatGPT/Claude-style web app for chatting with models you run locally
through [Ollama](https://ollama.com) - Qwen 2.5 Coder today, anything else
you pull later. It has:

- Streaming responses (text appears token by token)
- A model picker that reads whatever models you currently have pulled in Ollama
- Saved chat history (conversations persist in a local file, with a sidebar to browse/delete them)
- Optional web search (via SearXNG) so the model can answer with current info, with sources shown under its replies
- A clean, dark, chat-app-style interface

It's two small pieces: a Node/Express backend that talks to Ollama, and a
React frontend that talks to the backend. The backend exists mainly so the
browser never has to deal with Ollama's CORS settings directly, and so chat
history can be saved to disk.

## 1. Prerequisites

- [Node.js](https://nodejs.org) 18 or newer
- [Ollama](https://ollama.com) installed and running, with at least one model pulled:
  ```bash
  ollama pull qwen2.5-coder:7b
  ```
- Ollama running (it usually runs automatically in the background after install;
  if not, run `ollama serve`)
- (Optional, for web search) A SearXNG instance with JSON output enabled

## 2. Set up the backend

```bash
cd server
npm install
```

If you want web search, copy the env example:

```bash
cp .env.example .env
```

Then open `.env` and set `SEARXNG_URL` if your SearXNG instance is not running at `http://localhost:8888`.
(If you skip this, the app still works fine - the search toggle in the UI
will just fail gracefully and the model answers from its own knowledge,
with a small note shown under its reply.)


### Optional: run SearXNG locally

The app expects a SearXNG instance at `http://localhost:8888` by default. The instance must allow JSON responses, usually by enabling `json` in `search.formats` in SearXNG settings.

For Docker-based SearXNG setups, start SearXNG separately, then set `SEARXNG_URL` in `server/.env` if you use a different host or port.

When it is running, the chat app's Search toggle will call SearXNG's `/search?format=json` endpoint and inject the returned sources into the model prompt.

Start the backend:

```bash
npm start
```

This starts the API on `http://localhost:3001` and proxies to Ollama at
`http://localhost:11434` by default. If your Ollama runs elsewhere, set
`OLLAMA_URL`:

```bash
OLLAMA_URL=http://localhost:11434 npm start
```

## 3. Run the frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). The dev server
proxies `/api/*` requests to the backend automatically.

## 4. Using it

- Pick a model from the dropdown in the top bar (it lists whatever
  `ollama list` would show you).
- Type a message and hit Enter (Shift+Enter for a newline).
- Click "+ New chat" to start a fresh conversation - past ones live in the
  sidebar and are saved to `server/data/conversations.json`.
- While a response is streaming, the send button becomes a stop button.
- Click the ** Search** toggle in the input bar to turn web search on for
  your next message (it stays on until you click it again). When it's on,
  your message is sent directly to SearXNG as a search query, the top results are fed to
  the model as context, and the source links appear as chips under its
  reply. If search fails for any reason (no key, rate limit, network), the
  model still answers normally - you'll just see a small note instead of
  source chips.

## Adding more models later

Nothing to change in the code - just `ollama pull <model-name>` and refresh
the page. It'll show up in the dropdown automatically.

## Project layout

```
server/            Express backend
  index.js         Proxies /api/models and /api/chat to Ollama,
                    stores conversations in data/conversations.json
  search.js         SearXNG web search + prompt-context builder
  .env.example      Copy to .env and set SEARXNG_URL if needed
client/             React frontend (Vite)
  src/App.jsx       Main app state and logic
  src/api.js        Fetch helpers, including the streaming parser
  src/components/   Sidebar, model picker, message bubbles, input bar
```

## Building for production

If you want a single static build to serve later instead of running the Vite
dev server:

```bash
cd client
npm run build
```

This outputs static files to `client/dist/`. You'd then serve those files
with any static file server, and run the backend (`server/`) alongside it -
the frontend talks to the backend on `http://localhost:3001/api/*`, so if you
serve the build from somewhere else, update the `BASE` constant in
`client/src/api.js` accordingly.

## Notes

- Conversations are stored in a plain JSON file (`server/data/conversations.json`).
  That's fine for personal local use; if you outgrow it, swap the read/write
  functions in `server/index.js` for SQLite without touching the frontend.
- The markdown rendering is intentionally minimal (code blocks, inline code,
  bold) with zero dependencies - good enough for code-focused chats. Swap in
  `react-markdown` later if you want full markdown/tables/etc.






