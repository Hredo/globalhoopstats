import type { Metadata } from "next"
import type { Locale } from "@/lib/i18n/config"
import { SITE } from "@/lib/site"

/** OpenGraph locale tag for a UI locale. */
export function ogLocale(locale: Locale): string {
  return locale === "es" ? "es_ES" : "en_US"
}

/**
 * Canonical + OpenGraph + Twitter for a page.
 *
 * Next merges metadata down the tree, and two parts of that merge bite:
 *
 * - `alternates` is inherited rather than cleared, so a page without its own
 *   canonical used to adopt the root layout's `canonical: "/"` and tell Google
 *   it was a duplicate of the homepage. That is exactly what /players, /teams,
 *   /coaches, /compare and /leagues were doing.
 * - `openGraph` is REPLACED wholesale, not merged, so a page that sets only
 *   `title` keeps the homepage's og:title/og:url — every player page shared as
 *   "globalhoopstats — Hoops, decoded." pointing at the homepage — while a page
 *   that does set `openGraph` loses the layout's site name and locale unless
 *   it repeats them.
 *
 * Route metadata should always go through here.
 */
export function pageSeo({
  path,
  title,
  description,
  locale,
  type = "website",
}: {
  /** Route path, leading slash, no trailing slash — e.g. "/players". */
  path: string
  title: string
  description: string
  locale?: Locale
  type?: "website" | "article" | "profile"
}): Metadata {
  const socialTitle = `${title} · ${SITE.name}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: `${SITE.url}${path}`,
      siteName: SITE.name,
      ...(locale ? { locale: ogLocale(locale) } : {}),
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  }
}
