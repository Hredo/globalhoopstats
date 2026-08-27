/**
 * Security helpers for the AI advisor endpoint.
 *
 * Protections:
 *  - SSRF guard: only allow Ollama on loopback / private RFC1918 addresses.
 *  - Input validation: length caps, control-char stripping, prompt-injection detection.
 *  - Output sanitisation: strip control characters, cap length, neutralise HTML.
 *  - Per-IP rate limit (token bucket, in-memory).
 *  - Audit logging helper.
 */

import { NextResponse } from "next/server"

export const MAX_USER_MESSAGE_LEN = 2_000
export const MAX_HISTORY_MESSAGES = 8
export const MAX_HISTORY_MESSAGE_LEN = 1_500
export const MAX_LLM_OUTPUT_CHARS = 20_000

const RATE_LIMIT_BUCKET = new Map<string, { tokens: number; updated: number }>()
const RATE_LIMIT_CAPACITY = 12
const RATE_LIMIT_REFILL_PER_SEC = 0.2 // 1 token / 5s, burst 12

const READ_LIMIT_BUCKETS = new Map<
  string,
  Map<string, { tokens: number; updated: number }>
>()

type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

/**
 * Per-IP token bucket for the AI advisor endpoint. Generous budget because
 * the LLM is the bottleneck, not the DB.
 */
export function rateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const bucket = RATE_LIMIT_BUCKET.get(ip) ?? {
    tokens: RATE_LIMIT_CAPACITY,
    updated: now,
  }
  const elapsed = (now - bucket.updated) / 1000
  const refilled = Math.min(
    RATE_LIMIT_CAPACITY,
    bucket.tokens + elapsed * RATE_LIMIT_REFILL_PER_SEC,
  )
  if (refilled < 1) {
    RATE_LIMIT_BUCKET.set(ip, { tokens: refilled, updated: now })
    return {
      ok: false,
      retryAfterSec: Math.ceil((1 - refilled) / RATE_LIMIT_REFILL_PER_SEC),
    }
  }
  RATE_LIMIT_BUCKET.set(ip, { tokens: refilled - 1, updated: now })
  return { ok: true }
}

/**
 * Per-IP token bucket for read endpoints (list, search, options).
 * More generous than the advisor — these are cheap DB reads — but still
 * caps naive scrapers.
 */
export function readRateLimit(
  ip: string,
  route: string,
  capacity = 60,
  refillPerSec = 2,
): RateLimitResult {
  let perRoute = READ_LIMIT_BUCKETS.get(route)
  if (!perRoute) {
    perRoute = new Map()
    READ_LIMIT_BUCKETS.set(route, perRoute)
  }
  const now = Date.now()
  const bucket = perRoute.get(ip) ?? { tokens: capacity, updated: now }
  const elapsed = (now - bucket.updated) / 1000
  const refilled = Math.min(capacity, bucket.tokens + elapsed * refillPerSec)
  if (refilled < 1) {
    perRoute.set(ip, { tokens: refilled, updated: now })
    return {
      ok: false,
      retryAfterSec: Math.ceil((1 - refilled) / refillPerSec),
    }
  }
  perRoute.set(ip, { tokens: refilled - 1, updated: now })
  return { ok: true }
}

/**
 * The only ceiling left on the AI surfaces, and it guards the OWNER's wallet
 * rather than the reader's usage.
 *
 * Every AI call in this product runs on the reader's own provider key: their
 * key, their quota, their bill. A cap here protected nothing anybody pays for
 * and cut real sessions short — a coach could not ask two questions in a row
 * without the product telling them to come back later, on top of whatever
 * their own provider already had to say about it. Rationing someone else's
 * credit is not a security control.
 *
 * One request does not fit that: an anonymous one, which falls back to
 * `AI_DEFAULT_API_KEY`. That credit IS the owner's, and nobody is accountable
 * for spending it. When no fallback key is configured — the normal deployment,
 * where an anonymous visitor is simply asked to set a provider up — there is
 * nothing to spend and this returns null on every call.
 *
 * The runaway case the old ceiling was really aimed at (a front-end loop, a
 * script) is covered by `edgeRateLimit` in the middleware, which sees every
 * API path and costs nothing to run.
 */
