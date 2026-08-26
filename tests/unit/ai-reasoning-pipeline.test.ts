import { describe, it, expect, vi, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { generateGroundedAnswer } from "@/lib/ai/answer"
import type { AiProvider } from "@/lib/ai/providers"

/**
 * End-to-end proof that a reasoning model's scratch work cannot reach a user,
 * with the provider faked at `fetch`.
 *
 * The DB this app talks to refuses connections from the owner's machine, so
 * the advisor page cannot be driven locally. This exercises the same path the
 * page does — `generateGroundedAnswer` → `chatComplete` → the HTTP body — and
 * asserts on what a browser would have been handed.
 */
const PROVIDER: AiProvider = {
  id: "groq",
  name: "Groq",
  blurb: "test double",
  kind: "openai-compat",
  baseUrl: "https://example.invalid/v1",
  needsKey: true,
  models: [],
  defaultModel: "test-model",
  supportsAdvisor: true,
  supportsCompare: true,
} as unknown as AiProvider

const ENGINE = { provider: PROVIDER, model: "test-model", apiKey: "sk-test" }

/**
 * Reply with one OpenAI-shaped completion per call, repeating the last one
 * once the script runs out — a single-entry script answers every retry the
 * same way, which is how "the model failed twice" is expressed here.
 */
function mockCompletion(...contents: string[]) {
  const queue = [...contents]
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        { message: { content: queue.length > 1 ? queue.shift() : queue[0] } },
      ],
    }),
    text: async () => "",
    clone() {
      return this
    },
  })) as unknown as typeof fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const REAL_ANSWER =
  "Curry sigue siendo el mejor tirador de la liga y con 26,6 puntos por partido " +
  "te resuelve el ataque solo. La pega es la defensa: cede centímetros en el " +
  "perímetro y hay que taparle la espalda con un alero largo. Aun así, yo lo " +
  "firmaría hoy mismo y ajustaría la rotación a su alrededor."

describe("a reasoning model's scratch work never reaches the browser", () => {
  it("returns the answer alone when the model wrapped it in <think>", async () => {
    vi.stubGlobal(
      "fetch",
      mockCompletion(
        `<think>\nThe user wants a view on Curry. Constraints: Spanish, no preamble.\nLet me check the data block... 26.6 PPG is there, good.\nDraft: mention shooting, then defence, then commit.\n</think>\n\n${REAL_ANSWER}`,
      ),
    )

    const result = await generateGroundedAnswer({
      engine: ENGINE,
      system: "Eres un analista de baloncesto veterano.",
      data: "Stephen Curry: 26,6 puntos por partido.",
      locale: "es",
      checkFigures: false,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toBe(REAL_ANSWER)
    expect(result.text).not.toMatch(/<think|Constraints|Draft:/i)
  })

  it("retries with more room when the model thought until it ran out", async () => {
    // First call: opened a `<think>` and hit the cap. Second: an answer.
    const fetchMock = mockCompletion(
      "<think>Let me work through the roster. First the guards, then the",
      REAL_ANSWER,
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await generateGroundedAnswer({
      engine: ENGINE,
      system: "Eres un analista de baloncesto veterano.",
      data: "Stephen Curry: 26,6 puntos por partido.",
      locale: "es",
      maxTokens: 400,
      checkFigures: false,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toBe(REAL_ANSWER)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const bodyOf = (call: number) =>
      JSON.parse(
        (vi.mocked(fetchMock).mock.calls[call][1] as RequestInit).body as string,
      )
    expect(bodyOf(0).max_tokens).toBe(400)
    // Room for the deliberation AND the answer, plus a plain instruction to
    // skip the deliberation.
    expect(bodyOf(1).max_tokens).toBe(1000)
    expect(bodyOf(1).messages[0].content).toMatch(/No escribas tu razonamiento/i)
  })

  it("explains itself in Spanish when even the retry was all thinking", async () => {
    vi.stubGlobal(
      "fetch",
      mockCompletion("<think>still deliberating and out of budget"),
    )

    const result = await generateGroundedAnswer({
      engine: ENGINE,
      system: "Eres un analista de baloncesto veterano.",
      data: "Stephen Curry: 26,6 puntos por partido.",
      locale: "es",
      maxTokens: 400,
      checkFigures: false,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    const { answerFailureMessage } = await import("@/lib/ai/answer")
    const message = answerFailureMessage(result, "es")
    expect(message).toMatch(/razonando por dentro/i)
    // Actionable: names the kind of model that does this.
    expect(message).toMatch(/thinking|reasoning|-r1/i)
  })
})

describe("no transport can skip the strip", () => {
  it("routes every provider's response through completion()", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "ai", "chat.ts"),
      "utf8",
    )
    // Three transports: OpenAI-compatible, Anthropic, Google. Each one must
    // hand its raw text to `completion`, which is where the reasoning goes.
    const calls = src.match(/return completion\(/g) ?? []
    expect(
      calls.length,
      "a transport in chat.ts returns model text without going through completion() — reasoning would leak from it",
    ).toBe(3)
    // And only `completion` itself builds a successful result, so there is one
    // place where the strip happens and no way round it.
    expect((src.match(/ok: true, content/g) ?? []).length).toBe(1)
  })
})

describe("the advisor says it failed instead of inventing an answer", () => {
  const route = readFileSync(
    join(process.cwd(), "src", "app", "api", "ai-advisor", "route.ts"),
    "utf8",
  )

  it("has no rule-based substitute left", () => {
    // Ollama went down mid-conversation and the advisor carried on: a roster
    // diagnosis for Real Madrid and three Primera FEB signings, assembled from
    // a template, with nothing saying the model had never been reached.
    // The call, not the name: the comment above the replacement explains what
    // used to be here and would otherwise trip this.
    expect(
      /\bbuildLocalAdvice\s*\(/.test(route),
      "the advisor fell back to the rule-based advisor again — a failure must be reported, not papered over",
    ).toBe(false)
    expect(route).not.toContain("candidatesToRecruits")
    expect(route).not.toMatch(/import[\s\S]{0,120}buildLocalAdvice/)
  })

  it("returns no card deck on any path", () => {
    // `data` is what the UI renders the candidate cards from.
    expect(route).not.toMatch(/^\s*data:/m)
  })

  it("marks the notice so it never becomes conversation history", () => {
    expect(route).toContain('mode: "error"')
  })

  it("names Ollama when the engine is simply not running", async () => {
    const { answerFailureMessage } = await import("@/lib/ai/answer")
    const message = answerFailureMessage(
      {
        ok: false,
        reason: "provider",
        error:
          "Could not reach the model. If you use Ollama, make sure it is running.",
      },
      "es",
    )
    expect(message).toMatch(/Ollama/)
    // Not the generic "the provider failed", which sends the reader to check
    // an API key when the fix is to start the app.
    expect(message).not.toMatch(/ha fallado al responder/)
  })

  it("recognises undici's wrapped connection error", async () => {
    // Node throws `TypeError: fetch failed` and hangs the real ECONNREFUSED
    // off `cause`, so the top-level message carries no code at all.
    const { answerFailureMessage } = await import("@/lib/ai/answer")
    const message = answerFailureMessage(
      { ok: false, reason: "provider", error: "fetch failed" },
      "es",
    )
    expect(message).toMatch(/Ollama/)
  })
})
