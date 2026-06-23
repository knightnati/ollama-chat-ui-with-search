import React from "react";

// Splits text on fenced code blocks (```lang\ncode```) and renders the rest
// through a tiny inline parser (bold, inline code). Intentionally minimal —
// no external markdown dependency required.
export default function MarkdownLite({ text }) {
  const blocks = splitCodeBlocks(text);
  return (
    <>
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <CodeBlock key={i} lang={block.lang} code={block.code} />
        ) : (
          <p key={i} className="md-paragraph">
            {renderInline(block.text)}
          </p>
        )
      )}
    </>
  );
}

function splitCodeBlocks(text) {
  const parts = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1], code: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }
  return parts.flatMap((p) =>
    p.type === "text"
      ? p.text.split(/\n{2,}/).map((t) => ({ type: "text", text: t }))
      : [p]
  );
}

function renderInline(text) {
  // bold (**text**) and inline code (`code`), simple non-overlapping pass
  const tokens = text.split(/(\*\*.+?\*\*|`.+?`)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return <strong key={i}>{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith("`") && tok.endsWith("`")) {
      return (
        <code key={i} className="inline-code">
          {tok.slice(1, -1)}
        </code>
      );
    }
    return tok.split("\n").map((line, j, arr) => (
      <React.Fragment key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{lang || "text"}</span>
        <button onClick={handleCopy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre>
        <code>{code.replace(/\n$/, "")}</code>
      </pre>
    </div>
  );
}
