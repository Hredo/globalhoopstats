import { NextResponse } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { issueEmailVerification } from "@/lib/auth/email-verification"
import { DEFAULT_LOCALE, localeFromCookie } from "@/lib/i18n/config"
import { clientIp } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
})

/** Re-sends the signup confirmation link. Always answers the same way, so it
 *  never reveals whether an address is registered or already confirmed. */
export async function POST(request: Request) {
  const limited = await consumeRateLimit(
    `auth:verify-resend:${clientIp(request)}`,
    5,
    2 * 60 * 1000,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
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
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    )
  }
  const { email } = parsed.data
  const genericOk = NextResponse.json({ ok: true })

  const perEmail = await consumeRateLimit(
    `auth:register:email:${email}`,
    3,
    15 * 60 * 1000,
  )
  if (!perEmail.ok) return genericOk

  const rows = await getDb()
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  const user = rows[0]
  if (user && !user.emailVerifiedAt) {
    const locale =
      localeFromCookie(request.headers.get("cookie")) ?? DEFAULT_LOCALE
    await issueEmailVerification(user.id, email, locale).catch(() => false)
  }
  return genericOk
}
