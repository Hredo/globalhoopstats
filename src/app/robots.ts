import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

/**
 * Only `/api/` is disallowed, and that is deliberate.
 *
 * - `/_next/` holds the CSS, JS and optimised images. Blocking it stopped
 *   Googlebot rendering the pages it was meant to rank — it saw an unstyled
 *   document and could not load the image previews on the homepage.
 * - The private pages (/account, /admin, /ai-advisor, /market/trade, /login,
 *   /register, the password flows) keep themselves out of the index: they
 *   either redirect an anonymous crawler to /login or carry
 *   `robots: noindex`. A robots.txt block HIDES that noindex from Google, so
 *   every navbar link to them was reported as "Blocked by robots.txt" in
 *   Search Console instead of being dropped cleanly.
 *
 * Keep private pages out with `noindex` in their metadata, not with a line here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
