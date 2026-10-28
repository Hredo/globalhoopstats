import { describe, it, expect } from "vitest"
import robots from "@/app/robots"
import { AI_CRAWLERS } from "@/lib/site"

function disallowed(): string[] {
  const { rules } = robots()
  const list = Array.isArray(rules) ? rules : [rules]
  return list.flatMap((r) =>
    r.disallow == null
      ? []
      : Array.isArray(r.disallow)
        ? r.disallow
        : [r.disallow],
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

  // A named group replaces `*` for that bot, so the AI group must carry the
  // same rules — otherwise naming a crawler would quietly open /api/ to it.
  it("names the AI crawlers with the same rules as everyone else", () => {
    const { rules } = robots()
    const list = Array.isArray(rules) ? rules : [rules]
    const ai = list.find(
      (r) => Array.isArray(r.userAgent) && r.userAgent.includes("GPTBot"),
    )
    expect(ai).toBeDefined()
    for (const bot of [
      "OAI-SearchBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
    ]) {
      expect(ai!.userAgent).toContain(bot)
    }
    expect(ai!.allow).toBe("/")
    expect(ai!.disallow).toEqual(["/api/"])
    expect(new Set(AI_CRAWLERS).size).toBe(AI_CRAWLERS.length)
  })

  it("leaves the files written for agents crawlable", () => {
    for (const page of ["/llms.txt", "/llms-full.txt", "/openapi.json"]) {
      expect(disallowed().some((path) => page.startsWith(path))).toBe(false)
    }
  })
})
