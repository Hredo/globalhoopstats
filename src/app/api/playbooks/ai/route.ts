import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { chatComplete } from "@/lib/ai/chat"
import { aiLanguageDirective } from "@/lib/ai/language"
import { resolveDefaultEngine, resolveEngine } from "@/lib/ai/user-provider"
import { getLocale } from "@/lib/i18n/server"
import { describePlay } from "@/lib/playbook/describe"
import { parsePlay } from "@/lib/playbook/types"
import {
  cleanLlmOutput,
  cleanUserText,
  clientIp,
} from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"

export const dynamic = "force-dynamic"

const MAX_QUESTION_LEN = 500

const SYSTEM_PROMPT = `You are an elite basketball tactician — a blend of a EuroLeague head coach and an NBA advance scout. You receive a frame-by-frame description of a set play drawn by a coach (positions in named court zones, plus the drawn actions: cuts, dribbles, screens, passes, handoffs) and you break it down with real tactical depth.

Ground every observation in the actual geometry described — name the zones, the players (O1–O5) and the frames. Never invent actions that are not in the description. If something is ambiguous or missing (e.g. no defenders drawn), say so briefly and analyse what IS there.

Structure your answer in Markdown with these sections (translate the headings to the required language):
1. **Verdict** — one line: what this play is and how good it is.
2. **What it attacks** — the concept/advantage it creates (spacing, mismatch, weak side, etc.).
3. **Strengths** — 2-4 concrete points tied to frames/zones.
4. **Vulnerabilities & counters** — how a good defense kills it (switch, ice, drop, zone…), tied to specific moments.
5. **Timing & spacing details** — the coaching points that make it work: angles, pace, when each cut must start.
6. **Personnel fit** — what kind of players each role needs (and, if real players are linked, whether THEY fit).
7. **Variations** — 1-3 counters/wrinkles to add out of the same alignment.

Be specific and opinionated, no filler, no generic praise. Around 300-500 words.`

export async function POST(request: Request) {
  const ip = clientIp(request)
  const limit = await consumeRateLimit(`ai:${ip}`, 30, 5 * 60 * 1000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limit.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    )
  }

  let body: { play?: unknown; question?: unknown }
  try {
    body = (await request.json()) as { play?: unknown; question?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const play = parsePlay(body.play)
  if (!play) {
    return NextResponse.json({ error: "Invalid play document." }, { status: 400 })
  }

  const question =
    typeof body.question === "string"
      ? cleanUserText(body.question).slice(0, MAX_QUESTION_LEN)
      : ""

  const locale = await getLocale()
  const user = await getCurrentUser(request.headers.get("cookie"))
  const engine = user
    ? await resolveEngine(user.id, "advisor")
    : await resolveDefaultEngine()

  if (!engine.ok) {
    return NextResponse.json({
      analysis: null,
      aiConfigured: false,
      aiReason: engine.reason,
    })
  }

  const userMessage = [
    describePlay(play),
    question ? `\nCoach's specific question: ${question}` : "",
    "",
    aiLanguageDirective(locale),
  ].join("\n")

  try {
    const llm = await chatComplete({
      provider: engine.provider,
      model: engine.model,
      apiKey: engine.apiKey,
      system: `${SYSTEM_PROMPT}\n${aiLanguageDirective(locale)}`,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 1200,
      temperature: 0.65,
    })
    if (!llm.ok) {
      return NextResponse.json(
        { error: "The AI engine failed to respond.", aiConfigured: true },
        { status: 502 },
      )
    }
    return NextResponse.json({
      analysis: cleanLlmOutput(llm.content),
      aiConfigured: true,
      provider: engine.provider.id,
    })
  } catch (error) {
    console.error("playbooks/ai error:", error)
    return NextResponse.json(
      { error: "Could not generate the analysis." },
      { status: 500 },
    )
  }
}
