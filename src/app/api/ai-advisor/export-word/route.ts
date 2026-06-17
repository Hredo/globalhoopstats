import { NextRequest, NextResponse } from "next/server"
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  ShadingType,
  BorderStyle,
} from "docx"
import type { AdvisorOutput } from "@/lib/ai/local-advisor"

type ChatMessage = {
  id: number
  type: "user" | "ai"
  content: string
  data?: AdvisorOutput
}

type TeamContext = {
  name: string
  slug: string
  leagueSlug: string
  leagueName?: string
}

type ExportPayload = {
  team: TeamContext
  messages: ChatMessage[]
  generatedAt?: string
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const payload: ExportPayload = await request.json()
    const { team, messages, generatedAt } = payload
    const genDate = generatedAt ? new Date(generatedAt) : new Date()
    const last = lastAdvisorOutput(messages)

    const children: Paragraph[] = []

    // ==================== TITLE PAGE ====================
    children.push(spacer(600))
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "SIGNING ADVISOR", bold: true, size: 52, color: "111827" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: "Informe de asesoramiento deportivo", size: 24, color: "6B7280", italics: true }),
        ],
      }),
    )

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 60 },
        border: {
          top: { color: "F59E0B", space: 12, style: BorderStyle.SINGLE, size: 2 },
          bottom: { color: "F59E0B", space: 12, style: BorderStyle.SINGLE, size: 2 },
        },
        children: [
          new TextRun({ text: team.name, bold: true, size: 36, color: "111827" }),
        ],
      }),
    )

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `Liga: ${team.leagueName ?? team.leagueSlug}`, size: 22, color: "6B7280" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: formatDateEs(genDate), size: 20, color: "9CA3AF" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [
          new TextRun({ text: "Reporte generado por Global Hoop Stats", size: 18, color: "D1D5DB", italics: true }),
        ],
      }),
    )

    children.push(docBreak())

    // ==================== RESUMEN ====================
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Resumen del informe", bold: true, size: 32, color: "111827" })],
      }),
      infoRow("Equipo", team.name),
      infoRow("Liga", team.leagueName ?? team.leagueSlug),
      infoRow("Fecha", formatDateEs(genDate)),
      infoRow("Mensajes", `${messages.length} en total`),
      spacer(120),
    )

    // ==================== DIAGNÓSTICO ====================
    if (last) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          heading: HeadingLevel.HEADING_1,
          border: {
            bottom: { color: "F59E0B", space: 6, style: BorderStyle.SINGLE, size: 4 },
          },
          children: [new TextRun({ text: "Diagnóstico del equipo", bold: true, size: 32, color: "111827" })],
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${last.intentEmoji ?? ""} ${last.intentLabel}`, bold: true, size: 24, color: "B45309" }),
          ],
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: stripMarkdown(last.analysis), size: 22, color: "374151" })],
        }),
        new Paragraph({
          spacing: { before: 40, after: 80 },
          shading: { type: ShadingType.SOLID, color: "FEF3C7", fill: "FEF3C7" },
          indent: { left: 120 },
          children: [
            new TextRun({ text: `Carencia detectada: ${last.gap}`, bold: true, size: 20, color: "92400E" }),
          ],
        }),
      )

      if (last.team.topPlayers.length > 0) {
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: "Jugadores actuales: ", bold: true, size: 20, color: "6B7280" }),
              new TextRun({ text: last.team.topPlayers.join(" · "), size: 20, color: "374151" }),
            ],
          }),
        )
      }

      if (last.considerations.length > 0) {
        children.push(spacer(40))
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Antes de negociar", bold: true, size: 26, color: "111827" })],
          }),
        )
        for (const c of last.considerations) {
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              indent: { left: 240 },
              children: [
                new TextRun({ text: "•  ", size: 20, color: "F59E0B" }),
                new TextRun({ text: c, size: 20, color: "374151" }),
              ],
            }),
          )
        }
      }
    }

    children.push(docBreak())

    // ==================== CONVERSACIÓN ====================
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        heading: HeadingLevel.HEADING_1,
        border: {
          bottom: { color: "F59E0B", space: 6, style: BorderStyle.SINGLE, size: 4 },
        },
        children: [new TextRun({ text: "Conversación completa", bold: true, size: 32, color: "111827" })],
      }),
    )

    if (messages.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "No hay mensajes en esta conversación.", italics: true, size: 20, color: "9CA3AF" })],
        }),
      )
    } else {
      for (const [i, m] of messages.entries()) {
        const isUser = m.type === "user"
        const label = isUser ? "Tú" : "Asistente"
        const bgColor = isUser ? "F9FAFB" : "FEF3C7"

        children.push(
          new Paragraph({
            spacing: { before: 240, after: 40 },
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
            indent: { left: 120 },
            children: [
              new TextRun({
                text: `${label} · mensaje ${i + 1}`,
                bold: true,
                size: 18,
                color: isUser ? "1E40AF" : "92400E",
              }),
            ],
          }),
        )

        const content = m.data ? buildAdvisorText(m.data) : m.content.trim()
        const paragraphs = content.split("\n").filter((p) => p.trim())

        for (const line of paragraphs) {
          const isBullet = /^\s*[\d]+[\.\)]/.test(line) || /^\s*[-•]/.test(line)
          children.push(
            new Paragraph({
              spacing: { after: 40 },
              indent: isBullet ? { left: 360 } : { left: 160 },
              children: [new TextRun({ text: line.trim(), size: 20, color: "374151" })],
            }),
          )
        }
      }
    }

    // ==================== BUILD DOCUMENT ====================
    const doc = new Document({
      creator: "Global Hoop Stats",
      title: `Signing Advisor — ${team.name}`,
      description: "Informe de asesoramiento deportivo",
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size: 22 },
          },
        },
      },
      sections: [{ properties: {}, children }],
    })

    const buffer = await Packer.toBuffer(doc)

    const safeName = team.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "team"
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const filename = `signing-advisor-${safeName}-${date}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("Word export failed:", err)
    return NextResponse.json(
      { error: "Error al generar el documento" },
      { status: 500 },
    )
  }
}

