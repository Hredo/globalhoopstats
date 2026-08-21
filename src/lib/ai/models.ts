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

/** Keep only ids we would be willing to send back out in a chat request. */
function clean(models: AiModel[]): AiModel[] {
  const seen = new Set<string>()
  const out: AiModel[] = []
  for (const m of models) {
    const id = m.id?.trim()
    if (!id || seen.has(id) || !isPlausibleModelId(id)) continue
    seen.add(id)
    out.push({ id, label: m.label?.trim() || id })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
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
