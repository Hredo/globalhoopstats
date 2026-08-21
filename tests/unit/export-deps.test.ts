import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Two blind spots this file covers.
 *
 * 1. The PDF and Word exports are the only place `docx` and `jspdf` actually
 *    execute. Nothing else in the suite imports them, so a breaking major bump
 *    would ship unnoticed.
 * 2. `nanoid` and `dompurify` reach us only transitively (docx / postcss and
 *    jspdf respectively) and are pinned by `overrides` in pnpm-workspace.yaml.
 *    An override is easy to drop by accident when regenerating the lockfile,
 *    which would silently reintroduce the advisories it was added for — so the
 *    resolved versions are asserted against the patched floors.
 */

const LOCKFILE = readFileSync(join(process.cwd(), "pnpm-lock.yaml"), "utf8")

/** Every version of `name` the lockfile actually resolves to. */
function resolvedVersions(name: string): string[] {
  const re = new RegExp(`^  ${name}@(\\d+\\.\\d+\\.\\d+[^:(]*):`, "gm")
  return [...LOCKFILE.matchAll(re)].map((m) => m[1])
}

function atLeast(version: string, floor: string): boolean {
  const a = version.split(".").map(Number)
  const b = floor.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return true
}

describe("patched transitive dependencies stay patched", () => {
  it("resolves nanoid to a patched release on every major in the tree", () => {
    // CVE-2026-67213 (custom generators loop when size is 0) and
    // CVE-2026-67214 (non-secure generators loop on negative size).
    const versions = resolvedVersions("nanoid")
    expect(versions.length).toBeGreaterThan(0)
    for (const v of versions) {
      const floor = v.startsWith("3.") ? "3.3.18" : "5.1.16"
      expect(atLeast(v, floor), `nanoid ${v} is below ${floor}`).toBe(true)
    }
  })

  it("resolves dompurify above the IN_PLACE hook XSS fix", () => {
    // GHSA-55q2-fjhq-7xh7: a detached subtree stayed executable. This one
    // ships to the browser via the PDF export, so it is the one that bites.
    const versions = resolvedVersions("dompurify")
    expect(versions.length).toBeGreaterThan(0)
    for (const v of versions) {
      expect(atLeast(v, "3.4.13"), `dompurify ${v} is below 3.4.13`).toBe(true)
    }
  })

  it("resolves undici above the cache-directive disclosure fixes", () => {
    const versions = resolvedVersions("undici")
    for (const v of versions) {
      expect(atLeast(v, "7.29.0"), `undici ${v} is below 7.29.0`).toBe(true)
    }
  })

  it("resolves brace-expansion above the CVE-2026-69152 bypass fix", () => {
    // Patched at 1.1.18 on the 1.x line and 5.0.9 on the 4/5.x line. GitHub's
    // dashboard reports "upgrade to 5.0.8" against a 1.1.18 install; that is
    // the highest patched release overall, not a required major jump.
    const versions = resolvedVersions("brace-expansion")
    expect(versions.length).toBeGreaterThan(0)
    for (const v of versions) {
      const floor = v.startsWith("1.") ? "1.1.18" : "5.0.9"
      expect(atLeast(v, floor), `brace-expansion ${v} is below ${floor}`).toBe(
        true,
      )
    }
  })
})

describe("Word export dependency (docx)", () => {
  it("packs a document with text and a table into a valid .docx", async () => {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } =
      await import("docx")
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Scouting report", bold: true })],
            }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("Player")] }),
                    new TableCell({ children: [new Paragraph("Value")] }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    })
    const buf = await Packer.toBuffer(doc)
    expect(buf.length).toBeGreaterThan(1000)
    // .docx is a zip: "PK" magic bytes.
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
  })
})

describe("PDF export dependency (jspdf)", () => {
  it("builds a PDF document", async () => {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF()
    doc.text("Scouting report", 10, 10)
    const bytes = new Uint8Array(doc.output("arraybuffer"))
    expect(bytes.length).toBeGreaterThan(500)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF")
  })

  it("still drives jspdf-autotable", async () => {
    const { jsPDF } = await import("jspdf")
    const autoTable = (await import("jspdf-autotable")).default
    const doc = new jsPDF()
    autoTable(doc, {
      head: [["Player", "Value"]],
      body: [["Jean Montero", "€1.2M"]],
    })
    const bytes = new Uint8Array(doc.output("arraybuffer"))
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF")
  })
})
