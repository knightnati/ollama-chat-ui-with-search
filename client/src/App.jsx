import React, { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ModelSelector from "./components/ModelSelector.jsx";
import MessageBubble from "./components/MessageBubble.jsx";
import InputBar from "./components/InputBar.jsx";
import {
  fetchModels,
  fetchConversations,
  fetchConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  streamChat,
} from "./api.js";

function deriveTitle(text) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? trimmed.slice(0, 48) + "..." : trimmed || "New chat";
}

export default function App() {
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    refreshModels();
    refreshConversations();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0].name);
    }
  }, [models, selectedModel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  async function refreshModels() {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const list = await fetchModels();
      setModels(list);
    } catch (err) {
      setModelsError(err.message);
    } finally {
      setModelsLoading(false);
    }
  }

  async function refreshConversations() {
    try {
      const list = await fetchConversations();
      setConversations(list);
    } catch {
      // Backend may not be up yet; the sidebar can stay empty.
    }
  }

  function handleNewChat() {
    setActiveId(null);
    setMessages([]);
    setInput("");
  }

  async function handleSelectConversation(id) {
    try {
      const convo = await fetchConversation(id);
      setActiveId(convo.id);
      setMessages(convo.messages || []);
      if (convo.model) setSelectedModel(convo.model);
    } catch (err) {
      setFatalError(err.message);
    }
  }

  async function handleDeleteConversation(id) {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) handleNewChat();
    } catch (err) {
      setFatalError(err.message);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !selectedModel) return;

    const userMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    let convoId = activeId;
    try {
      if (!convoId) {
        const convo = await createConversation({
          title: deriveTitle(text),
          model: selectedModel,
          messages: nextMessages,
        });
        convoId = convo.id;
        setActiveId(convoId);
      }
    } catch (err) {
      setFatalError("Could not save conversation: " + err.message);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantText = "";
    let sources = [];
    let searchError = null;

    try {
      const result = await streamChat({
        model: selectedModel,
        messages: nextMessages,
        webSearch,
        signal: controller.signal,
        onToken: (chunk) => {
          assistantText += chunk;
          setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
        },
      });
      sources = result.sources;
      searchError = result.searchStatus === "error" ? result.searchError : null;
    } catch (err) {
      if (err.name !== "AbortError") {
        assistantText = assistantText || `${err.message || "Something went wrong talking to Ollama."}`;
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;

      const finalAssistantMessage = {
        role: "assistant",
        content: assistantText,
        sources,
        searchError,
      };
      setMessages([...nextMessages, finalAssistantMessage]);

      const finalMessages = [...nextMessages, finalAssistantMessage];
      if (convoId) {
        try {
          await updateConversation(convoId, { messages: finalMessages });
          refreshConversations();
        } catch {
          // Chat still worked; only persistence failed.
        }
      }
    }
  }, [input, streaming, selectedModel, messages, activeId, webSearch]);

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConversation}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
      />

      <main className="main-panel">
        <header className="top-bar">
          <div className="top-bar-left">
            <div className="app-title">
              <span className="app-title-main">Local Chat</span>
              <span className="app-title-sub">Ollama + SearXNG</span>
            </div>
            <ModelSelector
              models={models}
              selected={selectedModel}
              onChange={setSelectedModel}
              loading={modelsLoading}
              error={modelsError}
            />
          </div>

          <div className="top-bar-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
              title="Toggle theme"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            {modelsError && (
              <button className="retry-btn" onClick={refreshModels}>
                Retry
              </button>
            )}
          </div>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-column">
            {messages.length === 0 && (
              <div className="welcome">
                <h1>What are we building today?</h1>
                <p>
                  Talking to <strong>{selectedModel || "..."}</strong> running locally via Ollama.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                sources={m.sources}
                searchError={m.searchError}
                streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
              />
            ))}
          </div>
        </div>

        <div className="chat-column input-wrap">
          <InputBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            disabled={!selectedModel || modelsLoading}
            streaming={streaming}
            webSearch={webSearch}
            onToggleWebSearch={() => setWebSearch((v) => !v)}
          />
        </div>
      </main>

      {fatalError && (
        <div className="toast" onClick={() => setFatalError(null)}>
          {fatalError}
        </div>
      )}
    </div>
  );
}
