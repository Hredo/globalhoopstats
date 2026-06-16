/**
 * i18n configuration shared by server and client. No server-only imports here
 * so this module is safe to use anywhere (client components, edge, etc.).
 */

export const LOCALES = ["en", "es"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

/** Cookie that carries the active language. Readable by the client (not HttpOnly). */
export const LOCALE_COOKIE = "ghs_locale"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

/**
 * Pick the best supported locale from an `Accept-Language` header value.
 * Returns the highest-priority tag that maps to a supported language, or the
 * default locale when nothing matches.
 */
export function pickFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";")
      const qParam = params.find((p) => p.trim().startsWith("q="))
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    if (tag === "*") return DEFAULT_LOCALE
    if (tag.startsWith("es")) return "es"
    if (tag.startsWith("en")) return "en"
  }
  return DEFAULT_LOCALE
}

/** Build the `Set-Cookie` value for the locale cookie (1 year, lax). */
export function localeCookie(locale: Locale): string {
  const parts = [
    `${LOCALE_COOKIE}=${locale}`,
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 365}`,
    "SameSite=Lax",
  ]
  if (process.env.NODE_ENV === "production") parts.push("Secure")
  return parts.join("; ")
}
