import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const APP = join(process.cwd(), "src", "app")

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "api" ? [] : pages(full)
    return entry.name === "page.tsx" ? [full] : []
  })
}

/** Directories from the app root down to the page's own, inclusive. */
function chain(page: string): string[] {
  const dirs: string[] = []
  for (let dir = dirname(page); dir.startsWith(APP); dir = dirname(dir)) {
    dirs.unshift(dir)
    if (dir === APP) break
  }
  return dirs
}

const throwsNotFound = (file: string) =>
  existsSync(file) && /\bnotFound\(\)/.test(readFileSync(file, "utf8"))

describe("missing pages answer 404", () => {
  // A `loading.tsx` at or above a page streams its skeleton first, and with it
  // the status line: `notFound()` thrown from the page afterwards can only
  // change the body. Every unknown /players/<slug>, /teams/<league>/<slug> and
  // /leagues/<slug> answered 200 that way and Search Console listed them as
  // soft 404s. The 404 has to be decided in a layout above the first boundary.
  const dynamic = pages(APP).filter(
    (page) => page.includes("[") && throwsNotFound(page),
  )

  it("covers the public detail routes", () => {
    const routes = dynamic.map((p) =>
      relative(APP, dirname(p)).split(sep).join("/"),
    )
    expect(routes).toEqual(
      expect.arrayContaining([
        "players/[slug]",
        "teams/[league]/[slug]",
        "leagues/[slug]",
      ]),
    )
  })

  it.each(dynamic.map((p) => [relative(APP, p).split(sep).join("/"), p]))(
    "%s decides not-found before anything streams",
    (_name, page) => {
      const dirs = chain(page)
      const firstBoundary = dirs.findIndex((dir) =>
        existsSync(join(dir, "loading.tsx")),
      )
      if (firstBoundary === -1) return
      // A layout wraps the loading boundary of its own directory.
      const guarded = dirs
        .slice(0, firstBoundary + 1)
        .some((dir) => throwsNotFound(join(dir, "layout.tsx")))
      expect(guarded).toBe(true)
    },
  )
})

const { after, getDb, findPlayerHighlight } = vi.hoisted(() => ({
  after: vi.fn(),
  getDb: vi.fn(),
  findPlayerHighlight: vi.fn(),
}))
vi.mock("next/server", () => ({ after }))
vi.mock("@/lib/db/client", () => ({ getDb, rawRows: vi.fn() }))
vi.mock("@/lib/highlights/search", () => ({ findPlayerHighlight }))

describe("player highlight lookup", () => {
  beforeEach(() => {
    after.mockReset()
    findPlayerHighlight.mockReset()
    // No clip on file for anyone.
    const query = {
      from: () => query,
      where: () => query,
      orderBy: () => query,
      limit: async () => [],
    }
    getDb.mockReturnValue({ select: () => query })
  })

  // The search waits on third parties for up to eight seconds. Run inside the
  // render, it made every profile without a clip take that long to answer.
  it("never searches during the request when there is no clip", async () => {
    const { getPlayerVideo } = await import("@/lib/data/videos")
    const hints = { playerName: "Ana Pérez" }

    expect(await getPlayerVideo("p1", hints)).toBeNull()
    expect(findPlayerHighlight).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledTimes(1)

    // A second view inside the stale window does not queue another search.
    expect(await getPlayerVideo("p1", hints)).toBeNull()
    expect(after).toHaveBeenCalledTimes(1)
  })
})
