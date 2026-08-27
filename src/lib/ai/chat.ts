/**
 * Unified chat-completion dispatcher. Given a provider from the catalogue, a
 * model, an optional API key and a system + message list, it calls the right
 * HTTP API (OpenAI-compatible, Anthropic or Google) and returns plain text.
 *
 * Cloud base URLs come from the static catalogue (never user input). The only
 * user-controllable destination is the local Ollama URL, which is SSRF-guarded
 * via safeOllamaBaseUrl.
 */
import type { AiProvider } from "@/lib/ai/providers"
import { splitReasoning } from "@/lib/ai/reasoning"
import { safeOllamaBaseUrl } from "@/lib/security/ai-advisor"

/**
 * Ceiling for one provider call.
 *
 * This was 120s, which no hosting layer in front of us will wait for: nginx on
 * the origin gives up first and the browser gets a 502 with an HTML body it
 * cannot parse. `/api/market/trade/ai` was returning exactly that. Callers
 * that answer inside a request should pass something tighter still — see the
 * budget in `ai/answer.ts`, which has to fit TWO of these.
 */
const TIMEOUT_MS = 55_000

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type ChatInput = {
  provider: AiProvider
  model: string
  apiKey: string | null
  system: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  /**
   * Enable the provider's NATIVE web search, billed to the user's own key
   * (Anthropic web_search tool / Gemini Google Search grounding). Lets the
   * advisor use the internet without a separate Tavily key. No-op on providers
   * that don't support it.
   */
  webSearch?: boolean
  /**
   * Give up before the platform does. A request that outlives the hosting
   * timeout comes back to the browser as an HTML error page instead of our
   * JSON, which the UI can only report as a vague network failure.
   */
  timeoutMs?: number
}

/**
 * Providers whose OWN key can search the web (no external search backend). Used
 * to decide who gets native search vs the universal pre-fetch fallback that
 * works with every other model (Groq, DeepSeek, Mistral, xAI, OpenAI, Ollama…).
 */
export function supportsNativeWebSearch(provider: AiProvider): boolean {
  if (provider.kind === "anthropic" || provider.kind === "google") return true
  // OpenAI-compatible providers that ground on the web with their own key:
  // Perplexity Sonar always searches; OpenRouter exposes a web plugin.
  return provider.id === "perplexity" || provider.id === "openrouter"
}

export type ChatResult =
  | { ok: true; content: string; model: string }
  | {
      ok: false
      error: string
      status?: number
      /** How long the vendor asked us to wait, when it said. See `chatComplete`. */
      retryAfterMs?: number
    }

/**
 * The model opened a reasoning block and hit the token cap before closing it,
 * so there is no answer to show.
 *
 * A named constant rather than a string match on the prose: `answer.ts` reacts
 * to this by retrying with a bigger budget, and that behaviour should not hinge
 * on nobody rewording an error message.
 */
export const REASONING_ONLY_ERROR =
  "The model used its whole response on internal reasoning and never wrote an answer."

/**
 * Turn a raw completion into a result, with the model's scratch work removed.
 *
 * Every transport funnels through here. A reasoning model marks its
 * deliberation (`<think>…</think>`, a Harmony `analysis` channel) and every
 * chat product in the world hides it; ours did not, on any surface, which is
 * why a "hola" came back as five paragraphs of the model interrogating its own
 * instructions in English. See `ai/reasoning.ts`.
 *
 * When the model spent its whole budget thinking there is no answer to show,
 * and that is a distinct failure from an empty response: the fix is a bigger
 * token cap or a model that does not think out loud, so it says so.
 */
function completion(raw: string | undefined, model: string): ChatResult {
  const text = raw?.trim() ?? ""
  if (!text) return { ok: false, error: "Empty response." }
  const { answer, hadReasoning } = splitReasoning(text)
  if (!answer) return { ok: false, error: REASONING_ONLY_ERROR }
  if (hadReasoning) {
    // Not an error — it is the normal shape of a reasoning model — but worth a
    // line when someone is working out why an answer arrived truncated.
    console.info(`[ai] stripped reasoning block from ${model}`)
  }
  return { ok: true, content: answer, model }
}

