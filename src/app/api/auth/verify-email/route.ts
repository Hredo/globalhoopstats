import { NextResponse } from "next/server"
import { and, eq, gt } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { getEnv } from "@/lib/env"
import { hashVerifyToken } from "@/lib/auth/email-verification"
import { sendWelcomeEmail } from "@/lib/email"
import { DEFAULT_LOCALE, localeFromCookie } from "@/lib/i18n/config"
import { clientIp } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TOKEN_RE = /^[0-9a-f]{64}$/

/**
 * Landing point of the link mailed at signup. It only flips the account to
 * verified and sends the user to /login — it never opens a session, so a mail
 * scanner prefetching the link can't log anyone in. The token stays valid
 * until it expires, which makes a second click (or a prefetch followed by the
 * real click) land on "confirmed" instead of "invalid link".
 */
export async function GET(request: Request) {
  const site = getEnv().NEXT_PUBLIC_SITE_URL
  const to = (state: "ok" | "invalid") =>
    NextResponse.redirect(`${site}/login?verify=${state}`, 303)

  const limited = await consumeRateLimit(
    `auth:verify-email:${clientIp(request)}`,
    20,
    10 * 60 * 1000,
  )
  if (!limited.ok) return to("invalid")

  const token = new URL(request.url).searchParams.get("token") ?? ""
  if (!TOKEN_RE.test(token)) return to("invalid")

  const db = getDb()
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(
      and(
        eq(users.emailVerifyTokenHash, hashVerifyToken(token)),
        gt(users.emailVerifyExpiresAt, new Date()),
      ),
    )
    .limit(1)
  const user = rows[0]
  if (!user) return to("invalid")

  if (!user.emailVerifiedAt) {
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id))
    const locale =
      localeFromCookie(request.headers.get("cookie")) ?? DEFAULT_LOCALE
    await sendWelcomeEmail(user.email, user.name, locale).catch(() => {})
  }
  return to("ok")
}
