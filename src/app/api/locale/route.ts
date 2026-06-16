import { NextResponse } from "next/server"
import { getDb } from "@/lib/db/client"
import { userSettings } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth/current-user"
import { isLocale, localeCookie } from "@/lib/i18n/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Set the active language. Always writes the `ghs_locale` cookie (so anonymous
 * visitors are covered) and, when the request is authenticated, mirrors the
 * choice into `user_settings.locale` so it follows the account across devices.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }
  const locale =
    body && typeof body === "object" && "locale" in body
      ? (body as { locale: unknown }).locale
      : null
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale." }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true, locale })
  res.headers.append("Set-Cookie", localeCookie(locale))

  // Best-effort persistence for logged-in users; never block the language
  // switch on a DB hiccup.
  try {
    const user = await getCurrentUser(request.headers.get("cookie"))
    if (user) {
      const db = getDb()
      const now = new Date()
      await db
        .insert(userSettings)
        .values({ userId: user.id, locale, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { locale, updatedAt: now },
        })
    }
  } catch {
    // ignore — the cookie already applied the change
  }

  return res
}
