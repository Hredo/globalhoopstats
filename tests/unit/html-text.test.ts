import { describe, expect, it } from "vitest"
import { decodeEntities, stripTags } from "@/lib/sources/html-text"
import { cleanLlmOutput, cleanUserText } from "@/lib/security/ai-advisor"

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("Ca&ntilde;o &amp; P&eacute;rez &#39;J&#x27;")).toBe("Caño & Pérez 'J'")
  })

  it("decodes in a single pass (no double unescaping)", () => {
    expect(decodeEntities("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;")
  })

  it("leaves unknown or invalid entities untouched", () => {
    expect(decodeEntities("&bogus; &#0; &#xFFFFFFF;")).toBe("&bogus; &#0; &#xFFFFFFF;")
  })
})

describe("stripTags", () => {
  it("strips nested tags that a single pass would reassemble", () => {
    const out = stripTags("<scr<script>ipt>alert(1)</script>")
    expect(out).not.toMatch(/</)
    expect(out).toContain("alert(1)")
  })

  it("supports a replacement for block-level gaps", () => {
    expect(stripTags("a<br>b", " ")).toBe("a b")
  })
})

describe("cleanUserText", () => {
  it("folds whitespace before a newline into the newline", () => {
    expect(cleanUserText("hola   \nmundo")).toBe("hola\nmundo")
  })

  it("stays linear on a long run of spaces with no newline", () => {
    const input = "a" + " ".repeat(100_000) + "b"
    const t0 = Date.now()
    cleanUserText(input)
    expect(Date.now() - t0).toBeLessThan(500)
  })
})

describe("cleanLlmOutput event handlers", () => {
  it("removes handlers inside tags, including spliced ones", () => {
    const out = cleanLlmOutput('<a oonclick=xnclick="alert(1)" href="#">x</a>')
    expect(out).not.toMatch(/\son\w+\s*=/i)
  })

  it("leaves prose that merely looks like an assignment alone", () => {
    expect(cleanLlmOutput("one = 1 and online = true")).toBe("one = 1 and online = true")
  })
})
