import { describe, it, expect } from "vitest"
import {
  SESSION_COOKIE,
  TRUST_COOKIE,
  newSessionId,
  signSessionToken,
  verifySessionToken,
  buildSessionCookie,
  buildClearCookie,
  parseSessionCookie,
  parseCookie,
  signTrustToken,
  verifyTrustToken,
  buildTrustCookie,
} from "@/lib/auth/session"

const DAY = 24 * 60 * 60 * 1000

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const sid = newSessionId()
    const token = signSessionToken(sid, "user-123", 30 * DAY)
    const out = verifySessionToken(token)
    expect(out).not.toBeNull()
    expect(out?.sessionId).toBe(sid)
    expect(out?.userId).toBe("user-123")
  })

  it("newSessionId is 64 hex chars and unique", () => {
    const a = newSessionId()
    const b = newSessionId()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })

  it("rejects a tampered payload (signature mismatch)", () => {
    const token = signSessionToken(newSessionId(), "user-1", 30 * DAY)
    const parts = token.split(".")
    // Flip the payload to claim a different user id.
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: "attacker",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + DAY,
      }),
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
    const forged = [parts[0], forgedPayload, parts[2], parts[3]].join(".")
    expect(verifySessionToken(forged)).toBeNull()
  })

  it("rejects a tampered signature", () => {
    const token = signSessionToken(newSessionId(), "user-1", 30 * DAY)
    const parts = token.split(".")
    parts[2] = parts[2].slice(0, -2) + "xy"
    expect(verifySessionToken(parts.join("."))).toBeNull()
  })

  it("rejects an expired token", () => {
    const token = signSessionToken(newSessionId(), "user-1", -1000)
    expect(verifySessionToken(token)).toBeNull()
  })

  it("rejects malformed input", () => {
    expect(verifySessionToken(null)).toBeNull()
    expect(verifySessionToken(undefined)).toBeNull()
    expect(verifySessionToken("")).toBeNull()
    expect(verifySessionToken("a.b.c")).toBeNull() // wrong part count
    expect(verifySessionToken("a.b.c.d.e")).toBeNull()
  })
})

describe("session cookies", () => {
  it("builds an HttpOnly, SameSite cookie", () => {
    const c = buildSessionCookie("tok", 30 * DAY)
    expect(c).toContain(`${SESSION_COOKIE}=tok`)
    expect(c).toContain("HttpOnly")
    expect(c).toContain("SameSite=Lax")
    expect(c).toContain("Path=/")
    expect(c).toMatch(/Max-Age=\d+/)
  })

  it("clear cookie expires immediately", () => {
    const c = buildClearCookie()
    expect(c).toContain("Max-Age=0")
    expect(c).toContain("HttpOnly")
  })

  it("parses the session cookie out of a header", () => {
    const header = `other=1; ${SESSION_COOKIE}=abc.def.ghi.jkl; foo=bar`
    expect(parseSessionCookie(header)).toBe("abc.def.ghi.jkl")
    expect(parseSessionCookie(null)).toBeNull()
    expect(parseSessionCookie("nothing=here")).toBeNull()
  })

  it("parseCookie reads an arbitrary named cookie", () => {
    const header = `${TRUST_COOKIE}=xyz; a=b`
    expect(parseCookie(header, TRUST_COOKIE)).toBe("xyz")
    expect(parseCookie(header, "missing")).toBeNull()
  })
})

describe("trust (2FA remember-device) tokens", () => {
  const pwHash = "$2b$12$abcdefghijklmnopqrstuv"

  it("round-trips against the same password hash", () => {
    const token = signTrustToken("user-9", pwHash)
    const out = verifyTrustToken(token, pwHash)
    expect(out?.userId).toBe("user-9")
  })

  it("is invalidated when the password hash changes (revocation on reset)", () => {
    const token = signTrustToken("user-9", pwHash)
    expect(verifyTrustToken(token, "$2b$12$DIFFERENThashvalue00000")).toBeNull()
  })

  it("rejects empty / malformed tokens", () => {
    expect(verifyTrustToken(null, pwHash)).toBeNull()
    expect(verifyTrustToken("a.b.c", pwHash)).toBeNull()
    expect(verifyTrustToken("onlyonepart", pwHash)).toBeNull()
  })

  it("rejects a token with a tampered signature", () => {
    const token = signTrustToken("user-9", pwHash)
    const [payload] = token.split(".")
    expect(verifyTrustToken(`${payload}.deadbeef`, pwHash)).toBeNull()
  })

  it("builds an HttpOnly trust cookie", () => {
    const c = buildTrustCookie("tok")
    expect(c).toContain(`${TRUST_COOKIE}=tok`)
    expect(c).toContain("HttpOnly")
    expect(c).toContain("SameSite=Lax")
  })
})
