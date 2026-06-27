import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JsonLd } from "@/components/marketing/json-ld"

/**
 * JSON-LD is injected via dangerouslySetInnerHTML. A scraped player/team name
 * containing `</script>` must NOT be able to break out of the <script> tag.
 */
describe("JsonLd XSS escaping", () => {
  it("escapes </script> and HTML-significant characters", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, {
        data: {
          "@type": "Person",
          name: "</script><script>alert(document.cookie)</script>",
          note: "a & b < c > d",
        },
      }),
    )
    // The raw breakout sequence must not appear...
    expect(html).not.toContain("</script><script>")
    // ...and the dangerous characters must be unicode-escaped instead.
    expect(html).toContain("\\u003c")
    expect(html).toContain("\\u003e")
    expect(html).toContain("\\u0026")
    // There should be exactly one opening and one closing script tag (ours).
    expect(html.match(/<script/g)?.length).toBe(1)
    expect(html.match(/<\/script>/g)?.length).toBe(1)
  })
})
