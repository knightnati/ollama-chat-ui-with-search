import React, { useRef } from "react";

export default function InputBar({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  streaming,
  webSearch,
  onToggleWebSearch,
}) {
  const textareaRef = useRef(null);
  const canSend = value.trim().length > 0;

  function handleInput(e) {
    onChange(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && canSend) onSend();
    }
  }

  return (
    <div className="input-bar">
      <div className="input-bar-inner">
        <button
          type="button"
          className={`web-search-toggle ${webSearch ? "active" : ""}`}
          onClick={onToggleWebSearch}
          title={webSearch ? "Web search is on" : "Turn on web search"}
        >
          Search
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            webSearch ? "Ask anything - search is on" : "Message your local model"
          }
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        {streaming ? (
          <button className="send-btn stop-btn" onClick={onStop} title="Stop generating">
            Stop
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={onSend}
            disabled={disabled || !canSend}
            title="Send"
          >
            Send
          </button>
        )}
      </div>
      <div className="input-hint">
        Enter to send / Shift+Enter for a new line{webSearch && " / search on"}
      </div>
    </div>
  );
}