function localBaseUrl(provider: AiProvider): string | null {
  const raw = process.env.OLLAMA_BASE_URL ?? provider.baseUrl
  return safeOllamaBaseUrl(raw)
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number = TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Statuses that mean "not now" rather than "no".
 *
 * 429 is the vendor's own throttle. A free Groq key is 6 000 tokens a minute
 * and one advisor question carrying a shortlist can be most of that, so a
 * coach asking two questions in a row hits it through no fault of their own.
 * 503 and Anthropic's 529 are the same shape: the model is up, the door is
 * momentarily shut. Everything else — a bad key, a retired model id, no
 * credit — is a "no", and retrying it just wastes the user's wait.
 */
const RETRYABLE_STATUS = new Set([429, 503, 529])

/** Waits per call. Past this the key is out of budget, not merely busy. */
const MAX_THROTTLE_RETRIES = 2

/**
 * A retry needs enough of the budget left to actually finish. Waiting out a
 * throttle and then being killed mid-answer costs the user the wait AND shows
 * them nothing, which is worse than passing the 429 through.
 */
const RETRY_HEADROOM_MS = 8_000

/** Backoff when the vendor throttled us without saying for how long. */
const BLIND_BACKOFF_MS = 2_000

/**
 * How long the vendor says to wait, in ms, or undefined if it did not say.
 *
 * Two forms, both common. `Retry-After` is the standard one (a count of
 * seconds, or an HTTP date). The rest write it into the error body: Groq sends
 * "Please try again in 6.017s", and "in 2m30s" once a daily cap is involved.
 */
export function vendorRetryDelayMs(
  res: Response,
  body: string,
): number | undefined {
  const header = res.headers.get("retry-after")
  if (header) {
    const secs = Number(header)
    if (Number.isFinite(secs) && secs >= 0) return Math.ceil(secs * 1000)
    const when = Date.parse(header)
    if (Number.isFinite(when)) return Math.max(0, when - Date.now())
  }
  const m = body.match(/try again in\s+(?:(\d+)m)?([\d.]+)\s*(ms|s)\b/i)
  if (m) {
    const value = Number(m[2])
    if (!Number.isFinite(value)) return undefined
    const minutes = m[1] ? Number(m[1]) : 0
    const rest = m[3].toLowerCase() === "ms" ? value : value * 1000
    return Math.ceil(minutes * 60_000 + rest)
  }
  return undefined
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The shape `withThrottleRetry` needs to see. Both dispatchers return it. */
export type ThrottleAware = {
  ok: boolean
  status?: number
  retryAfterMs?: number
}

/**
 * Run a provider call, waiting out the vendor's throttle rather than reporting
 * it.
 *
 * Nothing here is billed to us: every call runs on the reader's own API key,
 * so the product has no reason to hold an opinion about how often they ask.
 * The only ceiling that exists is their provider's, and the honest answer to
 * it is to do what the provider says — wait the interval it names, then ask
 * again — not to hand a coach "you have hit your usage limit" in the middle of
 * a scouting session. That message was the whole failure: a free Groq key is
 * 6 000 tokens a minute, one advisor question with a shortlist in it is most
 * of that, and the second question of the session got a 429 that a six-second
 * pause would have made go away.
 *
 * The wait is bounded by the CALLER's budget, not by a count of tries. If the
 * vendor asks for longer than there is time to serve an answer in, the failure
 * goes through untouched and `describeProviderError` tells the user what it
 * means — at that point waiting really would be worse than saying so.
 *
 * Shared by text and vision so a 429 means the same thing on every AI surface.
 */
export async function withThrottleRetry<T extends ThrottleAware>(
  label: string,
  totalMs: number,
  expired: () => T,
  call: (remainingMs: number) => Promise<T>,
): Promise<T> {
  const deadline = Date.now() + totalMs

  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return expired()

    const result = await call(remaining)
    if (result.ok) return result
    if (attempt >= MAX_THROTTLE_RETRIES) return result
    if (result.status === undefined || !RETRYABLE_STATUS.has(result.status)) {
      return result
    }

    const wait = result.retryAfterMs ?? BLIND_BACKOFF_MS * 2 ** attempt
    if (Date.now() + wait + RETRY_HEADROOM_MS > deadline) return result

    console.warn(
      `[ai] ${label} throttled (${result.status}) — waiting ${(wait / 1000).toFixed(1)}s`,
    )
    await sleep(wait)
  }
}

/**
 * Repetition controls, sent on every OpenAI-compatible call.
 *
 * Without them a small model (a local 8B, the fast hosted ones) locks onto a
 * phrase and repeats it until it hits the token cap — "de tiro de tiro de
 * tiro…" — or re-emits the same heading a dozen times. No amount of prompt
 * wording prevents that; the sampler does. Values are deliberately mild: high
 * penalties push the model off the vocabulary it needs, and a scouting note
 * has to say "rebotes" more than once.
 *
 * Anthropic has no equivalent parameter and Gemini rejects it on some models,
 * so those two rely on `trimDegeneratedOutput` alone — neither loops in
 * practice.
 */
function repetitionControls(provider: AiProvider): Record<string, number> {
  // Perplexity documents frequency_penalty and presence_penalty as mutually
  // exclusive; sending both is a 400.
  if (provider.id === "perplexity") return { frequency_penalty: 0.5 }
  return { frequency_penalty: 0.4, presence_penalty: 0.1 }
}

/** OpenAI, OpenAI-compatible vendors, and local Ollama all share this shape. */
async function chatOpenAiCompatible(input: ChatInput): Promise<ChatResult> {
  const isLocal = input.provider.kind === "local"
  let baseUrl = input.provider.baseUrl
  if (isLocal) {
    const safe = localBaseUrl(input.provider)
    if (!safe) {
      return {
        ok: false,
        error:
          "The local model URL is not allowed (must be loopback or a private network).",
      }
    }
    baseUrl = safe
  } else if (!input.apiKey) {
    return { ok: false, error: "Missing API key." }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`
  // OpenRouter likes attribution headers; harmless elsewhere.
  if (input.provider.id === "openrouter") {
    headers["HTTP-Referer"] = "https://globalhoopstats.com"
    headers["X-Title"] = "globalhoopstats"
  }

  const base: Record<string, unknown> = {
    model: input.model,
    messages: [
      { role: "system", content: input.system },
      ...input.messages,
    ],
    max_tokens: input.maxTokens ?? 700,
    temperature: input.temperature ?? 0.6,
    stream: false,
  }

  return withTimeout(async (signal) => {
    const post = (body: Record<string, unknown>) =>
      fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify(body),
      })

    let res = await post({ ...base, ...repetitionControls(input.provider) })
    if (res.status === 400) {
      // A vendor that rejects the penalties (they are optional in the spec and
      // a few models refuse them) must still answer, just without the guard.
      const detail = (await res.clone().text().catch(() => "")).toLowerCase()
      if (detail.includes("penalty")) res = await post(base)
    }
    if (!res.ok) {
      const raw = await res.text().catch(() => "")
      return {
        ok: false,
        status: res.status,
        retryAfterMs: vendorRetryDelayMs(res, raw),
        error: `${input.provider.name} ${res.status}: ${raw.slice(0, 300) || res.statusText}`,
      }
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    // `reasoning_content` / `reasoning` (DeepSeek, OpenRouter, newer Ollama)
    // is deliberately not read: it is the scratch work, and the vendors that
    // split it out have already kept it out of `content`. The ones that do not
    // leave it inline, tagged, and `completion` takes it from there.
    return completion(json.choices?.[0]?.message?.content, input.model)
  }, input.timeoutMs)
}

async function chatAnthropic(input: ChatInput): Promise<ChatResult> {
  if (!input.apiKey) return { ok: false, error: "Missing API key." }
  return withTimeout(async (signal) => {
    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxTokens ?? 700,
      temperature: input.temperature ?? 0.6,
      system: input.system,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }
    if (input.webSearch) {
      // Anthropic server-side web search tool (billed to the user's key).
      body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }]
    }
    const res = await fetch(`${input.provider.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey as string,
        "anthropic-version": "2023-06-01",
      },
      signal,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const raw = await res.text().catch(() => "")
      return {
        ok: false,
        status: res.status,
        retryAfterMs: vendorRetryDelayMs(res, raw),
        error: `Anthropic ${res.status}: ${raw.slice(0, 300) || res.statusText}`,
      }
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    // `thinking` blocks are a separate block type and are dropped by the
    // filter, which is why Anthropic never leaked reasoning here.
    const content = json.content
      ?.filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("")
    return completion(content, input.model)
  }, input.timeoutMs)
}

