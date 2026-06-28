const DEFAULT_TIMEOUT_MS = 15_000

/**
 * Identifiable crawler User-Agent. We deliberately identify ourselves instead
 * of masquerading as a browser: it is good-faith, honest scraping, it lets a
 * data owner (FEB, ACB, leagues…) recognise — and if they ever wish, throttle
 * or contact — our traffic, and it keeps the door open to a future official
 * data agreement instead of looking like evasion. The contact URL resolves to
 * the public crawler-policy page at /bot.
 */
const DEFAULT_USER_AGENT =
  "GlobalHoopStatsBot/1.0 (+https://globalhoopstats.es/bot; data@globalhoopstats.es)"

function botUserAgent(): string {
  return process.env.SCRAPER_USER_AGENT?.trim() || DEFAULT_USER_AGENT
}

/**
 * Per-host politeness. We serialise every request to a given host and keep a
 * minimum gap between them, so we never send a source a burst of parallel
 * traffic — even when two leagues that share a host (EuroLeague + NBA both pull
 * from basketball-reference.com) sync at the same time.
 */
const MIN_HOST_INTERVAL_MS = Number(
  process.env.SCRAPER_MIN_HOST_INTERVAL_MS ?? 1200,
)

const hostChains = new Map<string, Promise<void>>()
const lastHostHit = new Map<string, number>()

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Run `fn` in the per-host queue: it waits its turn behind any in-flight request
 * to the same host, then waits out the remaining politeness interval before
 * firing. Concurrency per host is therefore exactly 1.
 */
async function withHostSlot<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const prev = hostChains.get(host) ?? Promise.resolve()
  const run = prev.then(async () => {
    const since = Date.now() - (lastHostHit.get(host) ?? 0)
    const wait = MIN_HOST_INTERVAL_MS - since
    if (wait > 0) await sleep(wait)
    try {
      return await fn()
    } finally {
      lastHostHit.set(host, Date.now())
    }
  })
  // Keep the chain alive but never let one failure poison the queue for the
  // next caller — swallow the settled result here, the awaited `run` still
  // surfaces the real error/value to the caller.
  hostChains.set(
    host,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
    /** Server-requested wait (from `Retry-After`) before retrying, in ms. */
    public readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = "FetchError"
  }
}

export type FetchInit = {
  method?: string
  body?: string
  headers?: Record<string, string>
  timeoutMs?: number
  retries?: number
  backoffMs?: number
}

/** Parse an HTTP `Retry-After` header (delta-seconds or HTTP-date) into ms. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const secs = Number(value)
  if (Number.isFinite(secs)) return Math.min(Math.max(secs, 0) * 1000, 60_000)
  const date = Date.parse(value)
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 0), 60_000)
  }
  return undefined
}

/**
 * Polite, identifiable HTTP fetch returning the raw response body as text.
 * Applies: honest UA, per-host rate limiting, timeout, bounded retries with
 * backoff, and respect for the server's `Retry-After` on 429/503.
 */
async function politeFetch(url: string, init: FetchInit = {}): Promise<string> {
  const {
    method = "GET",
    body,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 2,
    backoffMs = 500,
  } = init

  const host = hostOf(url)
  const finalHeaders: Record<string, string> = {
    "User-Agent": botUserAgent(),
    Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    ...headers,
  }
  if (
    body &&
    !("Content-Type" in finalHeaders) &&
    !("content-type" in finalHeaders)
  ) {
    finalHeaders["Content-Type"] = "application/x-www-form-urlencoded"
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withHostSlot(host, async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const res = await fetch(url, {
            method,
            body,
            headers: finalHeaders,
            signal: controller.signal,
          })
          if (res.status === 429 || res.status === 503) {
            throw new FetchError(
              `HTTP ${res.status} ${res.statusText}`,
              res.status,
              url,
              parseRetryAfter(res.headers.get("retry-after")),
            )
          }
          if (!res.ok) {
            throw new FetchError(
              `HTTP ${res.status} ${res.statusText}`,
              res.status,
              url,
            )
          }
          return await res.text()
        } finally {
          clearTimeout(timer)
        }
      })
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        const retryAfter =
          err instanceof FetchError ? err.retryAfterMs : undefined
        await sleep(retryAfter ?? backoffMs * (attempt + 1))
      }
    }
  }
  if (lastError instanceof Error) throw lastError
  throw new FetchError(`Unknown error fetching ${url}`)
}

/** Polite fetch returning the response body as text (HTML, etc.). */
export async function fetchText(
  url: string,
  init: FetchInit = {},
): Promise<string> {
  return politeFetch(url, init)
}

/** Polite fetch that parses the response body as JSON. */
export async function fetchJson<T>(
  url: string,
  init: FetchInit = {},
): Promise<T> {
  const text = await politeFetch(url, {
    ...init,
    headers: { Accept: "application/json, text/plain, */*", ...init.headers },
  })
  try {
    return JSON.parse(text) as T
  } catch (parseErr) {
    throw new FetchError(
      `Invalid JSON from ${url}: ${(parseErr as Error).message}`,
      undefined,
      url,
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
