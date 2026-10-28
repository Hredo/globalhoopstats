/**
 * What each provider ships TODAY, read from the public models.dev catalogue.
 *
 * `providers.ts` decides where keys may go; it should not also have to know
 * which model a vendor released last week. models.dev (the open catalogue
 * opencode and the AI Command Center read too) publishes every provider's
 * models with release dates, context and prices, without a key, so the UI can
 * show "newest: …" for a provider the user has not connected yet.
 *
 * Server-only. The file is ~6 MB and slow to download, so it is fetched at
 * most once per TTL per process, shared by concurrent callers, and reduced to
 * a few KB before anything is kept. Nothing here ever decides a base URL or
 * receives a user's key: it is display data only.
 */
import { AI_PROVIDERS, catalogIdFor, type AiProvider } from "@/lib/ai/providers"

export const MODELS_DEV_URL = "https://models.dev/api.json"

const TTL_MS = 12 * 60 * 60 * 1000
const FAILURE_TTL_MS = 30 * 60 * 1000
const FETCH_TIMEOUT_MS = 90_000
/** Newest models listed per provider. */
const LATEST_PER_PROVIDER = 4

export type LiveModel = {
  id: string
  name: string
  /** YYYY-MM-DD or YYYY-MM, as models.dev publishes it. */
  released?: string
  contextTokens?: number
  reasoning?: boolean
  openWeights?: boolean
  /** USD per million tokens. */
  priceIn?: number
  priceOut?: number
}

export type LiveProvider = {
  modelCount: number
  latest: LiveModel[]
}

export type LiveCatalog = {
  fetchedAt: string
  providers: Record<string, LiveProvider>
}

type RawModel = {
  name?: string
  release_date?: string
  status?: string
  reasoning?: boolean
  open_weights?: boolean
  family?: string
  modalities?: { input?: string[]; output?: string[] }
  limit?: { context?: number }
  cost?: { input?: number; output?: number }
}

type RawProvider = { models?: Record<string, RawModel> }

/**
 * Models a chat call could use. The catalogue also lists embedding, speech,
 * OCR, image and moderation models, which would only confuse a coach picking
 * an engine for the advisor.
 */
const NOT_CHAT =
  /embed|rerank|tts|whisper|transcri|speech|ocr|guard|moderation|image|video|audio|voxtral|live-|translate/i

function isChatModel(id: string, m: RawModel): boolean {
  if (m.status === "deprecated") return false
  const out = m.modalities?.output
  if (out && !out.includes("text")) return false
  return !NOT_CHAT.test(id) && !NOT_CHAT.test(m.family ?? "")
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

/** Pure: reduce the raw models.dev document to what the UI shows. */
export function summariseModelsDev(
  raw: unknown,
  providers: AiProvider[] = AI_PROVIDERS,
  now: Date = new Date(),
): LiveCatalog {
  const doc = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    RawProvider
  >
  const out: Record<string, LiveProvider> = {}
  for (const provider of providers) {
    const entry = doc[catalogIdFor(provider)]
    if (!entry?.models || typeof entry.models !== "object") continue
    const chat = Object.entries(entry.models).filter(([id, m]) =>
      isChatModel(id, m ?? {}),
    )
    const latest = chat
      .filter(([, m]) => typeof m.release_date === "string")
      .sort(([, a], [, b]) =>
        (b.release_date ?? "").localeCompare(a.release_date ?? ""),
      )
      .slice(0, LATEST_PER_PROVIDER)
      .map(([id, m]) => ({
        id,
        name: typeof m.name === "string" && m.name ? m.name : id,
        released: m.release_date,
        contextTokens: num(m.limit?.context),
        reasoning: m.reasoning === true,
        openWeights: m.open_weights === true,
        priceIn: num(m.cost?.input),
        priceOut: num(m.cost?.output),
      }))
    out[provider.id] = { modelCount: chat.length, latest }
  }
  return { fetchedAt: now.toISOString(), providers: out }
}

let memo: { value: LiveCatalog | null; expires: number } | null = null
let inflight: Promise<LiveCatalog | null> | null = null

async function download(): Promise<LiveCatalog | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    // no-store: the document is far over Next's 2 MB data-cache limit, and
    // the reduced summary is what we keep anyway.
    const res = await fetch(MODELS_DEV_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (!res.ok) throw new Error(`models.dev ${res.status}`)
    return summariseModelsDev(await res.json())
  } catch (err) {
    console.warn(
      `[ai] live catalogue unavailable: ${err instanceof Error ? err.message : String(err)}`,
    )
    return null
  } finally {
    clearTimeout(timer)
  }
}

function refresh(): Promise<LiveCatalog | null> {
  if (!inflight) {
    inflight = download()
      .then((value) => {
        // A failed refresh keeps the last good copy rather than blanking it.
        const kept = value ?? memo?.value ?? null
        memo = {
          value: kept,
          expires: Date.now() + (value ? TTL_MS : FAILURE_TTL_MS),
        }
        return kept
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * The live catalogue, waiting at most `waitMs` for a cold download. Returns
 * null when nothing is cached yet and the download did not finish in time;
 * the download carries on in the background so the next caller gets it.
 */
export async function getLiveCatalog(waitMs = 0): Promise<LiveCatalog | null> {
  if (memo && memo.expires > Date.now()) return memo.value
  const pending = refresh()
  if (memo?.value) return memo.value // stale-while-revalidate
  if (waitMs <= 0) return null
  return Promise.race([
    pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ])
}

/** Exported for tests: the cache is module state. */
export function resetLiveCatalog(): void {
  memo = null
  inflight = null
}
