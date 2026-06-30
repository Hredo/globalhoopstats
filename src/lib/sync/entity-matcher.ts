import { safeOllamaBaseUrl } from "@/lib/security/ai-advisor"
import { tierForName, tiersConflict, type LeagueTier } from "@/lib/leagues-tier"

/**
 * Cross-league player identity resolution for the sync orchestrator.
 *
 * Decision ladder (cheapest first — Ollama is only consulted when a name is
 * genuinely ambiguous, never for the thousands of trivial cases):
 *   1. exact normalized-name hit            → reuse, no LLM call
 *   2. no candidate shares a name token     → NEW, no LLM call
 *   3. ambiguous (e.g. "Edy Tavares" vs "Walter Tavares") → ask Ollama
 *   4. Ollama down/unreachable              → conservative heuristic fallback
 *
 * HARD GUARD (applied at every rung, before anything else): a FEB player and a
 * top-tier player are NEVER the same person (see src/lib/leagues-tier.ts). Spain
 * is full of amateur namesakes of professionals, so any candidate whose tier
 * conflicts with the incoming player's league is dropped from consideration —
 * even on an exact name match. This is what stops "Daniel García" (EBA) from
 * being fused into "Daniel García" (ACB) once Ollama is gone and the matcher
 * relies on name-only fallbacks.
 *
 * The matcher is shared by all leagues in one run so a player inserted by the
 * ACB job is visible to the EuroLeague job without re-reading the DB.
 */

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1"
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b"
const OLLAMA_TIMEOUT_MS = 20_000
const MAX_CANDIDATES = 8
const MAX_CONSECUTIVE_FAILURES = 2

export type MatchCandidate = {
  id: string
  fullName: string
  nationality: string | null
  position: string | null
  heightCm: number | null
  /** League tiers this candidate already has stat rows in. */
  tiers?: LeagueTier[]
}

export type MatchInput = {
  fullName: string
  league: string
  nationality?: string
  position?: string
  heightCm?: number
}

export type MatchDecision =
  | { kind: "existing"; playerId: string }
  | { kind: "new" }

export type MatcherStats = {
  exactMatches: number
  noCandidates: number
  llmExisting: number
  llmNew: number
  heuristicFallbacks: number
  llmErrors: number
}

const SYSTEM_PROMPT = [
  "You are an entity-resolution judge for a basketball statistics database.",
  "Decide whether the incoming player is the same person as one of the known candidates.",
  "Players move between leagues (NBA, EuroLeague, ACB, FEB) and the same person",
  "may appear with accents stripped, names reordered, abbreviated or as a nickname",
  '(e.g. "Edy Tavares" and "Walter Tavares" are the same player).',
  "Use nationality, position and height as tie-breakers when names alone are unclear.",
  'Reply with strict JSON only: {"playerId":"<candidate id>"} when it is the same',
  'person, or {"playerId":"NEW"} when none of the candidates match.',
  "Never invent ids that are not in the candidate list.",
].join(" ")

export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function nameTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 1)
}

export class EntityMatcher {
  private readonly byExactName = new Map<string, MatchCandidate[]>()
  private readonly byToken = new Map<string, MatchCandidate[]>()
  private readonly decisions = new Map<string, MatchDecision>()
  private readonly inFlight = new Map<string, Promise<MatchDecision>>()
  private readonly baseUrl: string | null
  private readonly model: string
  private consecutiveFailures = 0
  private disabled = false

  readonly stats: MatcherStats = {
    exactMatches: 0,
    noCandidates: 0,
    llmExisting: 0,
    llmNew: 0,
    heuristicFallbacks: 0,
    llmErrors: 0,
  }

  constructor(existing: MatchCandidate[]) {
    this.baseUrl = safeOllamaBaseUrl(
      process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
    )
    this.model = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL
    for (const candidate of existing) this.index(candidate)
  }

  get llmAvailable(): boolean {
    return this.baseUrl !== null && !this.disabled
  }

  /**
   * Make a freshly inserted player visible to subsequent resolutions. `tier` is
   * the tier of the league that just created it, so a same-name player in a
   * conflicting tier later in the run is correctly kept separate.
   */
  register(candidate: MatchCandidate, tier?: LeagueTier): void {
    const c: MatchCandidate = { ...candidate, tiers: tier ? [tier] : candidate.tiers }
    this.index(c)
    if (tier) {
      this.decisions.set(this.cacheKey(tier, normalizeName(candidate.fullName)), {
        kind: "existing",
        playerId: candidate.id,
      })
    }
  }

  private cacheKey(tier: LeagueTier, name: string): string {
    return `${tier}::${name}`
  }

  /** A candidate is eligible only if its tiers don't conflict with the incoming league. */
  private compatible(candidate: MatchCandidate, incoming: LeagueTier): boolean {
    const tiers = candidate.tiers ?? []
    if (tiers.length === 0) return true // unknown tier: don't block reuse
    return !tiersConflict(tiers, [incoming])
  }

