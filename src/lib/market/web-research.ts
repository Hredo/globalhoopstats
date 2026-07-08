/**
 * Optional web-research layer — lets the advisor "take the internet into
 * account" for live context (player news, coach profiles, public opinion,
 * team form, transfer rumours) that the database cannot know.
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
const MAX_SNIPPETS = 6
const MAX_SNIPPET_CHARS = 600

export type WebSnippet = { title: string; url: string; content: string }

export type WebResearch = {
  enabled: boolean
  query: string
  snippets: WebSnippet[]
  /** Human note when disabled or failed, for logs/UI. */
  note?: string
}

/**
 * Detected subject type for building a focused search query.
 */
export type SearchSubject =
  | "player"    // specific player
  | "coach"     // specific coach
  | "team"      // specific team
  | "opinion"   // public opinion / controversy / criticism
  | "general"   // any basketball topic

function detectSubject(query: string): SearchSubject {
  const s = query.toLowerCase()
  if (
    /\bentrenador\b|\bcoach\b|\btrainer\b|\bt[ée]cnico\b|\bmanager\b|\bdt\b|director t[ée]cnico/.test(s)
  ) return "coach"
  if (
    /\bopini[oó]n\b|\bcritic\b|\bcontroversia\b|\bpol[ée]mica\b|\breacci[oó]n\b|\bespeculaci[oó]n\b|\bscandal\b|\bproblemas\b|\bruido\b|\bpress\b|\bprensa\b|\bmedios\b|\bfans\b|\baficionad/.test(s)
  ) return "opinion"
  if (
    /\bequipo\b|\bteam\b|\bclub\b|\bfranquicia\b|\broster\b|\bplantilla\b/.test(s)
  ) return "team"
  if (
    /\bjugador\b|\bplayer\b|\bfichaje\b|\bsigning\b|\btalent\b|\bbasketball\b|\bbaloncesto player\b|\bjoven\b|promesa\b/.test(s)
  ) return "player"
  return "general"
}

function sanitize(text: string): string {
  return text
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SNIPPET_CHARS)
}

/**
 * Build a search query tailored to the subject, team/player context and the
 * user's original question. Uses Spanish keywords because most basketball news
 * for European leagues is in Spanish, but keeps the user's actual terms.
 */
export function buildSearchQuery(
  userMessage: string,
  context: {
    teamName?: string | null
    leagueName?: string | null
    playerName?: string | null
    playerSlug?: string | null
  },
): string {
  const subject = detectSubject(userMessage)
  const q = userMessage.toLowerCase()

  const league = context.leagueName ?? ""
  const team = context.teamName ?? ""
  const player = context.playerName ?? ""

  // Extract meaningful words from the user message (remove stopwords).
  const stopwords = new Set([
    "el","la","los","las","un","una","unos","unas","de","del","en","por","para",
    "con","sin","sobre","entre","y","e","o","u","a","ante","bajo","cabe","tras",
    "que","es","se","no","lo","como","más","pero","sus","le","ya","este","esta",
    "al","del","the","a","an","is","it","of","in","on","to","and","or","for",
    "with","about","what","who","how","when","where","why","tell","me","can",
    "you","do","does","did","are","was","were","has","have","had","not",
  ])
  const keywords = q
    .replace(/[^a-záéíóúüñ0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w))

  const season = new Date().getFullYear()

  switch (subject) {
    case "coach": {
      const nameWords = keywords.filter(
        (w) => !["entrenador","coach","tecnico","técnico","director","manager","dt","baloncesto"].includes(w),
      )
      if (nameWords.length > 0) {
        return `${nameWords.slice(0, 4).join(" ")} entrenador baloncesto ${league} trayectoria noticias ${season}`
      }
      return `${team ? team + " " : ""}entrenador baloncesto ${league} noticias ${season}`
    }

    case "opinion": {
      const nameWords = keywords.filter(
        (w) => !["opinion","opinión","critica","crítica","controversia","polemica","polémica","reaccion","reacción","especulacion","especulación","scandal","problemas","ruido","prensa","medios","fans","aficionados","público","publico"].includes(w),
      )
      if (player && nameWords.length > 0) {
        return `${player} ${nameWords.slice(0, 3).join(" ")} ${league} polémica noticias ${season}`
      }
      if (nameWords.length > 0) {
        return `${nameWords.slice(0, 4).join(" ")} baloncesto ${league} críticas noticias ${season}`
      }
      return `${player || team} baloncesto ${league} noticias polémica ${season}`
    }

    case "team": {
      const teamWords = keywords.filter(
        (w) => !["equipo","team","club","franquicia","plantilla","roster","baloncesto"].includes(w),
      )
      if (team && teamWords.length > 1) {
        return `${team} ${teamWords.slice(0, 3).join(" ")} ${league} ${season}`
      }
      return `${team || "baloncesto"} ${league} resultados noticias plantilla ${season}`
    }

    case "player": {
      if (player) {
        return `${player} baloncesto ${league} fichaje contrato estadisticas noticias ${season}`
      }
      const nameWords = keywords.filter(
        (w) => !["jugador","player","baloncesto","fichaje","signing","basketball","talent","joven","promesa"].includes(w),
      )
      if (nameWords.length > 0) {
        return `${nameWords.slice(0, 4).join(" ")} baloncesto ${league} ${season}`
      }
      return `baloncesto ${league} fichajes mercado noticias ${season}`
    }

    default: {
      // general — search the user's actual question
      return `${q.slice(0, 120)} ${season}`
    }
  }
}

/**
 * Run a web search. `query` should already be specific. Returns at most
 * MAX_SNIPPETS short, sanitised snippets with source URLs. Never throws —
 * failures degrade to `snippets: []` with a note.
 */
export async function researchMarket(query: string): Promise<WebResearch> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return {
      enabled: false,
      query,
      snippets: [],
      note: "Web research disabled (no TAVILY_API_KEY configured). Cuándo preguntes de un jugador o entrenador de cualquier liga, puedes buscar sus noticias, opinión pública, polémicas o estadísticas recientes.",
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
        search_depth: "advanced",
        include_answer: false,
        topic: "general",
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