// ============== HELPERS ==============

function stripMarkdown(input: string): string {
  return input
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .trim()
}

function lastAdvisorOutput(messages: ChatMessage[]): AdvisorOutput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.type === "ai" && m.data) return m.data
  }
  return null
}

function formatDateEs(date: Date): string {
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildAdvisorText(data: AdvisorOutput): string {
  const lines: string[] = []
  if (data.intentLabel?.trim()) {
    lines.push(`${data.intentEmoji ?? ""} ${data.intentLabel}`)
    lines.push("")
  }
  lines.push(stripMarkdown(data.analysis))
  if (data.recommendations.length > 0) {
    lines.push("")
    lines.push("Candidatos recomendados:")
    data.recommendations.forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.name} (${r.position}, ${r.league}) — ${r.contractValue}`)
    })
  }
  if (data.considerations.length > 0) {
    lines.push("")
    lines.push("Consideraciones:")
    for (const c of data.considerations) lines.push(`  - ${c}`)
  }
  return lines.join("\n")
}

function infoRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    indent: { left: 240 },
    children: [
      new TextRun({ text: `${label}:  `, bold: true, size: 20, color: "6B7280" }),
      new TextRun({ text: value, size: 20, color: "111827" }),
    ],
  })
}

function spacer(after: number): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after } })
}

function docBreak(): Paragraph {
  return new Paragraph({
    spacing: { before: 400, after: 100 },
    border: {
      bottom: { color: "E5E7EB", space: 2, style: BorderStyle.SINGLE, size: 2 },
    },
    children: [new TextRun({ text: "" })],
  })
}
