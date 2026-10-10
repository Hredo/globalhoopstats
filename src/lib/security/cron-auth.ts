import { timingSafeEqual } from "node:crypto"

/** Constant-time string compare that never short-circuits on length. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

/**
 * CRON_SECRET from `X-Cron-Secret` or `Authorization: Bearer` (never the query
 * string). Returns "unconfigured" so the caller can answer 500, not 401.
 */
export function checkCronSecret(headers: Headers): "ok" | "unauthorized" | "unconfigured" {
  const expected = process.env.CRON_SECRET
  if (!expected) return "unconfigured"
  const provided = (
    headers.get("x-cron-secret") ??
    (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  ).trim()
  return provided && safeEqual(provided, expected) ? "ok" : "unauthorized"
}