  async resolve(input: MatchInput): Promise<MatchDecision> {
    const key = normalizeName(input.fullName)
    if (!key) return { kind: "new" }
    const tier = tierForName(input.league)
    const ck = this.cacheKey(tier, key)

    const cached = this.decisions.get(ck)
    if (cached) {
      if (cached.kind === "existing") this.stats.exactMatches++
      return cached
    }

    const pending = this.inFlight.get(ck)
    if (pending) return pending

    const promise = this.decide(key, tier, input).finally(() => {
      this.inFlight.delete(ck)
    })
    this.inFlight.set(ck, promise)
    const decision = await promise
    this.decisions.set(ck, decision)
    return decision
  }

  private index(candidate: MatchCandidate): void {
    const key = normalizeName(candidate.fullName)
    if (!key) return
    const exact = this.byExactName.get(key)
    if (exact) exact.push(candidate)
    else this.byExactName.set(key, [candidate])
    for (const token of nameTokens(key)) {
      const bucket = this.byToken.get(token)
      if (bucket) bucket.push(candidate)
      else this.byToken.set(token, [candidate])
    }
  }

  private async decide(
    key: string,
    tier: LeagueTier,
    input: MatchInput,
  ): Promise<MatchDecision> {
    // Exact normalized-name hit, but only a tier-COMPATIBLE one. A blocked
    // exact match (e.g. EBA "Daniel García" vs the existing ACB one) falls
    // through to NEW rather than fusing two different people.
    const exact = (this.byExactName.get(key) ?? []).filter((c) => this.compatible(c, tier))
    if (exact.length > 0) {
      this.stats.exactMatches++
      return { kind: "existing", playerId: exact[0]!.id }
    }

    const candidates = this.candidatesFor(key, tier)
    if (candidates.length === 0) {
      this.stats.noCandidates++
      return { kind: "new" }
    }

    if (!this.llmAvailable) return this.heuristic(key, candidates)

    try {
      const decision = await this.askOllama(input, candidates)
      this.consecutiveFailures = 0
      if (decision.kind === "existing") this.stats.llmExisting++
      else this.stats.llmNew++
      return decision
    } catch (err) {
      this.stats.llmErrors++
      this.consecutiveFailures++
      const message = err instanceof Error ? err.message : String(err)
      console.warn(
        `[entity-matcher] ollama call failed for "${input.fullName}" — ${message}`,
      )
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.disabled = true
        console.warn(
          "[entity-matcher] ollama disabled for the rest of this run; " +
            "falling back to deterministic matching",
        )
      }
      return this.heuristic(key, candidates)
    }
  }

  /** Token-overlap candidates, already filtered to tier-compatible records. */
  private candidatesFor(key: string, tier: LeagueTier): MatchCandidate[] {
    const tokens = nameTokens(key)
    const scores = new Map<MatchCandidate, number>()
    for (const token of tokens) {
      for (const candidate of this.byToken.get(token) ?? []) {
        if (!this.compatible(candidate, tier)) continue
        scores.set(candidate, (scores.get(candidate) ?? 0) + 1)
      }
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CANDIDATES)
      .map(([candidate]) => candidate)
  }

  /**
   * No-LLM fallback: only merge when exactly one candidate shares both the
   * last name and the first initial — anything weaker creates a new player
   * (duplicates are recoverable via db:dedupe-players; wrong merges are not).
   * `candidates` is already tier-filtered upstream.
   */
  private heuristic(key: string, candidates: MatchCandidate[]): MatchDecision {
    this.stats.heuristicFallbacks++
    const tokens = key.split(" ").filter(Boolean)
    const last = tokens[tokens.length - 1]
    const initial = tokens[0]?.[0]
    if (!last || !initial) return { kind: "new" }

    const strong = candidates.filter((c) => {
      const cTokens = normalizeName(c.fullName).split(" ").filter(Boolean)
      return cTokens[cTokens.length - 1] === last && cTokens[0]?.[0] === initial
    })
    if (strong.length === 1) {
      return { kind: "existing", playerId: strong[0]!.id }
    }
    return { kind: "new" }
  }

  private async askOllama(
    input: MatchInput,
    candidates: MatchCandidate[],
  ): Promise<MatchDecision> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              incoming: {
                fullName: input.fullName,
                league: input.league,
                nationality: input.nationality ?? null,
                position: input.position ?? null,
                heightCm: input.heightCm ?? null,
              },
              candidates: candidates.map((c) => ({
                id: c.id,
                fullName: c.fullName,
                nationality: c.nationality,
                position: c.position,
                heightCm: c.heightCm,
              })),
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    })

    if (!res.ok) {
      throw new Error(`ollama returned ${res.status}`)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error("ollama returned an empty response")

    const cleaned = content.replace(/```(?:json)?/g, "").trim()
    const parsed = JSON.parse(cleaned) as { playerId?: unknown }
    const verdict =
      typeof parsed.playerId === "string" ? parsed.playerId.trim() : ""

    if (verdict.toUpperCase() === "NEW") return { kind: "new" }

    const matched = candidates.find((c) => c.id === verdict)
    if (matched) return { kind: "existing", playerId: matched.id }

    console.warn(
      `[entity-matcher] ollama answered with an unknown id for ` +
        `"${input.fullName}" — treating as NEW`,
    )
    return { kind: "new" }
  }
}
