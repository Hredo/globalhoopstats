import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { safeNextPath } from "@/lib/auth/safe-redirect"
import { encryptSecret, decryptSecret } from "@/lib/security/secrets"
import { stripTags, decodeEntities } from "@/lib/sources/html-text"
import { JsonLd } from "@/components/marketing/json-ld"

/**
 * Property-based fuzzing of the input guards: instead of a handful of known
 * payloads, fast-check throws thousands of generated strings at each one and
 * shrinks any counter-example to its smallest form.
 */

// Strings biased towards the characters these guards care about.
const hostile = fc.string({
  unit: fc.oneof(
    fc.constantFrom(
      "/",
      "\\",
      ".",
      ":",
      "@",
      "?",
      "#",
      "%",
      "<",
      ">",
      "&",
      ";",
      "\t",
      "\n",
      "\r",
      " ",
    ),
    fc.constantFrom(
      "script",
      "evil.com",
      "javascript",
      "//",
      "%2f",
      "%5c",
      "&lt;",
      "&#x3c;",
    ),
    fc.string({ unit: "grapheme", maxLength: 1 }),
  ),
  maxLength: 60,
})

const PROBE = "https://same-origin.invalid"

describe("fuzz: safeNextPath never leaves the origin", () => {
  it("returns a same-origin path or the fallback", () => {
    fc.assert(
      fc.property(fc.oneof(hostile, fc.webUrl(), fc.string()), (raw) => {
        const out = safeNextPath(raw)
        expect(out.startsWith("/")).toBe(true)
        expect(out.startsWith("//")).toBe(false)
        expect(out).not.toMatch(/[\u0000-\u001f\u007f\\]/)
        expect(new URL(out, PROBE).origin).toBe(PROBE)
      }),
      { numRuns: 2000 },
    )
  })
})

describe("fuzz: secret encryption", () => {
  it("round-trips any string", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 200 }), (plain) => {
        expect(decryptSecret(encryptSecret(plain))).toBe(plain)
      }),
      { numRuns: 300 },
    )
  })

  it("never throws on arbitrary ciphertext", () => {
    fc.assert(
      fc.property(
        fc.oneof(hostile, fc.string(), fc.base64String()),
        (garbage) => {
          expect(() => decryptSecret(garbage)).not.toThrow()
          expect(decryptSecret(`v1.${garbage}`)).toBeNull()
        },
      ),
      { numRuns: 1000 },
    )
  })
})

describe("fuzz: HTML text helpers", () => {
  it("stripTags leaves no angle bracket behind", () => {
    fc.assert(
      fc.property(hostile, (s) => {
        expect(stripTags(s)).not.toMatch(/[<>]/)
      }),
      { numRuns: 2000 },
    )
  })

  it("decodeEntities never throws", () => {
    fc.assert(
      fc.property(hostile, (s) => {
        expect(() => decodeEntities(s)).not.toThrow()
      }),
      { numRuns: 2000 },
    )
  })
})

describe("fuzz: JSON-LD cannot break out of its <script>", () => {
  it("keeps exactly one script element whatever the data", () => {
    fc.assert(
      fc.property(hostile, hostile, (name, note) => {
        const html = renderToStaticMarkup(
          createElement(JsonLd, { data: { "@type": "Person", name, note } }),
        )
        expect(html.match(/<script/gi)?.length).toBe(1)
        expect(html.match(/<\/script/gi)?.length).toBe(1)
        // The markup is exactly <script …>BODY</script>; slice it rather
        // than strip tags with a regex.
        const body = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</"))
        expect(JSON.parse(body)).toMatchObject({ name, note })
      }),
      { numRuns: 500 },
    )
  })
})
