import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  hashPassword,
  isStrongPassword,
} from "@/lib/auth/password"
import { sessions } from "@/lib/db/schema"
import { getServerEnv } from "@/lib/env"
import { clientIp } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"
import { DEFAULT_LOCALE, localeFromCookie } from "@/lib/i18n/config"
import { issueEmailVerification } from "@/lib/auth/email-verification"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(2).max(60),
  website: z.string().max(0).optional(),
})

function adminEmailsSet(): Set<string> {
  const raw = getServerEnv().ADMIN_EMAILS
  if (!raw) return new Set()
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function POST(request: Request) {
  // Rate limit account creation per IP (burst 5, ~1 per 20s) to curb
  // signup spam and slow down email-enumeration probing.
  const limited = await consumeRateLimit(
    `auth:register:${clientIp(request)}`,
    5,
    2 * 60 * 1000,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration data.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { email, password, name } = parsed.data
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }
  if (!isStrongPassword(password)) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 8 characters and include uppercase, lowercase and a digit.",
      },
      { status: 400 },
    )
  }

  const db = getDb()
  const existing = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  if (existing[0]?.emailVerifiedAt) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    )
  }

  const pending = { ok: true, requiresVerification: true, email }

  // Per-address cap so a signup form can't be used to flood someone's inbox
  // with confirmation mails by rotating IPs. Same response either way.
  const perEmail = await consumeRateLimit(
    `auth:register:email:${email}`,
    3,
    15 * 60 * 1000,
  )
  if (!perEmail.ok) {
    return NextResponse.json(pending)
  }

  const passwordHash = await hashPassword(password)
  const regLocale = localeFromCookie(request.headers.get("cookie")) ?? DEFAULT_LOCALE

  let id: string
  if (existing[0]) {
    // An unconfirmed account proves nothing about who owns the address — it
    // may be someone squatting it. Whoever registers again takes it over, and
    // only the mailbox owner can activate it with the new link.
    id = existing[0].id
    await db
      .update(users)
      .set({ passwordHash, name, updatedAt: new Date() })
      .where(eq(users.id, id))
    await db.delete(sessions).where(eq(sessions.userId, id))
  } else {
    const isAdmin = adminEmailsSet().has(email)
    id = crypto.randomUUID()
    await db.insert(users).values({
      id,
      email,
      passwordHash,
      name,
      emailVerifiedAt: null,
      plan: isAdmin ? "pro" : "free",
      role: isAdmin ? "admin" : "user",
      proSince: isAdmin ? new Date() : null,
    })
  }

  // No session until the address is confirmed: the account stays inert, so
  // registering someone else's email gets the registrant nothing.
  const sent = await issueEmailVerification(id, email, regLocale).catch(() => false)
  if (!sent) {
    return NextResponse.json(
      { error: "We couldn't send the confirmation email. Try again in a few minutes." },
      { status: 503 },
    )
  }
  return NextResponse.json(pending)
}