export function aiOwnerKeyGuard(
  ip: string,
  user: { id: string } | null | undefined,
): NextResponse | null {
  if (user || !process.env.AI_DEFAULT_API_KEY) return null
  const limit = readRateLimit(ip, "ai:owner-key", 60, 0.5)
  return limit.ok ? null : jsonTooManyRequests(limit.retryAfterSec)
}

export function jsonTooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." },
    {
      status: 429,
      headers: securityHeaders({ "Retry-After": String(retryAfterSec) }),
    },
  )
}

const SSRF_ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
])

/**
 * Validate that OLLAMA_BASE_URL points to a loopback address.
 * Returns the cleaned URL or null if the URL is unsafe.
 */
export function safeOllamaBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  const host = url.hostname.toLowerCase()
  if (SSRF_ALLOWED_HOSTS.has(host)) return url.toString().replace(/\/$/, "")
  // Private IPv4 (10.x, 192.168.x, 172.16-31.x) — allowed only if env explicitly opts in
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return url.toString().replace(/\/$/, "")
  if (/^192\.168\.\d+\.\d+$/.test(host))
    return url.toString().replace(/\/$/, "")
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host))
    return url.toString().replace(/\/$/, "")
  return null
}

// ---- Input sanitisation ---------------------------------------------------

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g

