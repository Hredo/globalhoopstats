import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { invalidateConfigCache } from "@/lib/admin/config"

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const rows = await db.execute(sql.raw(`SELECT key, value, description FROM app_config ORDER BY key`))

  return NextResponse.json(rows as unknown as { key: string; value: string; description: string | null }[])
}

export async function PUT(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { key, value } = body
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 })
  }

  const db = getDb()
  await db.execute(
    sql.raw(`INSERT INTO app_config (key, value, updated_at)
      VALUES ('${key}', '${JSON.stringify(value).replace(/'/g, "''")}', now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`),
  )

  invalidateConfigCache()

  return NextResponse.json({ ok: true })
}
