/**
 * A dependency-free token bucket for the middleware backstop.
 *
 * Deliberately NOT the limiters in `security/ai-advisor.ts`: that module pulls
 * in regex tables and helpers that have no business being loaded on every
 * request, and `security/rate-limit.ts` writes to the database, which is the
 * wrong trade for a blanket ceiling that has to run before the route does.
 *
 * This is a backstop, not a replacement. The purpose-built limits inside
 * routes — login, 2FA, forgot-password, the AI surfaces — are tighter and stay
 * where they are. What this adds is the guarantee that a route added next
 * month cannot ship with NO ceiling at all, which is how a dozen of them
 * ended up unprotected.
 *
 * State is per process. On a single Node server that is exactly right; behind
 * several instances it becomes per-instance, so treat the effective limit as
 * capacity × instances and keep the real enforcement in the routes.
 */

type Bucket = { tokens: number; updated: number }

const BUCKETS = new Map<string, Bucket>()
/** Stop the map growing without bound on a long-lived process. */
const MAX_TRACKED = 20_000

export type EdgeLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

export function edgeRateLimit(
  key: string,
  capacity: number,
  refillPerSec: number,
): EdgeLimitResult {
  const now = Date.now()

  if (BUCKETS.size > MAX_TRACKED) {
    // Cheapest possible eviction: drop everything that has fully refilled and
    // is therefore indistinguishable from a first-time caller.
    for (const [k, b] of BUCKETS) {
      if (b.tokens + ((now - b.updated) / 1000) * refillPerSec >= capacity) {
        BUCKETS.delete(k)
      }
    }
  }

  const bucket = BUCKETS.get(key) ?? { tokens: capacity, updated: now }
  const elapsed = (now - bucket.updated) / 1000
  const refilled = Math.min(capacity, bucket.tokens + elapsed * refillPerSec)

  if (refilled < 1) {
    BUCKETS.set(key, { tokens: refilled, updated: now })
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((1 - refilled) / refillPerSec)),
    }
  }

  BUCKETS.set(key, { tokens: refilled - 1, updated: now })
  return { ok: true }
}

/**
 * How hard to squeeze a given API path.
 *
 * The default is generous on purpose — it is a ceiling against automation, not
 * a quota, and squeezing it would break legitimate use before it stopped
 * anybody. The two tight buckets are the ones where the request itself is the
 * attack: guessing a shared secret, and exporting the whole analytics table.
 */
export function limitFor(pathname: string): { capacity: number; refillPerSec: number } {
  // Secret-guarded endpoints: every request is a guess at CRON_SECRET.
  if (pathname.startsWith("/api/cron/") || pathname.startsWith("/api/revalidate")) {
    return { capacity: 10, refillPerSec: 0.1 }
  }
  // Bulk exports and syncs are expensive whoever asks for them.
  if (
    pathname.startsWith("/api/admin/analytics/export") ||
    pathname.startsWith("/api/admin/sync/run")
  ) {
    return { capacity: 5, refillPerSec: 0.05 }
  }
  if (pathname.startsWith("/api/admin/")) {
    return { capacity: 120, refillPerSec: 2 }
  }
  // A CPU-bound document build per call.
  if (pathname.startsWith("/api/ai-advisor/export-word")) {
    return { capacity: 10, refillPerSec: 0.1 }
  }
  return { capacity: 300, refillPerSec: 5 }
}

/** Methods that change state, and so need an origin they came from. */
export const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"])
