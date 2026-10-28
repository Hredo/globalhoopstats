import { NextResponse } from "next/server"
import { getLiveCatalog } from "@/lib/ai/catalog-live"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Newest models per provider, from the public models.dev catalogue.
 *
 * Public data, no auth: the account manager and the setup guide both show it.
 * The upstream download happens at most once per process TTL however often
 * this is hit, and a cold cache answers `pending` instead of holding the
 * request open for a slow 6 MB download.
 */
export async function GET() {
  const catalog = await getLiveCatalog(8_000)
  if (!catalog) {
    return NextResponse.json(
      { ok: false, pending: true },
      { headers: { "Cache-Control": "no-store" } },
    )
  }
  return NextResponse.json(
    { ok: true, ...catalog },
    {
      headers: {
        "Cache-Control":
          "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  )
}
