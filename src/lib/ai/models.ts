/**
 * Ask a provider which models it will actually serve for the caller's key.
 *
 * The static `models` array in `providers.ts` is a hand-maintained guess, and a
 * guess goes stale: vendors retire and rename models constantly, and a stale id
 * produces a 404 `model_not_found` at answer time — the failure that looked
 * like "the AI stopped working". Every provider we support exposes a models
 * endpoint, so the catalogue should be the fallback, not the source of truth.
 *
 * Cloud base URLs come from the static catalogue (never user input). The only
 * user-controllable destination is the local Ollama URL, SSRF-guarded via
 * safeOllamaBaseUrl — same rule as the chat dispatcher.
 */
import type { AiModel, AiProvider } from "@/lib/ai/providers"
import { isPlausibleModelId } from "@/lib/ai/providers"
import { pickBestModel, rankModels } from "@/lib/ai/model-ranking"
import { safeOllamaBaseUrl } from "@/lib/security/ai-advisor"

const TIMEOUT_MS = 15_000

export type ModelListResult =
  | { ok: true; models: AiModel[] }
  | { ok: false; error: string; status?: number }

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Keep only ids we would be willing to send back out in a chat request, and
 * put the newest first.
 *
 * This used to sort alphabetically, which is how a picker offered
 * `gpt-3.5-turbo` above `gpt-5` and listed embedding and image models a chat
 * call would have 400'd on. `rankModels` drops those and orders by version.
 */
function clean(models: AiModel[]): AiModel[] {
  const seen = new Set<string>()
  const out: AiModel[] = []
  for (const m of models) {
    const id = m.id?.trim()
    if (!id || seen.has(id) || !isPlausibleModelId(id)) continue
    seen.add(id)
    out.push({ id, label: m.label?.trim() || id })
  }
  return rankModels(out)
}

async function failure(res: Response, name: string): Promise<ModelListResult> {
  const detail = (await res.text().catch(() => "")).slice(0, 200)
  return {
    ok: false,
    status: res.status,
    error: `${name} ${res.status}: ${detail || res.statusText}`,
  }
}

/** OpenAI, every OpenAI-compatible vendor, and Ollama's /v1 shim. */
async function listOpenAiCompatible(
  provider: AiProvider,
  apiKey: string | null,
  baseUrl: string,
): Promise<ModelListResult> {
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return withTimeout(async (signal) => {
    const res = await fetch(`${baseUrl}/models`, { headers, signal })
    if (!res.ok) return failure(res, provider.name)
    const json = (await res.json()) as {
      data?: Array<{ id?: string; display_name?: string }>
    }
    return {
      ok: true,
      models: clean(
        (json.data ?? []).map((m) => ({
          id: m.id ?? "",
          label: m.display_name ?? m.id ?? "",
        })),
      ),
    }
  })
}

async function listAnthropic(
  provider: AiProvider,
  apiKey: string,
): Promise<ModelListResult> {
  return withTimeout(async (signal) => {
    const res = await fetch(`${provider.baseUrl}/v1/models?limit=100`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal,
    })
    if (!res.ok) return failure(res, provider.name)
    const json = (await res.json()) as {
      data?: Array<{ id?: string; display_name?: string }>
    }
    return {
      ok: true,
      models: clean(
        (json.data ?? []).map((m) => ({
          id: m.id ?? "",
          label: m.display_name ?? m.id ?? "",
        })),
      ),
    }
  })
}

async function listGoogle(
  provider: AiProvider,
  apiKey: string,
): Promise<ModelListResult> {
  return withTimeout(async (signal) => {
    const res = await fetch(
      `${provider.baseUrl}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
      { signal },
    )
    if (!res.ok) return failure(res, provider.name)
    const json = (await res.json()) as {
      models?: Array<{
        name?: string
        displayName?: string
        supportedGenerationMethods?: string[]
      }>
    }
    const models = (json.models ?? [])
      // Only models we can actually drive; the list also carries embedding
      // and TTS models that would 400 on generateContent.
      .filter((m) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"),
      )
      .map((m) => ({
        // The API returns "models/gemini-x"; the chat call wants "gemini-x".
        id: (m.name ?? "").replace(/^models\//, ""),
        label: m.displayName ?? (m.name ?? "").replace(/^models\//, ""),
      }))
    return { ok: true, models: clean(models) }
  })
}

/**
 * List the models `provider` will serve. `apiKey` may be null only for local
 * engines. Never throws — transport failures come back as `ok: false`.
 */
export async function listProviderModels(
  provider: AiProvider,
  apiKey: string | null,
): Promise<ModelListResult> {
  try {
    if (provider.kind === "local") {
      const safe = safeOllamaBaseUrl(
        process.env.OLLAMA_BASE_URL ?? provider.baseUrl,
      )
      if (!safe) {
        return {
          ok: false,
          error:
            "The local model URL is not allowed (must be loopback or a private network).",
        }
      }
      return await listOpenAiCompatible(provider, null, safe)
    }
    if (!apiKey) return { ok: false, error: "Missing API key." }
    if (provider.kind === "anthropic") return await listAnthropic(provider, apiKey)
    if (provider.kind === "google") return await listGoogle(provider, apiKey)
    return await listOpenAiCompatible(provider, apiKey, provider.baseUrl)
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "The provider took too long to answer." }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not list models.",
    }
  }
}

/**
 * The model to use when the user has NOT pinned one.
 *
 * `provider.defaultModel` is a hand-written literal, and a literal goes stale:
 * it has broken the AI twice, once on Ollama and once on Groq, with a 404
 * `model_not_found` that looked to the user like "the AI stopped working". So
 * the live list decides, and the catalogue is only the fallback of last resort.
 *
 * Cached per provider+key, because this sits in the path of every single
 * advisor request and a models round-trip per answer is not acceptable. A
 * short TTL is enough — a vendor shipping a new flagship is a daily event at
 * worst, not a per-request one.
 */
const BEST_MODEL_TTL_MS = 6 * 60 * 60 * 1000
const bestModelCache = new Map<string, { id: string; expires: number }>()

function cacheKey(provider: AiProvider, apiKey: string | null): string {
  // Never the key itself: this map outlives the request and is read by id.
  const fingerprint = apiKey ? apiKey.slice(-6) : "local"
  return `${provider.id}:${fingerprint}`
}

export async function resolveBestModel(
  provider: AiProvider,
  apiKey: string | null,
): Promise<string> {
  const key = cacheKey(provider, apiKey)
  const hit = bestModelCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.id

  const listed = await listProviderModels(provider, apiKey)
  const best = listed.ok ? pickBestModel(listed.models) : null
  const chosen = best ?? provider.defaultModel
  bestModelCache.set(key, {
    id: chosen,
    // A failed lookup is cached briefly too, so a provider that is down does
    // not get hammered once per answer.
    expires: Date.now() + (best ? BEST_MODEL_TTL_MS : 5 * 60 * 1000),
  })
  return chosen
}

/** Exported for tests: the cache is module state and would leak between them. */
export function clearBestModelCache(): void {
  bestModelCache.clear()
}
