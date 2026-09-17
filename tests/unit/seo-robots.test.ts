import { describe, it, expect } from "vitest"
import robots from "@/app/robots"

function disallowed(): string[] {
  const { rules } = robots()
  const list = Array.isArray(rules) ? rules : [rules]
  return list.flatMap((r) =>
    r.disallow == null ? [] : Array.isArray(r.disallow) ? r.disallow : [r.disallow],
  )
}

describe("robots.txt", () => {
  // Blocking /_next/ hid the CSS, JS and optimised images from Googlebot, so it
  // rendered every page unstyled and without its image previews.
  it("never blocks the assets a crawler needs to render a page", () => {
    for (const path of disallowed()) {
      expect("/_next/static/chunks/app.js".startsWith(path)).toBe(false)
      expect("/_next/image?url=%2Fmedia%2Fx.jpg".startsWith(path)).toBe(false)
    }
  })

  // Private pages keep out of the index with noindex or a redirect to /login.
  // A robots.txt block hides that noindex, and every navbar link to them showed
  // up in Search Console as "Blocked by robots.txt".
  it("does not block pages that keep themselves out with noindex", () => {
    const pages = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/account",
      "/admin",
      "/ai-advisor",
      "/market/trade",
    ]
    for (const page of pages) {
      expect(disallowed().some((path) => page.startsWith(path))).toBe(false)
    }
  })

  it("keeps the JSON API out of the crawl and points at the sitemap", () => {
    expect(disallowed()).toContain("/api/")
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
