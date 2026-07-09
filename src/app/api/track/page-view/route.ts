import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { getEnv, getServerEnv } from "@/lib/env"
import { clientIp } from "@/lib/security/ai-advisor"

// Cap stored values so a malicious client can't bloat the table; the strings
// are bound as parameters below, so they cannot break out of the query.
const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.slice(0, max) : null

/** Reduce a referrer URL to just its host, or "direct" when absent/internal. */
function referrerHost(raw: string | null, selfHost: string | null): string {
  if (!raw) return "direct"
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "")
    if (!host) return "direct"
    if (selfHost && host === selfHost.replace(/^www\./, "")) return "direct"
    return host.slice(0, 120)
  } catch {
    return "direct"
  }
}

/** Coarse device class from the User-Agent — good enough for a share chart. */
function deviceClass(ua: string | null): string {
  if (!ua) return "desktop"
  const s = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "tablet"
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) return "mobile"
  return "desktop"
}

/**
 * Anonymous, irreversible, daily-rotating visitor fingerprint. Same visitor on
 * the same day → same hash (so DISTINCT counts uniques); no way back to the IP.
 */
function visitorHash(ip: string, ua: string, secret: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return createHash("sha256").update(`${secret}:${ip}:${ua}:${day}`).digest("hex").slice(0, 32)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { pageType, pageSlug, leagueSlug, referrer } = body ?? {}

  const pt = str(pageType, 64)
  if (!pt) {
    return NextResponse.json({ error: "pageType is required" }, { status: 400 })
  }

  const headers = request.headers
  const ua = headers.get("user-agent") ?? ""
  const selfHost = (() => {
    try {
      return new URL(getEnv().NEXT_PUBLIC_SITE_URL ?? "http://localhost").hostname
    } catch {
      return null
    }
  })()

  const ref = referrerHost(str(referrer, 500) ?? headers.get("referer"), selfHost)
  const device = deviceClass(ua)
  const country = str(headers.get("cf-ipcountry"), 4)
  const vhash = visitorHash(clientIp(request), ua, getServerEnv().SESSION_SECRET)

  const db = getDb()
  // Parameterised query: values are bound, never string-interpolated, so this
  // is immune to SQL injection regardless of what the client sends.
  try {
    await db.execute(
      sql`INSERT INTO page_views
            (page_type, page_slug, league_slug, referrer, device, country, visitor_hash)
          VALUES
            (${pt}, ${str(pageSlug, 200)}, ${str(leagueSlug, 64)}, ${ref}, ${device}, ${country}, ${vhash})`,
    )
  } catch {
    // The referrer/device/country/visitor_hash columns are added by a migration.
    // If it hasn't run yet, fall back to the original 3-column insert so page
    // tracking never breaks regardless of deploy/migration ordering.
    await db.execute(
      sql`INSERT INTO page_views (page_type, page_slug, league_slug)
          VALUES (${pt}, ${str(pageSlug, 200)}, ${str(leagueSlug, 64)})`,
    )
  }

  return NextResponse.json({ ok: true })
}
