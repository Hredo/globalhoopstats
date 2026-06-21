import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { getServerEnv } from "@/lib/env"

export const SESSION_COOKIE = "ghs_session"

type TokenPayload = {
  sub: string
  iat: number
  exp: number
}

function getSecret(): string {
  return getServerEnv().SESSION_SECRET
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4)
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad)
  return Buffer.from(norm, "base64")
}

export function newSessionId(): string {
  return randomBytes(32).toString("hex")
}

export function signSessionToken(
  sessionId: string,
  userId: string,
  ttlMs: number,
): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: TokenPayload = {
    sub: userId,
    iat: now,
    exp: now + Math.floor(ttlMs / 1000),
  }
  const header = { alg: "HS256", typ: "JWT" }
  const headerB64 = b64url(Buffer.from(JSON.stringify(header)))
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)))
  const data = `${headerB64}.${payloadB64}`
  const sig = b64url(
    createHmac("sha256", getSecret()).update(data).digest(),
  )
  const composite = `${data}.${sig}.${sessionId}`
  return composite
}

export function verifySessionToken(
  token: string | undefined | null,
): { sessionId: string; userId: string } | null {
  if (!token || typeof token !== "string") return null
  const parts = token.split(".")
  if (parts.length !== 4) return null
  const [headerB64, payloadB64, sig, sessionId] = parts
  if (!headerB64 || !payloadB64 || !sig || !sessionId) return null
  const data = `${headerB64}.${payloadB64}`
  const expected = createHmac("sha256", getSecret())
    .update(data)
    .digest()
  const got = b64urlDecode(sig)
  if (expected.length !== got.length) return null
  if (!timingSafeEqual(expected, got)) return null
  let payload: TokenPayload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf-8")) as TokenPayload
  } catch {
    return null
  }
  if (!payload || typeof payload !== "object") return null
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number")
    return null
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null
  return { sessionId, userId: payload.sub }
}

export function buildSessionCookie(token: string, ttlMs: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
    "HttpOnly",
    "SameSite=Lax",
  ]
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure")
  }
  return parts.join("; ")
}

export function buildClearCookie(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ]
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure")
  }
  return parts.join("; ")
}

export function getSessionTtlMs(): number {
  return getServerEnv().SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(/;\s*/)
  for (const p of pairs) {
    const eq = p.indexOf("=")
    if (eq === -1) continue
    const k = p.slice(0, eq).trim()
    if (k === SESSION_COOKIE) return p.slice(eq + 1)
  }
  return null
}

export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(/;\s*/)
  for (const p of pairs) {
    const eq = p.indexOf("=")
    if (eq === -1) continue
    const k = p.slice(0, eq).trim()
    if (k === name) return p.slice(eq + 1)
  }
  return null
}

export const TRUST_COOKIE = "ghs_trust"

/**
 * Short tag derived from the user's current password hash. Embedding it in the
 * "remember this device" (2FA bypass) token makes the token implicitly
 * revocable: any password change or reset rotates the hash, which invalidates
 * every previously issued trust cookie — no extra DB table required.
 */
function trustBinding(passwordHash: string): string {
  return createHmac("sha256", getSecret())
    .update(`trust-binding|${passwordHash}`)
    .digest("hex")
    .slice(0, 16)
}

export function signTrustToken(userId: string, passwordHash: string): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 30 * 24 * 60 * 60
  const payload = JSON.stringify({
    sub: userId,
    iat: now,
    exp,
    pv: trustBinding(passwordHash),
  })
  const payloadB64 = b64url(Buffer.from(payload))
  const sig = b64url(
    createHmac("sha256", getSecret()).update(payloadB64).digest(),
  )
  return `${payloadB64}.${sig}`
}

export function verifyTrustToken(
  token: string | undefined | null,
  passwordHash: string,
): { userId: string } | null {
  if (!token || typeof token !== "string") return null
  if (!passwordHash) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [payloadB64, sig] = parts
  if (!payloadB64 || !sig) return null
  const expected = createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest()
  const got = b64urlDecode(sig)
  if (expected.length !== got.length) return null
  if (!timingSafeEqual(expected, got)) return null
  let payload: { sub: string; exp: number; pv?: string }
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf-8"))
  } catch {
    return null
  }
  if (!payload || typeof payload.sub !== "string" || typeof payload.exp !== "number")
    return null
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null
  // Reject tokens minted against an older password hash (revocation on reset).
  const expectedBinding = trustBinding(passwordHash)
  if (typeof payload.pv !== "string" || payload.pv.length !== expectedBinding.length)
    return null
  if (!timingSafeEqual(Buffer.from(payload.pv), Buffer.from(expectedBinding)))
    return null
  return { userId: payload.sub }
}

export function buildTrustCookie(token: string): string {
  const parts = [
    `${TRUST_COOKIE}=${token}`,
    "Path=/",
    "Max-Age=" + 30 * 24 * 60 * 60,
    "HttpOnly",
    "SameSite=Lax",
  ]
  if (process.env.NODE_ENV === "production") parts.push("Secure")
  return parts.join("; ")
}
