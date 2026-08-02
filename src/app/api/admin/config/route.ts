import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { invalidateConfigCache } from "@/lib/admin/config"

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  // `key` is a reserved word in MySQL and must be back-quoted.
  const rows = await rawRows<{
    key: string
    value: string
    description: string | null
  }>(
    db.execute(
      sql.raw("SELECT `key`, value, description FROM app_config ORDER BY `key`"),
    ),
  )

  return NextResponse.json(rows)
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

  if (typeof key !== "string" || key.trim() === "") {
    return NextResponse.json({ error: "key must be a string" }, { status: 400 })
  }

  const db = getDb()
  // Parameterised query: even an admin-supplied key can't break out of the SQL.
  await db.execute(
    sql`INSERT INTO app_config (\`key\`, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}, UTC_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = UTC_TIMESTAMP(3)`,
  )

  invalidateConfigCache()

  return NextResponse.json({ ok: true })
}
