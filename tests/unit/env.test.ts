import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * Mutate process.env in place (never reassign the whole object, or cached
 * references go stale). NODE_ENV is typed read-only by Next's augmentation, so
 * we cast to a writable record.
 */
function setEnv(key: string, value: string | undefined): void {
  const e = process.env as Record<string, string | undefined>
  if (value === undefined) delete e[key]
  else e[key] = value
}

const KEYS = ["NODE_ENV", "SESSION_SECRET", "DATABASE_URL"] as const
const SAVED = Object.fromEntries(
  KEYS.map((k) => [k, process.env[k]]),
) as Record<(typeof KEYS)[number], string | undefined>

describe("env validation", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    for (const k of KEYS) setEnv(k, SAVED[k])
  })

  it("parses configured server env", async () => {
    const { getServerEnv } = await import("@/lib/env")
    const env = getServerEnv()
    expect(env.DATABASE_URL).toBeTruthy()
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32)
  })

  it("refuses to boot in production with the dev session secret", async () => {
    setEnv("NODE_ENV", "production")
    setEnv("SESSION_SECRET", "dev-only-insecure-session-secret-change-me-please")
    const { getEnv } = await import("@/lib/env")
    expect(() => getEnv()).toThrow(/SESSION_SECRET/)
  })

  it("rejects a too-short session secret", async () => {
    setEnv("NODE_ENV", "production")
    setEnv("SESSION_SECRET", "short")
    const { getEnv } = await import("@/lib/env")
    expect(() => getEnv()).toThrow()
  })

  it("requires DATABASE_URL", async () => {
    setEnv("NODE_ENV", "test")
    setEnv("DATABASE_URL", undefined)
    const { getEnv } = await import("@/lib/env")
    expect(() => getEnv()).toThrow(/DATABASE_URL/)
  })
})
