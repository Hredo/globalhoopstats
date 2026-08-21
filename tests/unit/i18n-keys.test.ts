import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { en } from "@/lib/i18n/dictionaries/en"
import { es } from "@/lib/i18n/dictionaries/es"
import { translate } from "@/lib/i18n/t"

const SRC = join(process.cwd(), "src")

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

/**
 * Static `t("some.key")` / `t("some.key", { … })` call sites. Dynamic keys
 * (template literals, variables, `item.labelKey`) are skipped — they cannot be
 * checked without running the component.
 */
const T_CALL = /\bt\(\s*"([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)"/g

function usedKeys(): Map<string, string[]> {
  const keys = new Map<string, string[]>()
  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(T_CALL)) {
      const key = match[1]
      const where = relative(process.cwd(), file).replace(/\\/g, "/")
      const seen = keys.get(key)
      if (seen) {
        if (!seen.includes(where)) seen.push(where)
      } else {
        keys.set(key, [where])
      }
    }
  }
  return keys
}

// translate() falls back to echoing the path when a key is missing, so a typo
// renders the raw "account.profile.tilte" in the UI instead of crashing. These
// tests are the only thing standing between a typo and a user seeing it.
function resolves(dict: unknown, key: string): boolean {
  return translate(dict, key) !== key
}

describe("i18n keys", () => {
  const keys = usedKeys()

  it("finds translation calls to check", () => {
    expect(keys.size).toBeGreaterThan(50)
  })

  it("resolves every statically-used key in English", () => {
    const missing = [...keys.entries()]
      .filter(([key]) => !resolves(en, key))
      .map(([key, files]) => `${key} (${files.join(", ")})`)
    expect(missing, `missing English keys:\n${missing.join("\n")}`).toEqual([])
  })

  it("resolves every statically-used key in Spanish", () => {
    const missing = [...keys.entries()]
      .filter(([key]) => !resolves(es, key))
      .map(([key, files]) => `${key} (${files.join(", ")})`)
    expect(missing, `missing Spanish keys:\n${missing.join("\n")}`).toEqual([])
  })

  it("leaves no English string sitting in the Spanish account catalogue", () => {
    // The account area was the part that stayed in English after a language
    // switch; this keeps the Spanish side from silently copying English text.
    const flatten = (obj: unknown, path = ""): Array<[string, string]> => {
      if (typeof obj === "string") return [[path, obj]]
      if (!obj || typeof obj !== "object") return []
      return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        flatten(v, path ? `${path}.${k}` : k),
      )
    }
    const enAccount = new Map(flatten(en.account))
    const identical = flatten(es.account).filter(([path, value]) => {
      const source = enAccount.get(path)
      // Ignore genuinely language-neutral values (brand names, "Plan", "2FA").
      return source !== undefined && source === value && value.length > 12
    })
    expect(
      identical.map(([p]) => p),
      "Spanish account strings identical to English",
    ).toEqual([])
  })
})
