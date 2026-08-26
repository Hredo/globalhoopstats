import { describe, it, expect } from "vitest"
import { splitReasoning, stripReasoning } from "@/lib/ai/reasoning"
import { looksLikeSmallTalk, looksLikeKnowledgeQuestion } from "@/lib/ai/intent"
import { buildSystemPrompt } from "@/lib/ai/llm"
import type { TeamProfile } from "@/lib/data/teams"

/**
 * The answer a coach was actually shown after typing "hola" into the advisor,
 * trimmed. Everything above the last line is the model interrogating its own
 * system prompt, in English, and it reached the screen because nothing in the
 * codebase looked for a `<think>` block.
 */
const LEAKED_THINKING = [
  "<think> Here's a thinking process:",
  "",
  "1. Analyze User Input:",
  '   * User says: "hola" (hello)',
  "   * Constraints: Always respond in Spanish. No preambles.",
  "",
  "1. Draft Construction (Mental Refinement):",
  "",
  "Hola. ¿Qué necesitas hoy?",
  "Check against constraints:",
  "",
  "* Direct? Yes.",
  "* Spanish? Yes.",
  "",
  "This fits perfectly. Matches all constraints.✅ </think>",
  "Hola. ¿Qué necesitas hoy? Si buscas cubrir un hueco, ajustar la plantilla o evaluar un movimiento, dímelo y vamos al grano.",
].join("\n")

describe("reasoning blocks never reach the reader", () => {
  it("keeps only the answer from the advisor's leaked-thinking reply", () => {
    const { answer, hadReasoning } = splitReasoning(LEAKED_THINKING)
    expect(hadReasoning).toBe(true)
    expect(answer).toBe(
      "Hola. ¿Qué necesitas hoy? Si buscas cubrir un hueco, ajustar la plantilla o evaluar un movimiento, dímelo y vamos al grano.",
    )
    expect(answer).not.toMatch(/thinking process|Check against constraints/i)
  })

  it("handles every tag spelling the vendors use", () => {
    for (const tag of [
      "think",
      "thinking",
      "reasoning",
      "reflection",
      "scratchpad",
      "analysis",
    ]) {
      expect(stripReasoning(`<${tag}>scratch work</${tag}>La respuesta.`)).toBe(
        "La respuesta.",
      )
    }
  })

  it("tolerates attributes and stray whitespace in the tag", () => {
    expect(stripReasoning('<think duration="4s">hmm</think>\n\nRespuesta.')).toBe(
      "Respuesta.",
    )
    expect(stripReasoning("< think >hmm< / think >Respuesta.")).toBe("Respuesta.")
  })

  it("drops the prefix when only the closing tag survived", () => {
    // Several providers strip the opener when they stream reasoning on a
    // separate field, and leave the closer in the text.
    expect(stripReasoning("deliberating out loud</think>La respuesta.")).toBe(
      "La respuesta.",
    )
  })

  it("returns nothing when the model never stopped thinking", () => {
    // Hit the token cap mid-thought. There is no answer in here, and showing
    // the deliberation instead is exactly the bug.
    const { answer, hadReasoning } = splitReasoning(
      "<think>Let me work through the roster. First the guards, then",
    )
    expect(answer).toBe("")
    expect(hadReasoning).toBe(true)
  })

  it("isolates the final channel of an OpenAI Harmony response", () => {
    const raw =
      "<|channel|>analysis<|message|>The user greeted me. Keep it short.<|end|>" +
      "<|start|>assistant<|channel|>final<|message|>Hola, dime qué necesitas."
    expect(stripReasoning(raw)).toBe("Hola, dime qué necesitas.")
  })

  it("handles the full-width bracket form", () => {
    expect(stripReasoning("◁think▷pensando◁/think▷Respuesta.")).toBe("Respuesta.")
  })

  it("leaves an ordinary answer untouched", () => {
    const clean =
      "Me quedaría con Curry. Tira mejor de lejos (42%) y te abre la pista para el resto.\n\nSi buscas defensa, la elección es otra."
    const { answer, hadReasoning } = splitReasoning(clean)
    expect(answer).toBe(clean)
    expect(hadReasoning).toBe(false)
  })

  it("does not eat a markdown answer that merely mentions thinking", () => {
    const text = "Lo que pienso: no lo ficharía. Piensa en el encaje, no en el nombre."
    expect(stripReasoning(text)).toBe(text)
  })

  it("unwraps a JSON document a reasoning model prefixed", () => {
    // The playbook photo import parses this. A `<think>` block glued to the
    // front is not a bad answer, it is a crash.
    const raw = '<think>Reading the board…</think>\n{"name":"Horns","steps":[]}'
    expect(() => JSON.parse(stripReasoning(raw))).not.toThrow()
  })
})

describe("a greeting is not a transfer request", () => {
  it("recognises the ways a coach says hello", () => {
    for (const message of [
      "hola",
      "Hola!",
      "  HOLA  ",
      "buenas",
      "buenas tardes",
      "hola, ¿qué tal?",
      "hey",
      "hi there",
      "good morning",
      "gracias",
      "muchas gracias",
      "prueba",
      "test",
    ]) {
      expect(looksLikeSmallTalk(message), message).toBe(true)
    }
  })

  it("does not swallow a real question that opens with a greeting", () => {
    for (const message of [
      "hola, ¿a quién ficho para el poste?",
      "buenas, necesito un base",
      "gracias, ¿y quién sale para pagarlo?",
      "¿quién es el mejor base de la ACB?",
      "Curry",
      "sí",
      "ok, ¿y el presupuesto?",
    ]) {
      expect(looksLikeSmallTalk(message), message).toBe(false)
    }
  })

  it("leaves the knowledge-question router alone", () => {
    // The two gates are independent: a greeting is neither a knowledge
    // question nor a market one.
    expect(looksLikeKnowledgeQuestion("hola")).toBe(false)
    expect(looksLikeKnowledgeQuestion("¿quién es el mejor base de la ACB?")).toBe(
      true,
    )
  })
})

/** The smallest team the prompt builder will accept. */
const TEAM = {
  id: 1,
  name: "Golden State Warriors",
  slug: "golden-state-warriors",
  league: { name: "NBA", region: "USA", slug: "nba" },
  roster: [],
} as unknown as TeamProfile

describe("the advisor's hello prompt", () => {
  const greeting = buildSystemPrompt({
    team: TEAM,
    userMessage: "hola",
    history: [],
    locale: "es",
    candidates: [],
    operation: "general",
  })

  it("carries no shortlist, no budget and no closed-list rule", () => {
    expect(greeting).not.toMatch(/Candidatos verificados/i)
    expect(greeting).not.toMatch(/presupuesto/i)
    expect(greeting).not.toMatch(/únicos jugadores que puedes proponer/i)
  })

  it("still answers in the coach's language, as its own club", () => {
    expect(greeting).toMatch(/español/i)
    expect(greeting).toContain("Golden State Warriors")
  })

  it("is a fraction of the size of the full brief", () => {
    const full = buildSystemPrompt({
      team: TEAM,
      userMessage: "¿a quién ficho para el poste?",
      history: [],
      locale: "es",
      candidates: [],
      operation: "signing",
    })
    expect(greeting.length).toBeLessThan(full.length / 2)
  })
})
