/**
 * Optional web-research layer — lets the advisor "take the internet into
 * account" for live market context (rumours, contract status, availability)
 * that the database cannot know.
 *
 * Design constraints:
 *  - PLUGGABLE & OFF BY DEFAULT. Without a configured search key this is a
 *    no-op, so the advisor still works fully on DB data alone.
 *  - UNTRUSTED INPUT. Web text is reference material, never instructions. It is
 *    truncated and, where used, the prompt explicitly frames it as such — the
 *    same posture the codebase already takes with user input (detectInjection).
 *  - Provider-agnostic via env. Tavily is wired as the default concrete backend
 *    because it returns clean, LLM-ready snippets in one call.
 */
const SEARCH_TIMEOUT_MS = 8_000
const MAX_SNIPPETS = 5
const MAX_SNIPPET_CHARS = 480

export type WebSnippet = { title: string; url: string; content: string }

export type WebResearch = {
  enabled: boolean
  query: string
  snippets: WebSnippet[]
  /** Human note when disabled or failed, for logs/UI. */
  note?: string
}

function sanitize(text: string): string {
  return text
    .replace(/[\x00-\x1f\x7f]/g, " ") // strip control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SNIPPET_CHARS)
}

/**
 * Run a market-news search. `query` should already be specific (player names,
 * team, "fichaje", "agente libre", season). Returns at most MAX_SNIPPETS short,
 * sanitised snippets. Never throws — failures degrade to `enabled:false`.
 */
export async function researchMarket(query: string): Promise<WebResearch> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return {
      enabled: false,
      query,
      snippets: [],
      note: "Web research disabled (no TAVILY_API_KEY configured).",
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: MAX_SNIPPETS,
        search_depth: "basic",
        include_answer: false,
        topic: "news",
      }),
    })
    if (!res.ok) {
      return { enabled: true, query, snippets: [], note: `Search ${res.status}` }
    }
    const json = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>
    }
    const snippets: WebSnippet[] = (json.results ?? [])
      .filter((r) => r.url && r.content)
      .slice(0, MAX_SNIPPETS)
      .map((r) => ({
        title: sanitize(r.title ?? ""),
        url: r.url as string,
        content: sanitize(r.content as string),
      }))
    return { enabled: true, query, snippets }
  } catch (err) {
    return {
      enabled: true,
      query,
      snippets: [],
      note: err instanceof Error ? err.message : "search failed",
    }
  } finally {
    clearTimeout(timer)
  }
}

/** True when a web-search backend is configured. */
export function webResearchEnabled(): boolean {
  return Boolean(process.env.TAVILY_API_KEY)
}
