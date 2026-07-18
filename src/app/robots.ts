import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/admin",
          // Auth-gated: middleware redirects these to /login, so crawling them
          // yields nothing but a redirect chain into an unindexable page.
          "/account",
          "/ai-advisor",
          "/market/trade",
          // Credential flows — no search value, and reset links are one-shot.
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/ai-setup",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
