/**
 * Server-side locale resolution. Reads the `ghs_locale` cookie first; on a
 * first visit with no cookie it falls back to the browser's `Accept-Language`,
 * then to the default locale. Importing `next/headers` keeps this module
 * server-only (a client import would fail at build time).
 */
import { cookies, headers } from "next/headers"
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  pickFromAcceptLanguage,
  type Locale,
} from "./config"
import { getDictionary, type Messages } from "./dictionaries"
import { translate, type TranslationVars } from "./t"

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value
  if (isLocale(fromCookie)) return fromCookie
  try {
    const headerStore = await headers()
    return pickFromAcceptLanguage(headerStore.get("accept-language"))
  } catch {
    return DEFAULT_LOCALE
  }
}

export type ServerTranslator = {
  locale: Locale
  dict: Messages
  t: (path: string, vars?: TranslationVars) => string
}

export async function getT(): Promise<ServerTranslator> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return {
    locale,
    dict,
    t: (path, vars) => translate(dict, path, vars),
  }
}