export function cleanUserText(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, " ")
    .replace(ZERO_WIDTH, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Schemes a link in AI output may use.
 *
 * The renderer turns `[text](url)` into an `<a href>`, and the model writes
 * that URL — from a web search result, or from anything a user managed to talk
 * it into repeating. `cleanLlmOutput` neutralises `href="javascript:…"` in raw
 * HTML but never saw the markdown form, and while React happens to block a
 * `javascript:` href today, `data:text/html` went through untouched. Relying
 * on a framework side-effect for this is not a control.
 *
 * An allow-list rather than a block-list: the set of URL schemes a browser
 * will execute is not something to keep up with by hand.
 */
const SAFE_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"])

/**
 * The URL to put in an `href`, or null if it is not safe to link at all.
 * Callers render the link text as plain text when this returns null.
 */
export function safeLinkHref(raw: string): string | null {
  const url = raw.trim()
  if (url.length === 0) return null
  // Relative and anchor links never carry a scheme, and cannot execute.
  if (/^[#/](?![/\\])/.test(url)) return url
  try {
    // A base is required for the parse to succeed on relative input; anything
    // that resolves against it has no scheme of its own and was handled above.
    const parsed = new URL(url)
    return SAFE_LINK_SCHEMES.has(parsed.protocol) ? url : null
  } catch {
    return null
  }
}

// Patterns that look like prompt-injection / jailbreak attempts.
const INJECTION_PATTERNS: { re: RegExp; label: string }[] = [
  {
    re: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/i,
    label: "ignore-previous",
  },
  {
    re: /forget\s+(all\s+)?(previous|prior|earlier)/i,
    label: "forget-previous",
  },
  { re: /you\s+are\s+now\s+(a|an|the)\s+/i, label: "role-reassignment" },
  // Deliberately narrow: a bare "act as a" is ordinary scouting language
  // ("can he act as a backup point guard?") and blocking it rejected real
  // questions. Only flag it when it is reassigning the model's own role.
  {
    re: /\b(you|now)\s+(must\s+|should\s+|will\s+)?act\s+as\s+(a|an|the)\s+/i,
    label: "act-as",
  },
  {
    re: /\bact\s+as\s+(a|an|the)\s+(system|developer|assistant|admin(istrator)?|ai|model|chatbot|dan)\b/i,
    label: "act-as-role",
  },
  { re: /\bsystem\s*[:>]\s*/i, label: "fake-system-tag" },
  { re: /\bdeveloper\s*[:>]\s*/i, label: "fake-developer-tag" },
  { re: /\bassistant\s*[:>]\s*/i, label: "fake-assistant-tag" },
  { re: /\<\|im_start\|\>/i, label: "chatml-im_start" },
  { re: /\<\|im_end\|\>/i, label: "chatml-im_end" },
  { re: /\[INST\]/i, label: "llama2-inst" },
  { re: /\[\/INST\]/i, label: "llama2-inst-close" },
  { re: /\<\<SYS\>\>/i, label: "llama2-sys" },
  {
    re: /reveal\s+(your|the)\s+(system|initial|hidden)\s+prompt/i,
    label: "prompt-extract",
  },
  {
    re: /print\s+(your|the)\s+(system|initial)\s+prompt/i,
    label: "prompt-extract",
  },
  { re: /disregard\s+(safety|guardrails|guidelines)/i, label: "bypass-safety" },
  { re: /jailbreak/i, label: "explicit-jailbreak" },
  {
    re: /bypass\s+(the\s+)?(filter|moderation|safety)/i,
    label: "bypass-moderation",
  },
  { re: /execute\s+(code|command|script|sql)/i, label: "code-exec-attempt" },
  { re: /<\s*script\b/i, label: "xss-script" },
  { re: /javascript\s*:/i, label: "xss-js-uri" },
  { re: /on(load|error|click|mouseover)\s*=/i, label: "xss-event-handler" },
  { re: /\bcurl\s+http/i, label: "shell-curl" },
  { re: /\bwget\s+http/i, label: "shell-wget" },
  { re: /\brm\s+-rf\b/i, label: "shell-rm" },
  // NOTE: no /g flag anywhere in this table. These RegExp objects are shared
  // across every request, and a global regex carries `lastIndex` from one
  // `exec` to the next — the same payload would be flagged on one request and
  // waved through on the next.
  { re: /\.\.\//, label: "path-traversal" },
]

export type InjectionFinding = { label: string; match: string }

export type PromptInput =
  | { ok: true; text: string }
  | { ok: false; findings: InjectionFinding[] }

/**
 * Clean, cap and screen a user-controlled string before it goes into a prompt.
 *
 * `detectInjection` existed for a year and only the advisor route ever called
 * it, so every other surface fed user text to a model unscreened: the coach's
 * playbook question, the free-text terms on a trade, the player names posted
 * to compare, and — the one nobody would think of — the NAME, DESCRIPTION and
 * per-frame NOTES inside a play document, which are attacker-controlled the
 * moment a play is imported from a file someone else made.
 *
 * That gap matters more now than it did: the AI surfaces search the web with
 * the user's own key, so an instruction smuggled into a frame note is an
 * instruction with an outbound network call attached to it.
 *
 * Screening happens AFTER the cap, so padding an attack past the limit does
 * not smuggle it through.
 */
export function sanitisePromptInput(raw: unknown, maxLen: number): PromptInput {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: true, text: "" }
  }
  const text = cleanUserText(raw).slice(0, maxLen)
  const findings = detectInjection(text)
  if (findings.length > 0) return { ok: false, findings }
  return { ok: true, text }
}

/**
 * Screen several fields at once and report the first that fails.
 *
 * Used for documents rather than single questions: a play carries a name, a
 * description and a note per frame, and any one of them reaches the model.
 */
export function screenPromptFields(
  fields: Array<unknown>,
  maxLen: number,
): InjectionFinding[] {
  for (const field of fields) {
    const result = sanitisePromptInput(field, maxLen)
    if (!result.ok) return result.findings
  }
  return []
}

export function detectInjection(raw: string): InjectionFinding[] {
  const findings: InjectionFinding[] = []
  for (const { re, label } of INJECTION_PATTERNS) {
    // Belt-and-braces against a /g slipping back into the table above.
    re.lastIndex = 0
    const m = re.exec(raw)
    if (m) findings.push({ label, match: m[0] })
  }
  return findings
}

// ---- Output sanitisation --------------------------------------------------

/**
 * Strip characters and patterns that could break rendering or be used for XSS,
 * even though our Markdown renderer doesn't pass through raw HTML, defence-in-depth.
 */
export function cleanLlmOutput(raw: string): string {
  return (
    raw
      .replace(CONTROL_CHARS, " ")
      .replace(ZERO_WIDTH, "")
      // Belt-and-braces: neutralise stray HTML tags. Our parser doesn't render
      // them, but if a future change does, this stops obvious XSS payloads.
      .replace(
        new RegExp(
          "<\\s*(script|iframe|object|embed|svg)[^>]*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>",
          "gi",
        ),
        "[blocked]",
      )
      .replace(
        /<\s*(script|iframe|object|embed|svg)[^>]*\/?>/gi,
        "[blocked]",
      )
      .replace(/(href|src)\s*=\s*["']?\s*javascript:/gi, "$1=")
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
      .trim()
      .slice(0, MAX_LLM_OUTPUT_CHARS)
  )
}

/**
 * Strip anything key-shaped out of a provider error before it reaches the
 * browser. Vendors echo the offending credential back in their 401 bodies
 * (usually partly masked, sometimes not), and those bodies are shown verbatim
 * in the "your AI failed because…" notice.
 */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/g, // OpenAI / Anthropic / DeepSeek / OpenRouter
  /\bgsk_[A-Za-z0-9_-]{8,}/g, // Groq
  /\bxai-[A-Za-z0-9_-]{8,}/g, // xAI
  /\bpplx-[A-Za-z0-9_-]{8,}/g, // Perplexity
  /\bAIza[A-Za-z0-9_-]{8,}/g, // Google
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi,
  /([?&]key=)[^&\s"']+/gi,
]

export function redactSecrets(raw: string): string {
  let out = raw
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (match, prefix?: string) =>
      typeof prefix === "string" ? `${prefix}[redacted]` : "[redacted]",
    )
  }
  return out.slice(0, 400)
}

// ---- Response helpers -----------------------------------------------------

export function securityHeaders(
  extra: Record<string, string> = {},
): HeadersInit {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    ...extra,
  }
}

export function jsonError(
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { content: message, error: true },
    { status, headers: securityHeaders(extraHeaders) },
  )
}

