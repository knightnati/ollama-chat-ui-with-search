import React from "react";

function formatSize(bytes) {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export default function ModelSelector({ models, selected, onChange, loading, error }) {
  if (error) {
    return <div className="model-selector model-selector-error">Ollama unavailable</div>;
  }

  return (
    <select
      className="model-selector"
      value={selected || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading || models.length === 0}
    >
      {loading && <option>Loading models...</option>}
      {!loading && models.length === 0 && <option>No models found</option>}
      {models.map((m) => (
        <option key={m.name} value={m.name}>
          {m.name} {m.size ? `(${formatSize(m.size)})` : ""}
        </option>
      ))}
    </select>
  );
}
