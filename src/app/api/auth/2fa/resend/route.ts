import { NextResponse } from "next/server"
import { z } from "zod"
import { randomInt } from "node:crypto"
import { eq, and, gt } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { twoFactorSessions, userSettings, users } from "@/lib/db/schema"
import { hashPassword } from "@/lib/auth/password"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { sendTwoFactorCodeEmail } from "@/lib/auth/email"
import { clientIp } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  sessionId: z.string().uuid(),
})

export async function POST(request: Request) {
  const ip = clientIp(request)
  const ipLimit = await consumeRateLimit(`auth:2fa-resend:${ip}`, 3, 2 * 60 * 1000)
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many resend attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } },
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
    return NextResponse.json({ error: "Invalid session data." }, { status: 400 })
  }
  const { sessionId } = parsed.data

  const db = getDb()
  const now = new Date()

  const tfaRows = await db
    .select({
      id: twoFactorSessions.id,
      userId: twoFactorSessions.userId,
      verified: twoFactorSessions.verified,
    })
    .from(twoFactorSessions)
    .where(
      and(
        eq(twoFactorSessions.id, sessionId),
        gt(twoFactorSessions.expiresAt, now),
      ),
    )
    .limit(1)

  if (tfaRows.length === 0) {
    return NextResponse.json(
      { error: "Verification session expired or invalid. Please sign in again." },
      { status: 400 },
    )
  }

  const tfa = tfaRows[0]

  if (tfa.verified) {
    return NextResponse.json(
      { error: "This session has already been verified." },
      { status: 400 },
    )
  }

  const sessionLimit = await consumeRateLimit(
    `auth:2fa-resend-session:${sessionId}`,
    3,
    5 * 60 * 1000,
  )
  if (!sessionLimit.ok) {
    return NextResponse.json(
      { error: "Too many resend requests for this session. Please sign in again." },
      { status: 429 },
    )
  }

  const code = String(randomInt(100000, 999999))
  const codeHash = await hashPassword(code)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await db
    .update(twoFactorSessions)
    .set({
      codeHash,
      expiresAt,
      attempts: 0,
    })
    .where(eq(twoFactorSessions.id, sessionId))

  const userRows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, tfa.userId))
    .limit(1)

  const email = userRows[0]?.email
  if (email) {
    const resendLocaleRows = await db
      .select({ locale: userSettings.locale })
      .from(userSettings)
      .where(eq(userSettings.userId, tfa.userId))
      .limit(1)
    const resendLocale = resendLocaleRows[0]?.locale
    void sendTwoFactorCodeEmail(email, code, isLocale(resendLocale) ? resendLocale : undefined)
  }

  return NextResponse.json({
    ok: true,
    expiresAt: expiresAt.getTime(),
  })
}
