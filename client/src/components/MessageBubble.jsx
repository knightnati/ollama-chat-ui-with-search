import React from "react";
import MarkdownLite from "./MarkdownLite.jsx";

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function MessageBubble({ role, content, streaming, sources, searchError }) {
  const isUser = role === "user";
  return (
    <div className={`message-row ${isUser ? "from-user" : "from-assistant"}`}>
      <div className="avatar" aria-hidden="true">
        {isUser ? "You" : "AI"}
      </div>
      <div className="message-content">
        <MarkdownLite text={content || ""} />
        {streaming && <span className="cursor" />}

        {!streaming && searchError && (
          <div className="search-error-note">Web search skipped: {searchError}</div>
        )}

        {!streaming && sources?.length > 0 && (
          <div className="sources-row">
            {sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-chip"
                title={s.title}
              >
                {i + 1}. {hostnameOf(s.url)}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
