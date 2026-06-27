import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, "..", "..")

/** Recursively collect every .ts file under src/ (no external deps). */
function allSourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        out.push(full)
      }
    }
  }
  walk(resolve(projectRoot, "src"))
  return out
}

/**
 * Matches `sql.raw(` followed by a template literal, capturing the template
 * body so we can assert it contains no `${...}` interpolation. Interpolating
 * user/runtime values into sql.raw is the exact pattern that caused the SQL
 * injection bugs we fixed in the track/* and admin/config routes.
 */
const SQL_RAW_TEMPLATE = /sql\.raw\(\s*`([\s\S]*?)`/g

describe("SQL injection regression guard", () => {
  it("no sql.raw() call interpolates a value via template literals", () => {
    const files = allSourceFiles()
    expect(files.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, "utf8")
      let m: RegExpExecArray | null
      SQL_RAW_TEMPLATE.lastIndex = 0
      while ((m = SQL_RAW_TEMPLATE.exec(src)) !== null) {
        const body = m[1]
        if (body.includes("${")) {
          offenders.push(file.replace(projectRoot, "").replace(/\\/g, "/"))
        }
      }
    }

    expect(
      offenders,
      `sql.raw() with \${} interpolation found in:\n${offenders.join("\n")}`,
    ).toEqual([])
  })

  it("the previously-vulnerable track routes no longer use sql.raw at all", () => {
    for (const rel of [
      "src/app/api/track/page-view/route.ts",
      "src/app/api/track/search/route.ts",
    ]) {
      const src = readFileSync(resolve(projectRoot, rel), "utf8")
      expect(src.includes("sql.raw("), `${rel} still uses sql.raw`).toBe(false)
      expect(/sql`/.test(src), `${rel} should use parameterised sql\`\``).toBe(true)
    }
  })

  it("admin/config writes use the parameterised sql`` form (INSERT not via sql.raw)", () => {
    const src = readFileSync(
      resolve(projectRoot, "src/app/api/admin/config/route.ts"),
      "utf8",
    )
    // The write path must bind values via the tagged template.
    expect(/sql`[\s\S]*INSERT INTO app_config/i.test(src)).toBe(true)
    // Any remaining sql.raw (e.g. the static SELECT in GET) must not interpolate.
    SQL_RAW_TEMPLATE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = SQL_RAW_TEMPLATE.exec(src)) !== null) {
      expect(m[1].includes("${")).toBe(false)
    }
  })
})
