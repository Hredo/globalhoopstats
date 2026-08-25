import { NextResponse, type NextRequest } from "next/server"
import {
  parseSessionCookie,
  verifySessionToken,
} from "@/lib/auth/session"
import { SITE } from "@/lib/site"
import { buildCsp, newCspNonce } from "@/lib/security/csp"
import {
  edgeRateLimit,
  limitFor,
  STATE_CHANGING,
} from "@/lib/security/edge-rate-limit"

export const config = {
  // Everything except static assets. It used to list only the protected
  // prefixes, which was enough for the auth guard but meant the CSP had to be
  // a static header — and a static header cannot carry a per-request nonce.
  // Widening it is what lets `'unsafe-inline'` come out of script-src.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|woff2?|ttf)$).*)",
  ],
  runtime: "nodejs",
}

const PROTECTED_PREFIXES = [
  "/ai-advisor",
  "/account",
  "/market/trade",
  "/api/ai-advisor",
  "/api/conversations",
  "/api/compare/ai",
  "/api/account",
  "/api/admin",
  "/api/market",
  "/admin",
]

const API_PREFIXES = [
  "/api/",
]

const ALLOWED_ORIGINS: string[] = (() => {
  const origins = [SITE.url]
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000")
  }
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL
  if (envOrigin && !origins.includes(envOrigin)) {
    origins.push(envOrigin)
  }
  return origins
})()

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

function isApiRoute(pathname: string): boolean {
  return API_PREFIXES.some((p) => pathname.startsWith(p))
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true
  return ALLOWED_ORIGINS.some(
    (allowed) =>
      origin === allowed ||
      origin === allowed.replace(/\/$/, ""),
  )
}

/**
 * The caller's address, trusting only the hop our own proxy sets.
 *
 * Mirrors `clientIp` in security/ai-advisor.ts, reimplemented here rather than
 * imported so the middleware does not pull that whole module — and with the
 * same rule: take the RIGHT-most forwarded hop, because everything to its left
 * is written by the client.
 */
function callerIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip")
  if (cf) return cf.trim()
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }
  return request.headers.get("x-real-ip")?.trim() ?? "unknown"
}

/** Bodies larger than this are refused before a route ever parses them. */
const MAX_API_BODY_BYTES = 256 * 1024

/**
 * Every response this middleware returns carries the nonce-based CSP, and the
 * nonce travels to the render through a request header so Next can stamp it
 * onto its own inline scripts.
 */
function secured(response: NextResponse, nonce: string, pathname: string): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    buildCsp({
      nonce,
      dev: process.env.NODE_ENV !== "production",
      // The advisor renders model-written content.
      strictImages: pathname.startsWith("/ai-advisor"),
    }),
  )
  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get("origin")
  const nonce = newCspNonce()

  // Forwarded to the server render; Next reads it to nonce its own scripts.
  const forwarded = new Headers(request.headers)
  forwarded.set("x-nonce", nonce)
  const pass = () =>
    NextResponse.next({ request: { headers: forwarded } })

  // ── CORS ──────────────────────────────────────────────
  const corsHeaders: Record<string, string> = {}

  if (origin && isApiRoute(pathname)) {
    if (isOriginAllowed(origin)) {
      corsHeaders["Access-Control-Allow-Origin"] = origin
      corsHeaders["Access-Control-Allow-Methods"] =
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      corsHeaders["Access-Control-Allow-Headers"] =
        "Content-Type, Authorization, Cookie"
      corsHeaders["Access-Control-Allow-Credentials"] = "true"
      corsHeaders["Access-Control-Max-Age"] = "86400"
    } else {
      corsHeaders["Access-Control-Allow-Origin"] = "null"
    }
  }

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS" && origin && isApiRoute(pathname)) {
    if (isOriginAllowed(origin)) {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      })
    }
    return new NextResponse(null, { status: 204 })
  }

  // ── Blanket API guards ────────────────────────────────
  // These are the floor under every route, present and future. A route that
  // needs a tighter limit still declares its own; what this stops is a route
  // shipping with none, which is how a dozen of them ended up unprotected.
  if (isApiRoute(pathname)) {
    // A state-changing request from a foreign origin is refused outright, not
    // merely denied a CORS header: the CORS header only stops the attacker
    // READING the response, while the write had already happened. SameSite=Lax
    // on the session cookie covers this in a browser; this covers it here.
    if (STATE_CHANGING.has(request.method) && !isOriginAllowed(origin)) {
      return NextResponse.json(
        { error: "Origin not allowed." },
        { status: 403 },
      )
    }

    const declared = Number(request.headers.get("content-length") ?? 0)
    if (Number.isFinite(declared) && declared > MAX_API_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large." }, { status: 413 })
    }

    const { capacity, refillPerSec } = limitFor(pathname)
    const limited = edgeRateLimit(
      `${callerIp(request)}:${pathname.split("/").slice(0, 4).join("/")}`,
      capacity,
      refillPerSec,
    )
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      )
    }
  }

  // ── Auth guard ────────────────────────────────────────
  if (!isProtected(pathname)) {
    const response = pass()
    for (const [key, value] of Object.entries(corsHeaders)) {
      if (value) response.headers.set(key, value)
    }
    return secured(response, nonce, pathname)
  }

  const cookieHeader = request.headers.get("cookie")
  const token = parseSessionCookie(cookieHeader)
  const verified = token ? verifySessionToken(token) : null

  if (!verified) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: corsHeaders },
      )
    }
    const url = request.nextUrl.clone()
    const next = pathname + (request.nextUrl.search ?? "")
    url.pathname = "/login"
    url.search = `?next=${encodeURIComponent(next)}`
    return secured(NextResponse.redirect(url), nonce, pathname)
  }

  const response = pass()
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (value) response.headers.set(key, value)
  }
  return secured(response, nonce, pathname)
}
