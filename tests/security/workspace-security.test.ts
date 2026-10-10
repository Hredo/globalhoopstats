import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { isValidPushEndpoint } from "@/lib/alerts/push"
import { generateApiKey, hashApiKey, readApiKey } from "@/lib/api/keys"
import { isShareToken } from "@/lib/workspace/shares"
import { errorFingerprint, normalizeMessage } from "@/lib/ops/errors"
import { csvRow, UTF8_BOM } from "@/lib/security/csv"
import { limitFor } from "@/lib/security/edge-rate-limit"
import { isSlug, isUuid, str } from "@/lib/workspace/http"

describe("web push endpoints (the server POSTs to them)", () => {
  it("accepts the real push services", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-db5p.notify.windows.com/w/?token=x",
      "https://web.push.apple.com/QGx",
    ]) {
      expect(isValidPushEndpoint(ok), ok).toBe(true)
    }
  })

  it("refuses anything that would make the alerts job a request-forgery relay", () => {
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost:3000/api/admin/sync/run",
      "https://fcm.googleapis.com.evil.example/x",
      "https://evil.example/?fcm.googleapis.com",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "javascript:alert(1)",
      "x".repeat(800),
      42,
    ]) {
      expect(isValidPushEndpoint(bad), String(bad).slice(0, 60)).toBe(false)
    }
  })
})

describe("public API keys", () => {
  it("are random, prefixed and stored only as a hash", () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key).toMatch(/^ghs_[A-Za-z0-9_-]{43}$/)
    expect(a.key).not.toBe(b.key)
    expect(a.hash).toBe(hashApiKey(a.key))
    expect(a.hash).not.toContain(a.key.slice(4))
    expect(a.prefix).toBe(a.key.slice(0, 12))
  })

  it("are read from Authorization: Bearer or X-API-Key, and malformed ones are ignored", () => {
    const { key } = generateApiKey()
    expect(readApiKey(new Headers({ authorization: `Bearer ${key}` }))).toBe(key)
    expect(readApiKey(new Headers({ "x-api-key": key }))).toBe(key)
    expect(readApiKey(new Headers({ authorization: "Bearer nope" }))).toBeNull()
    expect(readApiKey(new Headers({ authorization: `Basic ${key}` }))).toBeNull()
    expect(readApiKey(new Headers())).toBeNull()
  })
})

describe("share tokens", () => {
  it("only accept 32-byte base64url tokens", () => {
    expect(isShareToken("A".repeat(43))).toBe(true)
    expect(isShareToken("A".repeat(42))).toBe(false)
    expect(isShareToken("../../etc/passwd")).toBe(false)
    expect(isShareToken(`${"A".repeat(42)}'`)).toBe(false)
  })
})

describe("input guards", () => {
  it("validate ids, slugs and bounded strings", () => {
    expect(isUuid("0b1f6c1e-5d3a-4e7b-9c2d-1a2b3c4d5e6f")).toBe(true)
    expect(isUuid("1 OR 1=1")).toBe(false)
    expect(isSlug("luka-doncic")).toBe(true)
    expect(isSlug("Luka Doncic")).toBe(false)
    expect(isSlug("a/../b")).toBe(false)
    expect(str("  hi  ", 10)).toBe("hi")
    expect(str("x".repeat(11), 10)).toBeNull()
    expect(str("   ", 10)).toBeNull()
  })
})

describe("error tracking", () => {
  it("groups occurrences that differ only in ids and numbers", () => {
    const a = errorFingerprint("render", "/players/[slug]", "Row 123 for 0b1f6c1e-5d3a-4e7b-9c2d-1a2b3c4d5e6f failed")
    const b = errorFingerprint("render", "/players/[slug]", "Row 9 for 11111111-2222-4333-8444-555555555555 failed")
    expect(a).toBe(b)
    expect(normalizeMessage("first line\nsecond")).toBe("first line")
  })
})

describe("CSV exports", () => {
  it("keep formula neutralisation with the Spanish-Excel separator", () => {
    const row = csvRow(["=HYPERLINK(\"x\")", "Pérez; Juan", 12.5], ";")
    expect(row).toBe(`"'=HYPERLINK(""x"")";"Pérez; Juan";"12.5"\n`)
    expect(UTF8_BOM).toBe("﻿")
  })
})

describe("rate-limit buckets", () => {
  it("squeeze bulk exports and keep the API burst-limited", () => {
    expect(limitFor("/api/export/players").capacity).toBeLessThanOrEqual(6)
    expect(limitFor("/api/shortlists/0b1f6c1e-5d3a-4e7b-9c2d-1a2b3c4d5e6f/export").capacity).toBeLessThanOrEqual(6)
    expect(limitFor("/api/v1/players").capacity).toBe(60)
  })
})

describe("middleware", () => {
  const src = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8")
  it("requires a session for every per-user workspace route", () => {
    for (const p of ["/following", "/shortlists", "/api/follows", "/api/notifications", "/api/push", "/api/shortlists", "/api/shares", "/api/export"]) {
      expect(src, p).toContain(`"${p}"`)
    }
  })
  it("leaves share pages and the key-authenticated API public", () => {
    expect(src).not.toMatch(/"\/s"|"\/s\/"|"\/api\/v1"/)
  })
})
