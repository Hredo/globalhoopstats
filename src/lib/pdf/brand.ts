import type jsPDF from "jspdf"

/**
 * Shared Global Hoop Stats PDF brand template: palette, page metrics, the
 * orange top band with the GH mark, footers and the light-markdown renderer
 * used for AI analyses. Every exported report (trade, playbook…) draws from
 * here so they all look like the same product.
 */

export type RGB = [number, number, number]
export const BRAND: RGB = [230, 106, 30]
export const BRAND_DARK: RGB = [183, 78, 14]
export const INK: RGB = [26, 24, 22]
export const BODY: RGB = [62, 60, 64]
export const SUBTLE: RGB = [122, 120, 126]
export const LIGHTFILL: RGB = [245, 244, 246]
export const LINE: RGB = [223, 221, 226]

export const PAGE_W = 210
export const MARGIN = 16
export const CONTENT_W = PAGE_W - MARGIN * 2
export const BOTTOM_LIMIT = 274

export const setText = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2])
export const setFill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2])
export const setDraw = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2])

/** Vector approximation of the GH basketball mark. */
export function drawLogo(doc: jsPDF, cx: number, cy: number, r: number) {
  setFill(doc, [255, 255, 255])
  doc.circle(cx, cy, r, "F")
  setDraw(doc, BRAND_DARK)
  doc.setLineWidth(0.3)
  doc.line(cx - r, cy, cx + r, cy)
  doc.line(cx, cy - r, cx, cy + r)
  setText(doc, BRAND_DARK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(r * 1.45)
  doc.text("GH", cx, cy + r * 0.5, { align: "center" })
}

export function topBand(doc: jsPDF, subtitle: string, dateLocale: string) {
  setFill(doc, BRAND)
  doc.rect(0, 0, PAGE_W, 22, "F")
  drawLogo(doc, MARGIN + 5, 11, 5.5)
  setText(doc, [255, 255, 255])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("GLOBAL HOOP STATS", MARGIN + 14, 10)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text(subtitle, MARGIN + 14, 15.5)
  doc.setFontSize(8)
  doc.text(
    new Date().toLocaleDateString(dateLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    PAGE_W - MARGIN,
    13,
    { align: "right" },
  )
}

export function addFooters(doc: jsPDF, footerText: string) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    setDraw(doc, LINE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    setText(doc, SUBTLE)
    doc.text(footerText, MARGIN, 290)
    doc.text(`${i} / ${total}`, PAGE_W - MARGIN, 290, { align: "right" })
  }
}

export function sectionHeading(doc: jsPDF, text: string, y: number): number {
  setFill(doc, BRAND)
  doc.rect(MARGIN, y - 3.4, 1.6, 4.6, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  setText(doc, INK)
  doc.text(text, MARGIN + 4.5, y)
  return y + 6.5
}

export function ensure(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > BOTTOM_LIMIT) {
    doc.addPage()
    return 20
  }
  return y
}

/** Render an AI analysis (light markdown) at y, returns new y. */
export function renderAnalysis(doc: jsPDF, text: string, y: number): number {
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) {
      y += 1.8
      continue
    }
    let content = line
    let bullet = false
    let heading = false
    if (content.startsWith("### ")) {
      content = content.slice(4)
      heading = true
    } else if (content.startsWith("## ")) {
      content = content.slice(3)
      heading = true
    } else if (content.startsWith("- ") || content.startsWith("* ")) {
      content = content.slice(2)
      bullet = true
    }
    content = content.replace(/\*\*/g, "").trim()
    if (!content) continue
    doc.setFont("helvetica", heading ? "bold" : "normal")
    doc.setFontSize(heading ? 10 : 9)
    const indent = bullet ? MARGIN + 5 : MARGIN
    const wrapW = bullet ? CONTENT_W - 5 : CONTENT_W
    const wrapped = doc.splitTextToSize(content, wrapW) as string[]
    for (let i = 0; i < wrapped.length; i++) {
      y = ensure(doc, y, 6)
      if (bullet && i === 0) {
        setText(doc, BRAND)
        doc.text("•", MARGIN + 1.5, y)
      }
      setText(doc, heading ? INK : BODY)
      doc.text(wrapped[i], indent, y)
      y += heading ? 5 : 4.5
    }
    if (heading) y += 1
  }
  return y
}
