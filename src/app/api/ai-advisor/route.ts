import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { conversations, messages } from "@/lib/db/schema"
import { getTeamBySlug } from "@/lib/data/teams"
import {
  buildLocalAdvice,
  findPlayerInQuery,
  type AdvisorOutput,
  type Recruit,
} from "@/lib/ai/local-advisor"
import { generateAdvisorResponse } from "@/lib/ai/llm"
import {
  detectIntent,
  detectOperation,
  looksLikeSmallTalk,
} from "@/lib/ai/intent"
import { findCandidates, type Candidate } from "@/lib/market/candidates"
import { getMarketPlayerBySlug } from "@/lib/market/pool"
import { buildTradeScenarios } from "@/lib/market/trade"
import { buildSearchQuery, researchMarket, webResearchEnabled } from "@/lib/market/web-research"
import { formatEur } from "@/lib/market/league-strength"
import { valuationTierLabel } from "@/lib/market/valuation"
import { estimateClubBudget, singleSigningCap } from "@/lib/market/club-budgets"
import { detectNationalityFilter } from "@/lib/market/nationality"
import { analyzeRoster, type RosterAnalysis } from "@/lib/market/roster"
import { resolveDefaultEngine, resolveEngine } from "@/lib/ai/user-provider"
import { getProvider, resolveModel } from "@/lib/ai/providers"
import { getCurrentUser } from "@/lib/auth/current-user"
import { getLocale } from "@/lib/i18n/server"
import type { Locale } from "@/lib/i18n/config"
import { promptCopy } from "@/lib/ai/prompt-copy"
import { replyLocale } from "@/lib/ai/language"
import {
  trimDegeneratedOutput,
  isUsableAnswer,
  isMostlyHeadings,
} from "@/lib/ai/degeneration"
// NOTE: Import kept for when usage limits are re-enabled.
// import { getAdvisorFreeUsage } from "@/lib/auth/free-usage"
// import { userPlan } from "@/lib/db/schema"
import {
  aiRateLimit,
  audit,
  clientIp,
  cleanLlmOutput,
  cleanUserText,
  detectInjection,
  jsonError,
  MAX_HISTORY_MESSAGE_LEN,
  MAX_HISTORY_MESSAGES,
  MAX_USER_MESSAGE_LEN,
  redactSecrets,
  securityHeaders,
} from "@/lib/security/ai-advisor"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export type AdvisorRequest = {
  teamSlug: string
  leagueSlug: string
  userMessage: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
  conversationId?: string
  conversationTitle?: string
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  // 0. Auth — optional for anonymous users with default engine.
  const user = await getCurrentUser(request.headers.get("cookie"))
  // Active language (cookie-backed; kept in sync with the account on login).
  const locale = await getLocale()
  // NOTE: plan check disabled until re-enabled later.
  // const plan = userPlan(user)

  // 1. Anti-runaway ceiling per IP. Not a usage quota — the site is freemium
  //    and the model call is billed to the reader's own provider key. See
  //    `aiRateLimit`.
  const limit = aiRateLimit(ip)
  if (!limit.ok) {
    audit("rate-limit", { ip, retryAfterSec: limit.retryAfterSec })
    return new NextResponse(
      JSON.stringify({
        content: `Too many requests. Try again in ${limit.retryAfterSec}s.`,
        error: true,
      }),
      {
        status: 429,
        headers: securityHeaders({
          "Retry-After": String(limit.retryAfterSec),
        }),
      },
    )
  }

  // 2. Content-Type guard.
  const ct = request.headers.get("content-type") ?? ""
  if (!ct.toLowerCase().includes("application/json")) {
    audit("bad-content-type", { ip, ct })
    return jsonError("Unsupported content type.", 415)
  }

  // 3. Body size cap (defence in depth on top of Next's own limits).
  const rawLen = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(rawLen) && rawLen > 0 && rawLen > 64 * 1024) {
    audit("oversized-body", { ip, bytes: rawLen })
    return jsonError("Request too large.", 413)
  }

  // 4. Origin / referer check (same-origin only).
  const expectedHost = request.headers.get("host")
  const sameOrigin =
    origin && expectedHost
      ? (() => {
          try {
            return new URL(origin).host === expectedHost
          } catch {
            return false
          }
        })()
      : true
  const refererOk = !referer
    ? true
    : (() => {
        try {
          return new URL(referer).host === expectedHost
        } catch {
          return false
        }
      })()
  if (!sameOrigin || !refererOk) {
    audit("cross-origin-blocked", {
      ip,
      origin,
      referer,
      expectedHost,
      sameOrigin,
      refererOk,
    })
    return jsonError("Origin not allowed.", 403)
  }

  // 5. Parse body.
  let body: AdvisorRequest
  try {
    body = (await request.json()) as AdvisorRequest
  } catch {
    audit("invalid-json", { ip })
    return jsonError("Invalid JSON.", 400)
  }

  // 5b. Resolve / create conversation for this user.
  const db = getDb()
  let conversationId: string | null =
    typeof body.conversationId === "string" && body.conversationId.length <= 60
      ? body.conversationId
      : null
  let conversationTitle: string | null = null
  if (conversationId) {
    if (!user) {
      return jsonError("Authentication required to resume conversations.", 401)
    }
    const rows = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        title: conversations.title,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, user.id),
        ),
      )
      .limit(1)
    if (rows.length === 0) {
      return jsonError("Conversation not found.", 404)
    }
  } else {
    // NOTE: Free quota check disabled until re-enabled later.
    // if (plan === "free") {
    //   const usage = await getAdvisorFreeUsage(user.id, user.plan, user.role)
    //   if (usage.remaining <= 0) {
    //     return NextResponse.json(
    //       {
    //         error: "free_quota_exceeded",
    //         message:
    //           "You used your free advisor preview. Upgrade to Pro for unlimited conversations.",
    //       },
    //       { status: 403, headers: securityHeaders() },
    //     )
    //   }
    // }
    conversationId = crypto.randomUUID()
    const rawTitle =
      typeof body.conversationTitle === "string"
        ? body.conversationTitle.trim().slice(0, 160)
        : ""
    conversationTitle =
      rawTitle.length > 0
        ? rawTitle
        : `${body.teamSlug} - ${cleanUserText(body.userMessage).slice(0, 60)}`
  }

  // 6. Required fields.
  if (
    !body ||
    typeof body.teamSlug !== "string" ||
    typeof body.leagueSlug !== "string" ||
    typeof body.userMessage !== "string"
  ) {
    audit("missing-fields", { ip })
    return jsonError("Missing team or question data.", 400)
  }
  if (!body.teamSlug.trim() || !body.leagueSlug.trim()) {
    return jsonError("Invalid team or league.", 400)
  }

  // 7. Sanitise and bound user input.
  const userMessage = cleanUserText(body.userMessage).slice(
    0,
    MAX_USER_MESSAGE_LEN,
  )
  if (userMessage.length === 0) {
    return jsonError("The question cannot be empty.", 400)
  }
  // Answer in the language the coach typed in, falling back to the language
  // they set the site to. `locale` stays the UI language for chrome.
  const answerLocale = replyLocale(userMessage, locale)

  // 8. Prompt-injection detection.
  const findings = detectInjection(userMessage)
  if (findings.length > 0) {
    audit("prompt-injection-blocked", {
      ip,
      findings: findings.slice(0, 5),
      sample: userMessage.slice(0, 120),
    })
    return jsonError(
      "Your message contains patterns that are not allowed. Rephrase it as a normal scouting question.",
      400,
    )
  }

  // 9. History sanitisation / cap.
  const rawHistory = Array.isArray(body.history) ? body.history : []
  if (rawHistory.length > MAX_HISTORY_MESSAGES * 4) {
    audit("oversized-history", { ip, len: rawHistory.length })
  }
  const history = rawHistory
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: cleanUserText(m.content).slice(0, MAX_HISTORY_MESSAGE_LEN),
    }))

  // 10. Team lookup (also acts as authn-ish gate: only valid teams get LLM).
  let team
  try {
    team = await getTeamBySlug(body.leagueSlug, body.teamSlug)
  } catch (err) {
    audit("team-lookup-error", { ip, err: String(err) })
    return jsonError("Failed to load team.", 500)
  }
  if (!team) {
    return NextResponse.json(
      { content: `Team not found in ${body.leagueSlug}.` },
      { headers: securityHeaders() },
    )
  }

  // 10b. Persist the new conversation (only for logged-in users).
  if (conversationTitle && user) {
    try {
      await db.insert(conversations).values({
        id: conversationId!,
        userId: user.id,
        teamSlug: body.teamSlug,
        teamName: team.name,
        leagueSlug: body.leagueSlug,
        title: conversationTitle,
      })
    } catch (err) {
      audit("conversation-insert-failed", { ip, err: String(err) })
      return jsonError("Failed to start conversation.", 500)
    }
  }

  // 10c. Insert user message into conversation (only for logged-in users).
  if (user) {
    try {
      await db.insert(messages).values({
        id: crypto.randomUUID(),
        conversationId: conversationId!,
        role: "user",
        content: userMessage,
      })
    } catch (err) {
      audit("message-insert-failed", { ip, err: String(err) })
    }
  }

  // A greeting needs none of what follows. Every block below this line is a
  // database read or an outbound HTTP call made to ground a market answer, and
  // running all of them to reply "hola" is both the reason the answer arrived
  // wearing three signings nobody asked for and a pile of queries against a
  // quota we have already blown once.
  const smallTalk = looksLikeSmallTalk(userMessage)

  // 11. Optional: find player profile for richer context.
  let playerProfile = null
  if (!smallTalk) {
    try {
      playerProfile = await findPlayerInQuery(userMessage)
    } catch (err) {
      audit("player-lookup-error", { ip, err: String(err) })
    }
  }

  // 11b. Market intelligence (DB-grounded). Real candidates for the detected
  // need, a valuation for any named player, trade packages that balance their
  // value, and — only if a search backend is configured — live web context.
  const intent = detectIntent(userMessage)
  const operation = detectOperation(userMessage)
  const nationalityFilter = detectNationalityFilter(userMessage)
  // Public-data budget for the user's club → cap a single signing realistically.
  const teamBudget = estimateClubBudget(team.name, body.leagueSlug)
  const signingCap = singleSigningCap(teamBudget.eur)
  // Draft / youth questions look for prospects, not finished products.
  const draftMaxAge = operation === "draft" ? 22 : undefined
  let candidates: Candidate[] = []
  if (!smallTalk) {
    try {
      candidates = await findCandidates({
        leagueSlug: body.leagueSlug,
        intent,
        excludeTeamId: team.id,
        maxValueEur: signingCap,
        nationality: nationalityFilter,
        maxAge: draftMaxAge,
        limit: 6,
        locale: answerLocale,
      })
      // If the budget/cupo filters leave nothing, retry without the budget cap
      // so we still ground the advisor on real players rather than the
      // hardcoded list.
      if (candidates.length === 0) {
        candidates = await findCandidates({
          leagueSlug: body.leagueSlug,
          intent,
          excludeTeamId: team.id,
          nationality: nationalityFilter,
          maxAge: draftMaxAge,
          limit: 6,
          locale: answerLocale,
        })
      }
    } catch (err) {
      audit("candidates-error", { ip, err: String(err) })
    }
  }

  // Own-roster analysis. Always, not just for release/renewal questions: it is
  // what lets the advisor answer "and who do I move to pay for him?" — and it
  // is the second half of the closed list of players it may name. Reads the
  // cached league pool, so it costs nothing extra.
  let roster: RosterAnalysis | null = null
  if (!smallTalk) {
    try {
      roster = await analyzeRoster(body.leagueSlug, team.id)
    } catch (err) {
      audit("roster-analysis-error", { ip, err: String(err) })
    }
  }

  let namedValuation = null
  let trade = null
  if (playerProfile) {
    try {
      const mp = await getMarketPlayerBySlug(playerProfile.slug)
      namedValuation = mp?.valuation ?? null
    } catch (err) {
      audit("valuation-error", { ip, err: String(err) })
    }
    if (operation === "trade") {
      try {
        trade = await buildTradeScenarios({
          myPlayerSlug: playerProfile.slug,
          maxScenarios: 5,
        })
      } catch (err) {
        audit("trade-error", { ip, err: String(err) })
      }
    }
  }

  // Web context — always fetched when Tavily is available, regardless of provider.
  // The system prompt tells the AI to cite source URLs inline for attribution.
  let web = null
  if (webResearchEnabled() && !smallTalk) {
    try {
      const searchQuery = buildSearchQuery(userMessage, {
        teamName: team.name,
        leagueName: team.league.name,
        playerName: playerProfile?.fullName ?? null,
        playerSlug: playerProfile?.slug ?? null,
      })
      web = await researchMarket(searchQuery)
    } catch (err) {
      audit("web-research-error", { ip, err: String(err) })
    }
  }

  // 12. LLM call. Use the engine the user configured for the advisor (a cloud
  // provider with their own key, or a local Ollama), falling back to the
  // default engine from env vars for anonymous users. Back-compat: an explicit
  // `X-User-LLM: ollama` header forces Ollama even before the user has picked a
  // provider in their account. If no engine is available we fall back to the
  // deterministic rule-based advisor and flag `aiConfigured: false` so the UI
  // can nudge the user to connect an AI.
  let engine = user
    ? await resolveEngine(user.id, "advisor")
    : await resolveDefaultEngine()
  if (!engine.ok && request.headers.get("x-user-llm") === "ollama") {
    const ollama = getProvider("ollama")
    if (ollama) {
      engine = {
        ok: true,
        provider: ollama,
        model: resolveModel(ollama, process.env.OLLAMA_MODEL),
        apiKey: null,
      }
    }
  }

  let aiReason: string | null = engine.ok ? null : engine.reason
  // Distinct from `aiReason`: set only when an engine IS configured but the
  // call to it failed. That case used to be completely silent — the user got a
  // canned rule-based answer with `aiConfigured: true` and no hint that their
  // model had 404'd — which is what "the AI stopped working" looked like.
  let aiError: string | null = null
  if (engine.ok) {
    try {
      const llm = await generateAdvisorResponse(
        {
          team,
          userMessage,
          history,
          playerProfile,
          locale: answerLocale,
          candidates,
          namedValuation,
          trade,
          web,
          teamBudget,
          operation,
          nationalityFilter,
          roster,
        },
        {
          provider: engine.provider,
          model: engine.model,
          apiKey: engine.apiKey,
        },
      )
      if (llm.ok) {
        // A model that fell into a repetition loop, or that answered with an
        // outline of headings it never filled in, has "succeeded" as far as
        // the HTTP call is concerned. Both are failures for the reader, so
        // let the rule-based path below answer instead.
        const guard = trimDegeneratedOutput(llm.content)
        const broken =
          isMostlyHeadings(guard.text) ||
          (guard.looped && !isUsableAnswer(guard.text))
        if (!broken) {
          const safe = cleanLlmOutput(guard.text)
          await persistAssistant(db, conversationId!, safe, llm.model, "llm")
          // No `data`, so no card deck under the answer.
          //
          // The cards were added to stop a connected AI from replacing
          // checkable numbers with unverifiable prose, and they solved that by
          // bolting a shortlist onto EVERY reply — a diagnosis, three players
          // priced at €60M and a four-point checklist, printed under a
          // one-line hello. The owner's call, and it is the right one: an
          // advisor answers in sentences.
          //
          // The grounding did not go with them. The shortlist is still built
          // and still goes into the prompt, the closed-list rule still forbids
          // naming anyone we cannot price, and `recommendationShape` still
          // requires the club, the valuation and a real stat next to every
          // name — inside the prose, where a reader actually reads it. The
          // rule-based fallback below keeps its cards: with no AI configured
          // they are the whole answer, not a decoration on one.
          return NextResponse.json(
            {
              content: safe,
              model: llm.model,
              provider: engine.provider.id,
              mode: "llm" as const,
              conversationId,
            },
            { headers: securityHeaders() },
          )
        }
        aiReason = "ai_error"
        // Shown to the reader, so it goes in their language — unlike the
        // provider errors below, which arrive in English from the vendor.
        aiError =
          locale === "es"
            ? "El modelo se quedó en bucle en lugar de responder. Suele arreglarse eligiendo un modelo más grande en Ajustes."
            : "The model looped instead of answering. Picking a larger model in Settings usually fixes it."
        audit("llm-degenerate", { ip, provider: engine.provider.id })
      } else {
        aiReason = "ai_error"
        aiError = redactSecrets(llm.error)
        audit("llm-failed", { ip, provider: engine.provider.id, error: aiError })
      }
    } catch (err) {
      aiReason = "ai_error"
      aiError = redactSecrets(String(err))
      audit("llm-threw", { ip, err: String(err) })
    }
  }

  // 13. Fallback (rule-based). Always available, even with no AI configured —
  // now grounded on the same real DB candidates as the LLM path.
  try {
    const fallback: AdvisorOutput = await buildLocalAdvice(
      team,
      userMessage,
      answerLocale,
      candidatesToRecruits(candidates, answerLocale),
    )
    const safe = cleanLlmOutput(fallback.analysis)
    await persistAssistant(db, conversationId!, safe, null, "local")
    return NextResponse.json(
      {
        content: safe,
        data: fallback,
        mode: "local" as const,
        aiConfigured: engine.ok,
        aiReason,
        aiError,
        aiProvider: engine.ok ? engine.provider.name : null,
        aiModel: engine.ok ? engine.model : null,
        conversationId,
      },
      { headers: securityHeaders() },
    )
  } catch (err) {
    audit("fallback-failed", { ip, err: String(err) })
    return jsonError(
      "Something went wrong while processing your query. Please try again.",
      500,
    )
  }
}