async function chatGoogle(input: ChatInput): Promise<ChatResult> {
  if (!input.apiKey) return { ok: false, error: "Missing API key." }
  const url = `${input.provider.baseUrl}/models/${encodeURIComponent(
    input.model,
  )}:generateContent?key=${encodeURIComponent(input.apiKey)}`
  return withTimeout(async (signal) => {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: input.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: input.maxTokens ?? 800,
        temperature: input.temperature ?? 0.6,
      },
    }
    if (input.webSearch) {
      // Gemini Google Search grounding (current models use `google_search`).
      body.tools = [{ google_search: {} }]
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const raw = await res.text().catch(() => "")
      return {
        ok: false,
        status: res.status,
        retryAfterMs: vendorRetryDelayMs(res, raw),
        error: `Gemini ${res.status}: ${raw.slice(0, 300) || res.statusText}`,
      }
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> }
      }>
    }
    // Gemini 2.5 and up return their thinking as ordinary text parts flagged
    // `thought: true`. Joining every part, which is what this did, printed the
    // model's deliberation above its answer.
    const content = json.candidates?.[0]?.content?.parts
      ?.filter((p) => p.thought !== true)
      .map((p) => p.text ?? "")
      .join("")
    return completion(content, input.model)
  }, input.timeoutMs)
}

