import React from "react";

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  collapsed,
  onToggleCollapsed,
}) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <button className="icon-btn collapse-btn" onClick={onToggleCollapsed} title="Toggle sidebar">
          {collapsed ? "Open" : "Hide"}
        </button>
        {!collapsed && (
          <button className="new-chat-btn" onClick={onNewChat}>
            New chat
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="conversation-list">
          {conversations.length === 0 && <div className="empty-hint">No chats yet</div>}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`conversation-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(c.id)}
            >
              <span className="conversation-title">{c.title || "New chat"}</span>
              <button
                className="delete-btn"
                title="Delete chat"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
              >
                Del
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
