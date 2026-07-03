import { NextResponse } from "next/server"
import { z } from "zod"
import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { DEFAULT_LOCALE, localeFromCookie } from "@/lib/i18n/config"
import { sendWaitlistEmails } from "@/lib/email"
import { clientIp } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const Body = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(254)
    .email("Please enter a valid email address."),
  source: z.string().trim().max(64).optional(),
  hp: z.string().max(0).optional(),
})

export async function POST(req: Request) {
  const limited = await consumeRateLimit(
    `waitlist:${clientIp(req)}`,
    5,
    10 * 60 * 1000,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    )
  }

  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      {
        ok: false,
        error: issue?.message ?? "Invalid input.",
        field: issue?.path?.[0] ?? null,
      },
      { status: 400 },
    )
  }

  if (parsed.data.hp) {
    return NextResponse.json({ ok: true, dedup: true }, { status: 200 })
  }

  const { email, source } = parsed.data
  const db = getDb()

  let inserted = false
  let duplicate = false
  try {
    const res = await db.execute(sql`
      insert into waitlist_entries (email, created_at, source)
      values (${email}, ${Math.floor(Date.now() / 1000)}, ${source ?? null})
      on conflict (email) do nothing
    `)
    const rawRes = res as unknown as { count: number }
    const rowCount = rawRes.count ?? 0
    inserted = rowCount > 0
    duplicate = !inserted
  } catch (err) {
    console.error("[waitlist] db insert failed", err)
    return NextResponse.json(
      { ok: false, error: "Could not save your email. Please try again." },
      { status: 500 },
    )
  }

  // Only email on genuinely new signups (avoid re-welcoming duplicates).
  if (inserted) {
    const waitlistLocale = localeFromCookie(req.headers.get("cookie")) ?? DEFAULT_LOCALE
    await sendWaitlistEmails({ email, source }, waitlistLocale).catch(() => {})
  }

  return NextResponse.json({ ok: true, dedup: duplicate })
}
