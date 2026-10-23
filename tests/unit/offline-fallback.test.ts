import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { GET } from "@/app/serwist/[path]/route"

const publicFile = (name: string) =>
  readFileSync(join(process.cwd(), "public", name), "utf8")

describe("offline fallback", () => {
  it("the service worker precaches the offline page and serves it only on failed navigations", async () => {
    const res = await GET(new Request("http://x/serwist/sw.js"), {
      params: Promise.resolve({ path: "sw.js" }),
    })
    const sw = await res.text()
    expect(res.status).toBe(200)
    expect(sw).toContain('"/offline.html"')
    expect(sw).toContain('"/hoop-game.js"')
    expect(sw).toContain('req.mode === "navigate"')
    expect(sw).toMatch(/fetch\(req\)\.catch\(/)
  })

  it("the offline page runs under the nonce CSP: no inline scripts or handlers", () => {
    const html = publicFile("offline.html")
    expect(html).toContain('<script src="/hoop-game.js"></script>')
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/)
    expect(html).not.toMatch(/\son[a-z]+=/i)
  })
})
