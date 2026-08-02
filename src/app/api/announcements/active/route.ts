import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"

export const dynamic = "force-dynamic"

export type ActiveAnnouncement = {
  id: string
  title: string
  content: string | null
  priority: number
  createdAt: string
}

/**
 * Public feed of active site notices, polled by the client banner/modal. Only
 * `type = 'banner'` announcements within their (optional) start/expiry window
 * are returned. The client decides banner-vs-modal: a notice with content opens
 * as a centered modal, otherwise it shows as a top banner.
 */
export async function GET() {
  try {
    const db = getDb()
    // Back-quoted alias (MySQL reads "..." as a string literal, not an
    // identifier) and UTC_TIMESTAMP to match how datetimes are stored.
    const rows = await rawRows<ActiveAnnouncement>(
      db.execute(sql`
        SELECT id, title, content, priority, created_at AS \`createdAt\`
        FROM announcements
        WHERE active = true
          AND type = 'banner'
          AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP(3))
          AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))
        ORDER BY priority DESC, created_at DESC
        LIMIT 10
      `),
    )

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json([], { headers: { "Cache-Control": "no-store" } })
  }
}
