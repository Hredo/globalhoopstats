import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { appErrors } from "@/lib/db/schema"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { recentErrors } from "@/lib/ops/errors"
import { lastBackupStatus } from "@/lib/ops/backup"
import { isUuid } from "@/lib/workspace/http"

export const dynamic = "force-dynamic"

/** GET → grouped server errors (newest first) plus the last backup's status. */
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: user ? 403 : 401 })
  const [errors, backup] = await Promise.all([recentErrors(100), lastBackupStatus()])
  return NextResponse.json({ errors, backup })
}

/** DELETE ?id= — resolve (forget) one error group; it reopens if it recurs. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: user ? 403 : 401 })
  const id = new URL(request.url).searchParams.get("id")
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 })
  await getDb().delete(appErrors).where(eq(appErrors.id, id))
  return NextResponse.json({ ok: true })
}
