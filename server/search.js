const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8888";

/**
 * Runs a web search directly against a SearXNG instance and returns a short
 * list of results. The SearXNG instance must have JSON output enabled.
 */
export async function searxngSearch(query, { maxResults = 5 } = {}) {
  const url = new URL("/search", SEARXNG_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "auto");
  url.searchParams.set("safesearch", "0");
  url.searchParams.set("categories", "general");

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new Error(
      `Could not reach SearXNG at ${SEARXNG_URL}. Start SearXNG there or update SEARXNG_URL in server/.env. ${err.message || err}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const hint = res.status === 404
      ? ` Check SEARXNG_URL (${SEARXNG_URL}); this does not look like a SearXNG search endpoint.`
      : "";
    throw new Error(
      `SearXNG search failed (${res.status}).${hint}${detail ? ` Response: ${detail.slice(0, 160)}` : ""}`
    );
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  return results
    .map((r) => ({
      title: titleFromResult(r),
      url: r.url,
      content: (r.content || r.snippet || "").replace(/\s+/g, " ").trim().slice(0, 600),
    }))
    .filter((r) => r.title && r.url)
    .slice(0, maxResults);
}

function titleFromResult(result) {
  if (result.title && result.title.trim()) return result.title.trim();
  try {
    return new URL(result.url).hostname.replace(/^www\./, "");
  } catch {
    return result.url;
  }
}

/**
 * Builds a system message that injects search results as context for the
 * model, with numbered citations the model is asked to reference.
 */
export function buildSearchContextMessage(query, results) {
  const today = new Date().toISOString().slice(0, 10);

  if (results.length === 0) {
    return {
      role: "system",
      content: `A web search for "${query}" returned no results. Today's date is ${today}. Answer from your own knowledge and mention that live search didn't return anything useful.`,
    };
  }

  const listing = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");

  return {
    role: "system",
    content: `Today's date is ${today}. You have these live web search results for the user's question ("${query}"):\n\n${listing}\n\nUse them to answer accurately and concisely. Cite sources inline like [1], [2] matching the numbers above. If they don't actually answer the question, say so rather than guessing.`,
  };
}


