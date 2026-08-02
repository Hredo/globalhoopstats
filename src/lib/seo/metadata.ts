import type { Metadata } from "next"
import { SITE } from "@/lib/site"

/**
 * Canonical + OpenGraph for a static page.
 *
 * Next merges metadata down the tree, and `alternates` is inherited rather than
 * cleared — so a page that omits its own canonical silently adopts the root
 * layout's `canonical: "/"` and tells Google it is a duplicate of the homepage.
 * That is exactly what /players, /teams, /coaches, /compare and /leagues were
 * doing. Route metadata should always go through here.
 */
export function pageSeo({
  path,
  title,
  description,
  type = "website",
}: {
  /** Route path, leading slash, no trailing slash — e.g. "/players". */
  path: string
  title: string
  description: string
  type?: "website" | "article"
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} · ${SITE.name}`,
      description,
      url: `${SITE.url}${path}`,
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE.name}`,
      description,
    },
  }
}
