import { describe, it, expect, vi, afterEach } from "vitest"
import { chatComplete } from "@/lib/ai/chat"
import { answerFailureMessage, generateGroundedAnswer } from "@/lib/ai/answer"
import type { AiProvider } from "@/lib/ai/providers"

/**
 * A provider's rate limit is a wait, not an answer.
 *
 * What a coach saw, two questions into a session: "Has llegado al límite de uso
 * de tu proveedor de IA. Vuelve a intentarlo en unos 6 segundos." The advice in
 * that sentence was correct and the product simply did not take it — a free
 * Groq key is 6 000 tokens a minute, one advisor question carrying a shortlist
 * is most of that, and the six seconds it asked for would have made the whole
 * thing go away. The message only belongs on screen when waiting genuinely will
 * not help.
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

const CALL = {
  provider: PROVIDER,
  model: "test-model",
  apiKey: "sk-test",
  system: "Eres un analista de baloncesto veterano.",
  messages: [{ role: "user" as const, content: "¿Quién refuerza el base?" }],
}

type Scripted = {
  status: number
  /** Vendor error body, for a failure. */
  body?: string
  headers?: Record<string, string>
  /** Completion text, for a success. */
  content?: string
}

/** Reply with one scripted HTTP response per call, in order. */
function mockHttp(...script: Scripted[]) {
  let i = 0
  return vi.fn(async () => {
    const step = script[Math.min(i++, script.length - 1)]
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      statusText: "",
      headers: new Headers(step.headers ?? {}),
      json: async () => ({
        choices: [{ message: { content: step.content ?? "" } }],
      }),
      text: async () => step.body ?? "",
      clone() {
        return this
      },
    }
  }) as unknown as typeof fetch
}

/** Groq's own 429 body, which is where the wait is written. */
const GROQ_429 = (seconds: string) =>
  JSON.stringify({
    error: {
      message: `Rate limit reached for model \`test-model\` on tokens per minute (TPM): Limit 6000, Used 5312. Please try again in ${seconds}s.`,
      type: "tokens",
      code: "rate_limit_exceeded",
    },
  })

const ANSWER =
  "El base que encaja es un director de juego que asista sin perder balones y " +
  "castigue el bloqueo directo. Con tu plantilla actual pediría minutos de " +
  "control más que de anotación, y lo firmaría por dos temporadas."

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a throttled provider is waited out, not reported", () => {
  it("retries after the pause the vendor asked for", async () => {
    const fetchMock = mockHttp(
      { status: 429, body: GROQ_429("0.05") },
      { status: 200, content: ANSWER },
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await chatComplete(CALL)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toBe(ANSWER)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("honours a Retry-After header when the body says nothing", async () => {
    const fetchMock = mockHttp(
      { status: 503, headers: { "retry-after": "0" } },
      { status: 200, content: ANSWER },
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await chatComplete(CALL)

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("gives up rather than wait longer than the answer has left", async () => {
    // Two minutes is past any web request's budget. Waiting it out would cost
    // the coach the wait AND still show them nothing.
    const fetchMock = mockHttp({
      status: 429,
      body: GROQ_429("120"),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await chatComplete(CALL)

    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not retry a failure that waiting cannot fix", async () => {
    const fetchMock = mockHttp({
      status: 401,
      body: JSON.stringify({ error: { message: "Invalid API Key" } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await chatComplete(CALL)

    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("stops after a bounded number of waits and says so in the user's language", async () => {
    const fetchMock = mockHttp({ status: 429, body: GROQ_429("0.05") })
    vi.stubGlobal("fetch", fetchMock)

    const answer = await generateGroundedAnswer({
      engine: { provider: PROVIDER, model: "test-model", apiKey: "sk-test" },
      system: "Eres un analista de baloncesto veterano.",
      data: "Plantilla: 12 jugadores.",
      locale: "es",
      checkFigures: false,
    })

    expect(answer.ok).toBe(false)
    if (answer.ok) return
    // Three attempts: the first, plus MAX_THROTTLE_RETRIES waits. A key that is
    // still refusing after that is out of budget, not merely busy.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(answerFailureMessage(answer, "es")).toContain(
      "límite de uso de tu proveedor",
    )
  })
})
