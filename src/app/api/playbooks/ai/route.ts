import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import {
  answerFailureMessage,
  generateGroundedAnswer,
} from "@/lib/ai/answer"
import {
  aiLanguageDirective,
  aiLanguageName,
  replyLocale,
} from "@/lib/ai/language"
import { houseStyle } from "@/lib/ai/prompt-copy"
import { playbookInstructions } from "@/lib/ai/playbook-instructions"
import { supportsNativeWebSearch } from "@/lib/ai/chat"
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
  aiRateLimit,
  audit,
  clientIp,
  jsonError,
  sanitisePromptInput,
  screenPromptFields,
} from "@/lib/security/ai-advisor"

export const dynamic = "force-dynamic"

const MAX_QUESTION_LEN = 500
/** Per text field on the play itself: a note is a note, not a document. */
const MAX_PLAY_TEXT_LEN = 400

export async function POST(request: Request) {
  const ip = clientIp(request)
  const limit = aiRateLimit(ip)
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

  // The question is user text going into a prompt, and so are the play's own
  // name, description, per-frame notes and on-court text labels — which are
  // attacker-controlled the moment a play is imported from someone else's
  // file. None of it used to be screened.
  const asked = sanitisePromptInput(body.question, MAX_QUESTION_LEN)
  const playFindings = screenPromptFields(
    [
      play.name,
      play.description,
      ...play.frames.map((f) => f.note),
      ...play.elements.map((e) => e.label),
    ],
    MAX_PLAY_TEXT_LEN,
  )
  if (!asked.ok || playFindings.length > 0) {
    audit("prompt-injection-blocked", {
      ip,
      route: "playbooks/ai",
      findings: (asked.ok ? playFindings : asked.findings).slice(0, 5),
    })
    return jsonError(
      "This play or question contains patterns that are not allowed. Rephrase it as a normal coaching question.",
      400,
    )
  }
  const question = asked.text

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
  // action types), so the question is labelled in the coach's own language.
  //
  // The language directive used to be appended here, at the end of the user
  // turn. That is the one thing the rest of the pipeline forbids: a small model
  // reads the user turn as MATERIAL, not as orders, and hands the orders back
  // as the answer — which is how the compare screen once shipped a translation
  // of its own brief as the analysis. It lives in `system` below, twice, where
  // instructions belong.
  const questionLabel =
    answerLocale === "es"
      ? "Pregunta concreta del entrenador"
      : "The coach's specific question"
  const userMessage = [
    describePlay(play),
    question ? `\n${questionLabel}: ${question}` : "",
    clubs ? `\n${clubs}` : "",
  ].join("\n")

  try {
    const system = [
      playbookInstructions(answerLocale),
      "",
      houseStyle(answerLocale),
      "",
      // Repeated last on purpose: the closing line is the one a model that has
      // just read a long block of English court coordinates weighs most.
      `${aiLanguageDirective(answerLocale)} (${aiLanguageName(answerLocale)})`,
    ].join("\n")
    const answer = await generateGroundedAnswer({
      engine,
      system,
      data: userMessage,
      locale: answerLocale,
      maxTokens: 1200,
      temperature: 0.65,
      webSearch: supportsNativeWebSearch(engine.provider),
      // A good breakdown works distances and angles out from the metre
      // coordinates it was given, so its numbers are derived rather than
      // quoted. Numeric grounding is the wrong tool here; the rest applies.
      checkFigures: false,
    })
    if (!answer.ok) {
      // 200, not 502. The request was valid, our server is healthy, and the
      // body carries the explanation the user needs to act on — but a 5xx
      // travels through Cloudflare, which may replace the body with its own
      // error page, and then the browser gets HTML where it expected JSON and
      // the reader is told only "failed to load resource". The failure is in
      // the payload, where every other AI surface on the site puts it.
      return NextResponse.json({
        analysis: null,
        error: answerFailureMessage(answer, answerLocale),
        aiConfigured: true,
      })
    }
    return NextResponse.json({
      analysis: answer.text,
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
