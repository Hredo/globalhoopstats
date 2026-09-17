/**
 * i18n configuration shared by server and client. No server-only imports here
 * so this module is safe to use anywhere (client components, edge, etc.).
 */

export const LOCALES = ["en", "es"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

/**
 * Language served to a request that states none — no cookie and no
 * `Accept-Language`. Every browser sends that header, so in practice this is
 * the locale search-engine crawlers see: Googlebot sends neither, and it is
 * what gets indexed. One URL serves both languages, so only one of them can be
 * in Google, and on a `.es` domain whose audience searches in Spanish
 * ("estadísticas Primera FEB") that one is Spanish. Visitors are unaffected:
 * an English browser still gets English, and so does any unsupported language
 * (DEFAULT_LOCALE).
 */
export const CRAWLER_LOCALE: Locale = "es"

/** Cookie that carries the active language. Readable by the client (not HttpOnly). */
export const LOCALE_COOKIE = "ghs_locale"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

/**
 * Pick the best supported locale from an `Accept-Language` header value.
 * Returns the highest-priority tag that maps to a supported language, the
 * default locale when nothing matches, and CRAWLER_LOCALE when there is no
 * header at all.
 */
export function pickFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header?.trim()) return CRAWLER_LOCALE
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

/** Parse the locale from a raw Cookie header string. Returns null if absent/invalid. */
export function localeFromCookie(cookie: string | null | undefined): Locale | null {
  if (!cookie) return null
  const m = cookie.match(new RegExp(`(?:^|;)\\s*${LOCALE_COOKIE}\\s*=\\s*([^;]+)`))
  return m && isLocale(m[1]) ? (m[1] as Locale) : null
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
