import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { chatComplete } from "@/lib/ai/chat"
import { aiLanguageDirective, replyLocale } from "@/lib/ai/language"
import { houseStyle } from "@/lib/ai/prompt-copy"
import { playbookInstructions } from "@/lib/ai/playbook-instructions"
import { trimDegeneratedOutput } from "@/lib/ai/degeneration"
import {
  describeTeamProfiles,
  detectLeagueSlug,
  leagueTeamProfiles,
} from "@/lib/market/team-profiles"
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
  // A coach who types the question in Spanish gets a Spanish answer, whatever
  // the site language is set to.
  const answerLocale = replyLocale(question, locale)
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

  // "Which ACB team could run this?" used to be answered from the model's
  // memory. If the question (or the play itself) names a league we cover, hand
  // it the real squads instead, measured this season.
  let clubs = ""
  const askedLeague =
    detectLeagueSlug(question) ?? play.team?.leagueSlug ?? null
  if (askedLeague) {
    try {
      clubs = describeTeamProfiles(
        await leagueTeamProfiles(askedLeague),
        askedLeague,
        answerLocale,
      )
    } catch {
      // No squad data is a reason to answer without it, not to fail.
      clubs = ""
    }
  }

  // The play description is machine-generated English (it names court zones and
  // action types), so the question is labelled in the coach's own language and
  // the language directive is repeated last — the position a model weighs most.
  const questionLabel =
    answerLocale === "es"
      ? "Pregunta concreta del entrenador"
      : "The coach's specific question"
  const userMessage = [
    describePlay(play),
    question ? `\n${questionLabel}: ${question}` : "",
    clubs ? `\n${clubs}` : "",
    "",
    aiLanguageDirective(answerLocale),
  ].join("\n")

  try {
    const llm = await chatComplete({
      provider: engine.provider,
      model: engine.model,
      apiKey: engine.apiKey,
      system: [
        playbookInstructions(answerLocale),
        "",
        houseStyle(answerLocale),
        "",
        aiLanguageDirective(answerLocale),
      ].join("\n"),
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
      analysis: cleanLlmOutput(trimDegeneratedOutput(llm.content).text),
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
