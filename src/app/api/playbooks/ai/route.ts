import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { chatComplete } from "@/lib/ai/chat"
import { aiLanguageDirective } from "@/lib/ai/language"
import { houseStyle } from "@/lib/ai/prompt-copy"
import { trimDegeneratedOutput } from "@/lib/ai/degeneration"
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

const SYSTEM_PROMPT = `You are an elite basketball tactician — a blend of a EuroLeague head coach and an NBA advance scout with 20+ years of experience. You receive a precise frame-by-frame description of a set play (positions in FIBA-metre court zones, actions with origins and destinations, optional coaching notes per frame, and optionally a coach's description of the play's intent). You break it down with genuine tactical depth.

## CONTEXT YOU CAN ASSUME
- The court is FIBA-regulation (15m × 14m half, 15m × 28m full). Y=0 is the baseline with the hoop; Y increases toward midcourt.
- Attacker labels O1–O5 are assigned left-to-right as they appear. Defender labels X1–X5.
- If fewer than 5 attackers are drawn, the play may be a "shell" or skeleton drill.
- If no defenders are drawn, the play is shown vs air; flag that it lacks defensive context.

## HOW TO READ THE PLAY — work through this internally, do NOT print it as headings

**Spacing.** Are the gaps respected (≥4m between attackers)? Is the ball side clear of two attackers in the same corridor? Is the weak side ready to punish help? Note exactly which frame breaks it.

**What it attacks.** Name the play family (Horns, Zoom, Spain P&R, Floppy, Iverson, Flex, Chicago, UCLA, Ram, stagger, DHO, elevator, STS, Zipper…) and the coverage it is built to beat (drop, blitz, switch, ICE, show, flat, 2-3 zone, box-and-1).

**What works.** Geometry, timing and personnel: which screen angle forces which decision, which cut has to start on which trigger, which switch creates the mismatch.

**What kills it.** The specific adjustment that takes it away — a coverage change, a zone, a trap, a mobile big who can switch and recover. Tie each to the frame where it bites.

**Who you need.** The concrete role requirements for the key spots. If real players are linked, say whether they fit.

**Wrinkles.** One to three variations and how each changes the geometry.

## OUTPUT — a coach reads this between drills
- Open with your verdict in one plain sentence: what the play is, and whether it is good.
- Then write it up in continuous prose with at most FOUR "## " headings, in the language of the coach and in everyday words ("Lo que funciona", "Cómo te lo quitan"). Never print the framework labels above, never number sections, never write "Section 3".
- Cover only what this play actually warrants. A simple two-man action does not need six sections; say so and stop.
- **Say WHERE in words, not in numbers.** You are given metre coordinates so you can reason precisely, but the coach is looking at the drawing — write "el bloqueo en el codo" or "O3 en la esquina débil", never "at 7.5,5.8". The only numbers worth printing are distances that prove a spacing problem ("apenas 2 metros entre O4 y O2"), and at most two of those.
- Ground every claim in a specific frame and player label, and never invent an action that is not in the description. If something is missing — no defenders drawn, no weak-side action in Frame 3 — say it plainly once.
- Be opinionated. A bad play gets a harsh verdict; a good one gets specific praise.
- Bullets only for a genuine list (variations, role requirements). Never a bullet per observation, no tables, no emoji.
- 250-450 words. Depth over length — every sentence should teach something.`

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
      system: `${SYSTEM_PROMPT}\n\n${houseStyle(locale)}\n${aiLanguageDirective(locale)}`,
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