async function dispatch(input: ChatInput): Promise<ChatResult> {
  try {
    switch (input.provider.kind) {
      case "anthropic":
        return await chatAnthropic(input)
      case "google":
        return await chatGoogle(input)
      case "openai":
      case "openai-compat":
      case "local":
        return await chatOpenAiCompatible(input)
      default:
        return { ok: false, error: "Unsupported provider." }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "The model took too long to respond." }
    }
    // Undici does not throw the socket error itself — it throws `TypeError:
    // fetch failed` and hangs the real one off `cause`. Reading only the top
    // level meant a local Ollama that was simply not running reported "fetch
    // failed" to the user, which names nothing they can act on.
    const code =
      (err as NodeJS.ErrnoException)?.code ??
      ((err as { cause?: NodeJS.ErrnoException })?.cause?.code || undefined)
    if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND") {
      return {
        ok: false,
        error:
          "Could not reach the model. If you use Ollama, make sure it is running.",
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown chat error.",
    }
  }
}

/**
 * One completion, waiting out the vendor's throttle rather than reporting it.
 *
 * Nothing here is billed to us: every call runs on the reader's own API key,
 * so the product has no reason to hold an opinion about how often they ask.
 * The only ceiling that exists is their provider's, and the honest answer to
 * it is to do what the provider says — wait the interval it names, then ask
 * again — not to hand a coach "you have hit your usage limit" in the middle of
 * a scouting session. That message was the whole failure: a free Groq key is
 * 6 000 tokens a minute, one advisor question with a shortlist in it is most
 * of that, and the second question of the session got a 429 that a six-second
 * pause would have made go away.
 *
 * The wait is bounded by the CALLER's budget, not by a count of tries. If the
 * vendor asks for longer than there is time to serve an answer in, the error
 * goes through untouched and `describeProviderError` tells the user what it
 * means — because at that point waiting really would be worse than saying so.
 */
export async function chatComplete(input: ChatInput): Promise<ChatResult> {
  return withThrottleRetry<ChatResult>(
    `${input.provider.id}/${input.model}`,
    input.timeoutMs ?? TIMEOUT_MS,
    () => ({ ok: false, error: "The model took too long to respond." }),
    (remaining) => dispatch({ ...input, timeoutMs: remaining }),
  )
}
