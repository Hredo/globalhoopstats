import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { buildCsp, newCspNonce } from "@/lib/security/csp"
import {
  edgeRateLimit,
  limitFor,
  STATE_CHANGING,
} from "@/lib/security/edge-rate-limit"

const csp = (over: Partial<Parameters<typeof buildCsp>[0]> = {}) =>
  buildCsp({ nonce: "TESTNONCE", dev: false, strictImages: false, ...over })

/**
 * `'unsafe-inline'` in script-src is the directive that decides how bad an XSS
 * is: with it, an injected script runs and the rest of the policy is
 * decoration. It was there because a static header cannot carry a nonce.
 */
describe("buildCsp", () => {
  it("never allows inline script", () => {
    for (const dev of [true, false]) {
      const policy = csp({ dev })
      const scriptSrc = (policy.match(/script-src[^;]*/) ?? [""])[0]
      expect(scriptSrc, `dev=${dev}`).not.toContain("'unsafe-inline'")
      expect(scriptSrc, `dev=${dev}`).toContain("'nonce-TESTNONCE'")
    }
  })

  it("allows eval only in development", () => {
    expect(csp({ dev: true })).toContain("'unsafe-eval'")
    expect(csp({ dev: false })).not.toContain("'unsafe-eval'")
  })

  it("keeps the directives that make the policy worth having", () => {
    const policy = csp()
    for (const directive of [
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "default-src 'self'",
    ]) {
      expect(policy, directive).toContain(directive)
    }
  })

  it("does not use strict-dynamic, which would kill the Cloudflare beacon", () => {
    // The beacon is injected at the edge with no nonce of ours; under
    // strict-dynamic the host allow-list is ignored and it would be blocked.
    expect(csp()).not.toContain("strict-dynamic")
    expect(csp()).toContain("https://static.cloudflareinsights.com")
  })

  it("drops the blanket https: image source where the model writes the page", () => {
    const imgSrc = (policy: string) => (policy.match(/img-src[^;]*/) ?? [""])[0]
    expect(imgSrc(csp({ strictImages: false }))).toBe("img-src 'self' data: https: blob:")
    // worker-src legitimately carries blob:, so assert on this directive only.
    expect(imgSrc(csp({ strictImages: true }))).toBe("img-src 'self' data: https:")
  })

  it("forces https in production only", () => {
    expect(csp({ dev: false })).toContain("upgrade-insecure-requests")
    expect(csp({ dev: true })).not.toContain("upgrade-insecure-requests")
  })
})

describe("newCspNonce", () => {
  it("is unguessable and never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newCspNonce()))
    expect(seen.size).toBe(500)
    for (const n of seen) expect(n.length).toBeGreaterThanOrEqual(16)
  })
})

describe("edgeRateLimit", () => {
  it("blocks once the bucket is spent and says when to come back", () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(edgeRateLimit(key, 5, 0.1).ok, `request ${i}`).toBe(true)
    }
    const blocked = edgeRateLimit(key, 5, 0.1)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it("keeps buckets separate per key, so one caller cannot lock out another", () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    for (let i = 0; i < 4; i++) edgeRateLimit(a, 3, 0.1)
    expect(edgeRateLimit(a, 3, 0.1).ok).toBe(false)
    expect(edgeRateLimit(b, 3, 0.1).ok).toBe(true)
  })

  it("refills over time rather than locking out permanently", async () => {
    const key = `refill-${Math.random()}`
    expect(edgeRateLimit(key, 1, 1000).ok).toBe(true)
    // Spent. Within the same millisecond no time has passed, so it stays shut.
    expect(edgeRateLimit(key, 1, 1000).ok).toBe(false)
    await new Promise((r) => setTimeout(r, 10))
    expect(edgeRateLimit(key, 1, 1000).ok).toBe(true)
  })
})

describe("limitFor", () => {
  it("squeezes the endpoints where the request IS the attack", () => {
    // Every call to these is a guess at a shared secret.
    expect(limitFor("/api/cron/sync").capacity).toBeLessThanOrEqual(10)
    expect(limitFor("/api/revalidate").capacity).toBeLessThanOrEqual(10)
    // Bulk export and full sync are expensive whoever asks.
    expect(limitFor("/api/admin/analytics/export").capacity).toBeLessThanOrEqual(5)
    expect(limitFor("/api/admin/sync/run").capacity).toBeLessThanOrEqual(5)
    // A document build per call.
    expect(limitFor("/api/ai-advisor/export-word").capacity).toBeLessThanOrEqual(10)
  })

  it("stays generous everywhere else — a ceiling, not a quota", () => {
    expect(limitFor("/api/players/search").capacity).toBeGreaterThanOrEqual(100)
    expect(limitFor("/api/auth/me").capacity).toBeGreaterThanOrEqual(100)
  })

  it("treats the four mutating verbs as state-changing", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(STATE_CHANGING.has(m), m).toBe(true)
    }
    // GET must NOT be here: blocking cross-origin reads would break feeds and
    // embeds, and a GET is not supposed to change anything anyway.
    expect(STATE_CHANGING.has("GET")).toBe(false)
  })
})

/**
 * Structural: the guarantees have to be wired in, not merely available.
 */
describe("the middleware applies the guards", () => {
  const src = readFileSync(join(process.cwd(), "src", "middleware.ts"), "utf8")

  it("stamps a per-request nonce CSP on every response it returns", () => {
    expect(src).toContain("newCspNonce()")
    expect(src).toContain("Content-Security-Policy")
    expect(src).toContain('forwarded.set("x-nonce", nonce)')
    // Every exit path goes through secured(); a bare NextResponse.next() would
    // ship a page with no policy at all.
    expect(src).not.toMatch(/return NextResponse\.next\(\)/)
  })

  it("refuses a state-changing request from a foreign origin", () => {
    expect(src).toContain("STATE_CHANGING.has(request.method)")
    expect(src).toContain("Origin not allowed.")
  })

  it("caps request bodies and rate limits every API path", () => {
    expect(src).toContain("MAX_API_BODY_BYTES")
    expect(src).toContain("edgeRateLimit(")
    expect(src).toContain("429")
  })

  it("reads the right forwarded hop for the caller's address", () => {
    // The left-most XFF entry is written by the client and is worthless.
    expect(src).toContain("hops[hops.length - 1]")
  })
})

describe("the CSP is defined in exactly one place", () => {
  it("is no longer a static header in next.config", () => {
    const config = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8")
    // The file still explains WHY in a comment; what must be gone is the entry.
    expect(config).not.toMatch(/key:\s*"Content-Security-Policy"/)
    // The other headers are static by nature and stay.
    expect(config).toContain("Strict-Transport-Security")
    expect(config).toContain("X-Content-Type-Options")
  })

  it("still nonces the one inline script we write ourselves", () => {
    // Next nonces its own; the no-flash theme script is ours, and without the
    // nonce it is blocked and every visitor gets a white flash.
    const layout = readFileSync(
      join(process.cwd(), "src", "app", "layout.tsx"),
      "utf8",
    )
    expect(layout).toContain('headers()).get("x-nonce")')
    expect(layout).toContain("<script nonce={nonce}")
  })
})
