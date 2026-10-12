import { createHash, randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { getEnv } from "@/lib/env"
import { sendVerifyEmail } from "@/lib/auth/email"
import type { Locale } from "@/lib/i18n/config"

/** How long a signup confirmation link stays valid. */
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000

export function hashVerifyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Mints a fresh confirmation token for the account (replacing any previous
 * one, so only the latest mailed link works) and emails the link. The token
 * itself never touches the database — only its sha256.
 */
export async function issueEmailVerification(
  userId: string,
  email: string,
  locale?: Locale,
): Promise<boolean> {
  const token = randomBytes(32).toString("hex")
  await getDb()
    .update(users)
    .set({
      emailVerifyTokenHash: hashVerifyToken(token),
      emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
  const url = `${getEnv().NEXT_PUBLIC_SITE_URL}/api/auth/verify-email?token=${token}`
  return sendVerifyEmail(email, url, locale)
}