/** Shape DB candidates into the Recruit cards the fallback UI renders. */
function candidatesToRecruits(
  candidates: Candidate[],
  locale: Locale,
): Recruit[] {
  const es = locale === "es"
  return candidates.map((c) => {
    const p = c.player
    const gp = p.stats.gamesPlayed
    const perGame = (total: number | null): string | null =>
      total == null || gp <= 0 ? null : (total / gp).toFixed(1)
    const pct = (v: number | null): string | null =>
      v == null ? null : `${(v * 100).toFixed(0)}%`

    // Only what we actually measured. A missing stat is dropped, never zeroed:
    // "0.0 asistencias" and "no lo sabemos" are very different claims.
    const stats = [
      { label: es ? "PTS" : "PTS", value: perGame(p.stats.pointsTotal) },
      { label: es ? "REB" : "REB", value: perGame(p.stats.reboundsTotal) },
      { label: es ? "AST" : "AST", value: perGame(p.stats.assistsTotal) },
      { label: es ? "T3" : "3P", value: pct(p.stats.threePct) },
      { label: es ? "PJ" : "GP", value: gp > 0 ? String(gp) : null },
    ].filter((s): s is { label: string; value: string } => s.value !== null)

    return {
      name: p.fullName,
      position: p.position ?? "N/A",
      league: p.league.name,
      // Same rule as the stats two lines up: unknown is dropped, not zeroed.
      age: p.age ?? null,
      contractValue: formatEur(p.valuation.eur),
      annual:
        p.valuation.annualEur != null
          ? `${formatEur(p.valuation.annualEur)}${es ? "/año" : "/yr"}`
          : null,
      strengths: [
        valuationTierLabel(p.valuation.tier, p.valuation.leagueSlug, locale),
        `Rating ${p.valuation.rating}/100`,
      ],
      fit: c.reason,
      market: p.team ? p.team.name : promptCopy(locale).freeAgent,
      stats,
    }
  })
}

async function persistAssistant(
  db: ReturnType<typeof getDb>,
  conversationId: string,
  content: string,
  model: string | null,
  mode: "llm" | "local",
): Promise<void> {
  try {
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      conversationId,
      role: "assistant",
      content,
      model,
      mode,
    })
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
  } catch {
    // Best-effort persistence.
  }
}

export async function GET() {
  return jsonError("Method not allowed.", 405, { Allow: "POST" })
}