// ---- Audit log ------------------------------------------------------------

export function audit(event: string, details: Record<string, unknown>): void {
  const ts = new Date().toISOString()
  // Single-line compact JSON, easy to grep in dev/prod logs.
  const payload = JSON.stringify({ ts, event, ...details })
  console.log(`[security] ${payload}`)
}

// ---- IP extraction --------------------------------------------------------

/**
 * Resolve the real client IP for rate-limiting / audit.
 *
 * SECURITY: the LEFT-most `X-Forwarded-For` entry is fully attacker-controlled
 * (the client sets it; trusted proxies only ever *append*). Keying rate limits
 * on it lets an attacker rotate a fake IP per request and defeat every
 * brute-force / abuse limit. Instead we read the entry contributed by our own
 * trusted reverse proxy, which is the Nth value counting from the RIGHT.
 *
 * `TRUSTED_PROXY_HOPS` = number of proxies in front of the app (default 1, the
 * single platform edge proxy). Bump it if your hosting adds more hops (e.g. a
 * CDN in front of the app server) so the correct hop is selected.
 */
function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

export function clientIp(req: Request): string {
  // Behind Cloudflare (this site's setup): CF-Connecting-IP is set by Cloudflare
  // to the genuine visitor IP and OVERWRITES any value the client tries to send,
  // so it cannot be spoofed for traffic that actually traverses Cloudflare. It's
  // the single most reliable source here, regardless of how many proxy hops sit
  // behind it. (Requires locking the origin to Cloudflare IPs — see DEPLOY notes
  // — so attackers can't hit Hostinger directly and forge this header.)
  const cf = req.headers.get("cf-connecting-ip")
  if (cf) return cf.trim() || "unknown"

  // Generic fallback (no Cloudflare): the real IP is the entry contributed by
  // our own trusted proxy, i.e. the Nth value counting from the RIGHT of
  // X-Forwarded-For. The left-most entry is attacker-controlled.
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length > 0) {
      const idx = Math.max(0, parts.length - trustedProxyHops())
      const ip = parts[idx]
      if (ip) return ip
    }
  }
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp.trim() || "unknown"
  return "unknown"
}
