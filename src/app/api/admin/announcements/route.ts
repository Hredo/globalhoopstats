import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, asc } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { announcements } from "@/lib/db/schema"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"

const createSchema = z.object({
  type: z.string().default("banner"),
  title: z.string().min(1),
  content: z.string().optional(),
  active: z.boolean().default(true),
  priority: z.number().int().default(0),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const rows = await db
    .select()
    .from(announcements)
    .orderBy(asc(announcements.type), asc(announcements.priority))

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 })
  }

  const db = getDb()
  const [inserted] = await db
    .insert(announcements)
    .values({
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content ?? null,
      active: parsed.data.active,
      priority: parsed.data.priority,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    })
    .returning()

  return NextResponse.json(inserted, { status: 201 })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const db = getDb()
  const allowedFields = ["type", "title", "content", "active", "priority", "startsAt", "expiresAt"]
  const setData: Record<string, unknown> = { updatedAt: new Date() }
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      setData[key] = updates[key] === "startsAt" || key === "expiresAt"
        ? (updates[key] ? new Date(updates[key]) : null)
        : updates[key]
    }
  }

  await db.update(announcements).set(setData).where(eq(announcements.id, id))

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const db = getDb()
  await db.delete(announcements).where(eq(announcements.id, id))

  return NextResponse.json({ ok: true })
}
