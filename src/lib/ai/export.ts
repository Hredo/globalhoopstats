import * as XLSX from "xlsx-js-style"
import { saveAs } from "file-saver"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { AdvisorOutput } from "@/lib/ai/local-advisor"

export type ChatMessage = {
  id: number
  type: "user" | "ai"
  content: string
  data?: AdvisorOutput
}

export type TeamContext = {
  name: string
  slug: string
  leagueSlug: string
  leagueName?: string
}

export type ExportPayload = {
  team: TeamContext
  messages: ChatMessage[]
  generatedAt?: Date
}

export const FILE_BASE = "signing-advisor"

const COLORS = {
  headerBg: "111827",
  headerFg: "FFFFFF",
  brand: "F59E0B",
  brandDark: "B45309",
  bandBg: "1F2937",
  bandFg: "FFFFFF",
  zebra: "F9FAFB",
  border: "D1D5DB",
  subHeaderBg: "FEF3C7",
  text: "111827",
  muted: "6B7280",
  cardBg: "FFF7ED",
  cardBorder: "FCD34D",
}

const PRIORITY_HEX: Record<string, { bg: string; fg: string }> = {
  brand: { bg: "FEF3C7", fg: "B45309" },
  emerald: { bg: "D1FAE5", fg: "065F46" },
  cyan: { bg: "CFFAFE", fg: "155E75" },
  blue: { bg: "DBEAFE", fg: "1E40AF" },
  red: { bg: "FEE2E2", fg: "991B1B" },
  rose: { bg: "FFE4E6", fg: "9F1239" },
  amber: { bg: "FEF3C7", fg: "92400E" },
  yellow: { bg: "FEF9C3", fg: "854D0E" },
  slate: { bg: "F1F5F9", fg: "334155" },
  purple: { bg: "EDE9FE", fg: "5B21B6" },
  pink: { bg: "FCE7F3", fg: "9D174D" },
  teal: { bg: "CCFBF1", fg: "115E59" },
  zinc: { bg: "F4F4F5", fg: "3F3F46" },
}

function priorityColorFromTailwind(cls: string): { bg: string; fg: string } {
  const match = cls.match(/(bg|text|border)-([a-z]+)-/)
  const name = match?.[2] ?? "slate"
  return PRIORITY_HEX[name] ?? PRIORITY_HEX.slate
}

type Border = {
  top?: { style: "thin" | "medium" | "thick"; color: { rgb: string } }
  bottom?: { style: "thin" | "medium" | "thick"; color: { rgb: string } }
  left?: { style: "thin" | "medium" | "thick"; color: { rgb: string } }
  right?: { style: "thin" | "medium" | "thick"; color: { rgb: string } }
}

type XLSXStyle = {
  font?: {
    name?: string
    sz?: number
    bold?: boolean
    italic?: boolean
    color?: { rgb: string }
  }
  fill?: { patternType: "solid"; fgColor: { rgb: string } }
  alignment?: {
    horizontal?: "left" | "center" | "right"
    vertical?: "top" | "center" | "bottom"
    wrapText?: boolean
    indent?: number
  }
  border?: Border
  numFmt?: string
}

const thinBorder: Border = {
  top: { style: "thin", color: { rgb: COLORS.border } },
  bottom: { style: "thin", color: { rgb: COLORS.border } },
  left: { style: "thin", color: { rgb: COLORS.border } },
  right: { style: "thin", color: { rgb: COLORS.border } },
}

const STYLES = {
  bannerTitle: {
    font: {
      name: "Calibri",
      sz: 28,
      bold: true,
      color: { rgb: COLORS.headerFg },
    },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.headerBg } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
  } satisfies XLSXStyle,
  bannerSubtitle: {
    font: {
      name: "Calibri",
      sz: 11,
      italic: true,
      color: { rgb: COLORS.headerFg },
    },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.headerBg } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
  } satisfies XLSXStyle,
  brandBar: {
    font: {
      name: "Calibri",
      sz: 11,
      bold: true,
      color: { rgb: COLORS.headerFg },
    },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.brand } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
  } satisfies XLSXStyle,
  sectionHeader: {
    font: { name: "Calibri", sz: 12, bold: true, color: { rgb: COLORS.text } },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.subHeaderBg } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
    border: thinBorder,
  } satisfies XLSXStyle,
  cardLabel: {
    font: {
      name: "Calibri",
      sz: 9,
      bold: true,
      color: { rgb: COLORS.brandDark },
    },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.cardBg } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
    border: {
      top: { style: "thin", color: { rgb: COLORS.cardBorder } },
      bottom: { style: "thin", color: { rgb: COLORS.cardBorder } },
      left: { style: "medium", color: { rgb: COLORS.cardBorder } },
      right: { style: "thin", color: { rgb: COLORS.cardBorder } },
    },
  } satisfies XLSXStyle,
  cardValue: {
    font: { name: "Calibri", sz: 14, bold: true, color: { rgb: COLORS.text } },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.cardBg } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
    border: {
      top: { style: "thin", color: { rgb: COLORS.cardBorder } },
      bottom: { style: "thin", color: { rgb: COLORS.cardBorder } },
      left: { style: "thin", color: { rgb: COLORS.cardBorder } },
      right: { style: "medium", color: { rgb: COLORS.cardBorder } },
    },
  } satisfies XLSXStyle,
  tableHeader: {
    font: {
      name: "Calibri",
      sz: 11,
      bold: true,
      color: { rgb: COLORS.headerFg },
    },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.brand } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder,
  } satisfies XLSXStyle,
  cell: {
    font: { name: "Calibri", sz: 11, color: { rgb: COLORS.text } },
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
    border: thinBorder,
  } satisfies XLSXStyle,
  cellZebra: {
    font: { name: "Calibri", sz: 11, color: { rgb: COLORS.text } },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.zebra } },
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
    border: thinBorder,
  } satisfies XLSXStyle,
  cellCenter: {
    font: { name: "Calibri", sz: 11, color: { rgb: COLORS.text } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder,
  } satisfies XLSXStyle,
  cellCenterZebra: {
    font: { name: "Calibri", sz: 11, color: { rgb: COLORS.text } },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.zebra } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder,
  } satisfies XLSXStyle,
  meta: {
    font: {
      name: "Calibri",
      sz: 10,
      italic: true,
      color: { rgb: COLORS.muted },
    },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
  } satisfies XLSXStyle,
  body: {
    font: { name: "Calibri", sz: 11, color: { rgb: COLORS.text } },
    alignment: {
      horizontal: "left",
      vertical: "top",
      wrapText: true,
      indent: 1,
    },
    border: thinBorder,
  } satisfies XLSXStyle,
}

type SheetCell = { v: string | number | null | undefined; s?: XLSXStyle }
type SheetRow = SheetCell[]

function timestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );
}

function safeFilePart(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "team"
  )
}

export function buildFileName(teamName: string, ext: string): string {
  return `${FILE_BASE}-${safeFilePart(teamName)}-${timestamp()}.${ext}`
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDateEs(date: Date): string {
  return date.toLocaleString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function stripMarkdown(input: string): string {
  return input
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .trim()
}

export function collectRecommendations(messages: ChatMessage[]) {
  const recs: AdvisorOutput["recommendations"] = []
  for (const m of messages) {
    if (m.type === "ai" && m.data?.recommendations) {
      for (const r of m.data.recommendations) recs.push(r)
    }
  }
  return recs
}

export function lastAdvisorOutput(messages: ChatMessage[]): AdvisorOutput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.type === "ai" && m.data) return m.data
  }
  return null
}

function padRow(row: SheetRow, width: number): SheetRow {
  if (row.length >= width) return row
  const padded = [...row]
  while (padded.length < width) padded.push({ v: "" })
  return padded
}

function applyStyles(
  ws: XLSX.WorkSheet,
  rows: SheetRow[],
  opts: { freezeFirstRow?: boolean; autofilter?: boolean } = {},
): void {
  for (const [addr, cell] of Object.entries(ws)) {
    if (addr.startsWith("!") || !cell) continue
    const { r, c } = XLSX.utils.decode_cell(addr)
    const row = rows[r]
    if (!row) continue
    const col = row[c]
    if (col?.s) (cell as XLSX.CellObject).s = col.s as XLSX.CellStyle
  }
  if (opts.freezeFirstRow) {
    ws["!freeze"] = { xSplit: 0, ySplit: 1 }
  }
  if (opts.autofilter && ws["!ref"]) {
    ws["!autofilter"] = { ref: ws["!ref"] }
  }
  ws["!pageSetup"] = {
    orientation: "landscape",
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  }
}

function buildCoverSheet(payload: ExportPayload): XLSX.WorkSheet {
  const { team, messages, generatedAt = new Date() } = payload
  const last = lastAdvisorOutput(messages)
  const recs = collectRecommendations(messages)
  const W = 3

  type RowEntry = { row: SheetRow; fullWidth: boolean }
  const entries: RowEntry[] = []

  const push = (row: SheetRow, fullWidth: boolean): void => {
    entries.push({ row, fullWidth })
  }

  push(padRow([{ v: "SIGNING ADVISOR", s: STYLES.bannerTitle }], W), true)
  push(
    padRow(
      [
        {
          v: "Report generated by Global Hoop Stats",
          s: STYLES.bannerSubtitle,
        },
      ],
      W,
    ),
    true,
  )
  push(padRow([{ v: "" }], W), true)

  push(padRow([{ v: "TEAM PROFILE", s: STYLES.brandBar }], W), true)
  push(
    padRow(
      [
        { v: team.name, s: STYLES.cardValue },
        { v: team.leagueName ?? team.leagueSlug, s: STYLES.cardValue },
        { v: formatDate(generatedAt), s: STYLES.cardValue },
      ],
      W,
    ),
    false,
  )
  push(
    padRow(
      [
        { v: "TEAM", s: STYLES.cardLabel },
        { v: "LEAGUE", s: STYLES.cardLabel },
        { v: "GENERATED", s: STYLES.cardLabel },
      ],
      W,
    ),
    false,
  )
  push(padRow([{ v: "" }], W), true)

  push(padRow([{ v: "SUMMARY", s: STYLES.brandBar }], W), true)
  const recCount = recs.length
  const considerations = last?.considerations.length ?? 0
  push(
    padRow(
      [
        { v: messages.length, s: STYLES.cardValue },
        { v: recCount, s: STYLES.cardValue },
        { v: considerations, s: STYLES.cardValue },
      ],
      W,
    ),
    false,
  )
  push(
    padRow(
      [
        { v: "MESSAGES", s: STYLES.cardLabel },
        { v: "CANDIDATES", s: STYLES.cardLabel },
        { v: "CONSIDERATIONS", s: STYLES.cardLabel },
      ],
      W,
    ),
    false,
  )
  push(padRow([{ v: "" }], W), true)

  if (last) {
    push(
      padRow([{ v: "ANALYSIS INTENT", s: STYLES.sectionHeader }], W),
      true,
    )
    push(
      padRow(
        [
          {
            v: `${last.intentEmoji}  ${last.intentLabel}`,
            s: {
              font: {
                name: "Calibri",
                sz: 22,
                bold: true,
                color: { rgb: COLORS.brandDark },
              },
              fill: { patternType: "solid", fgColor: { rgb: COLORS.cardBg } },
              alignment: { horizontal: "left", vertical: "center", indent: 1 },
              border: thinBorder,
            },
          },
        ],
        W,
      ),
      true,
    )
    push(padRow([{ v: "" }], W), true)

    push(padRow([{ v: "ANALYSIS", s: STYLES.sectionHeader }], W), true)
    push(
      padRow(
        [
          {
            v: stripMarkdown(last.analysis),
            s: {
              ...STYLES.body,
              font: { name: "Calibri", sz: 12, color: { rgb: COLORS.text } },
            },
          },
        ],
        W,
      ),
      true,
    )
    push(padRow([{ v: "" }], W), true)

    push(padRow([{ v: "GAP DETECTED", s: STYLES.sectionHeader }], W), true)
    push(
      padRow(
        [
          {
            v: last.gap,
            s: {
              ...STYLES.body,
              font: { name: "Calibri", sz: 12, color: { rgb: COLORS.text } },
            },
          },
        ],
        W,
      ),
      true,
    )
    push(padRow([{ v: "" }], W), true)

    push(padRow([{ v: "CURRENT CORE", s: STYLES.sectionHeader }], W), true)
    push(
      padRow(
        [
          {
            v:
              last.team.topPlayers.length > 0
                ? last.team.topPlayers.join(" · ")
                : "—",
            s: {
              ...STYLES.body,
              font: { name: "Calibri", sz: 12, color: { rgb: COLORS.text } },
            },
          },
        ],
        W,
      ),
      true,
    )
    push(padRow([{ v: "" }], W), true)

    if (last.considerations.length > 0) {
      push(
        padRow([{ v: "BEFORE NEGOTIATING", s: STYLES.sectionHeader }], W),
        true,
      )
      for (const c of last.considerations) {
        push(
          padRow(
            [
              {
                v: `•  ${c}`,
                s: {
                  ...STYLES.body,
                  font: {
                    name: "Calibri",
                    sz: 11,
                    color: { rgb: COLORS.text },
                  },
                },
              },
            ],
            W,
          ),
          true,
        )
      }
    }
  }

  const rows = entries.map((e) => e.row)

  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((c) => c.v)))
  ws["!cols"] = [{ wch: 36 }, { wch: 36 }, { wch: 36 }]
  ws["!merges"] = entries
    .map((e, i) =>
      e.fullWidth ? { s: { c: 0, r: i }, e: { c: W - 1, r: i } } : null,
    )
    .filter((m): m is XLSX.Range => m !== null)

  for (const [addr, cell] of Object.entries(ws)) {
    if (addr.startsWith("!") || !cell) continue
    const { r, c } = XLSX.utils.decode_cell(addr)
    const row = rows[r]
    if (!row) continue
    const col = row[c]
    if (col?.s) (cell as XLSX.CellObject).s = col.s as XLSX.CellStyle
  }
  return ws
}

function buildRecommendationsSheet(payload: ExportPayload): XLSX.WorkSheet {
  const recs = collectRecommendations(payload.messages)
  const header = [
    "#",
    "Player",
    "Position",
    "League",
    "Age",
    "Contract",
    "Priority",
    "Market",
    "Fit",
    "Strengths",
  ]
  const data: SheetRow[] = [
    header.map((h) => ({ v: h, s: STYLES.tableHeader })),
  ]
  if (recs.length === 0) {
    data.push([
      { v: "—", s: STYLES.cell },
      { v: "No recommendations in this conversation.", s: STYLES.cell },
      ...Array(header.length - 2).fill({ v: "", s: STYLES.cell }),
    ])
  } else {
    recs.forEach((r, i) => {
      const zebra = i % 2 === 0 ? STYLES.cell : STYLES.cellZebra
      const zebraCenter =
        i % 2 === 0 ? STYLES.cellCenter : STYLES.cellCenterZebra
      const { bg, fg } = priorityColorFromTailwind(r.priorityColor)
      const priorityStyle: XLSXStyle = {
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: fg } },
        fill: { patternType: "solid", fgColor: { rgb: bg } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: thinBorder,
      }
      data.push([
        { v: i + 1, s: zebraCenter },
        {
          v: r.name,
          s: {
            ...zebra,
            font: {
              name: "Calibri",
              sz: 11,
              bold: true,
              color: { rgb: COLORS.text },
            },
          },
        },
        { v: r.position, s: zebra },
        { v: r.league, s: zebraCenter },
        { v: r.age, s: zebraCenter },
        { v: r.contractValue, s: zebraCenter },
        { v: r.priority, s: priorityStyle },
        { v: r.market, s: zebra },
        { v: r.fit, s: zebra },
        {
          v:
            r.strengths.length > 0
              ? r.strengths.map((s) => `• ${s}`).join("\n")
              : "—",
          s: zebra,
        },
      ])
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(data.map((r) => r.map((c) => c.v)))
  ws["!cols"] = [
    { wch: 4 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 7 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 50 },
    { wch: 50 },
  ]
  ws["!rows"] = [{ hpt: 32 }]
  applyStyles(ws, data, { freezeFirstRow: true, autofilter: true })
  return ws
}

function buildPlayerCardsSheet(payload: ExportPayload): XLSX.WorkSheet {
  const recs = collectRecommendations(payload.messages)
  const data: SheetRow[] = []

  const title = (text: string): SheetCell => ({
    v: text,
    s: STYLES.bannerTitle,
  })
  const sub = (text: string): SheetCell => ({ v: text, s: STYLES.brandBar })
  const label = (text: string): SheetCell => ({ v: text, s: STYLES.cardLabel })
  const value = (text: string): SheetCell => ({ v: text, s: STYLES.cardValue })

  if (recs.length === 0) {
    data.push([title("Player profiles")])
    data.push([label("No profiles in this conversation.")])
  } else {
    data.push([title(`Player profiles — ${recs.length} candidates`)])
    data.push([label("")])
    data.push([label("")])

    recs.forEach((r, i) => {
      const { bg, fg } = priorityColorFromTailwind(r.priorityColor)
      const priorityBadge: XLSXStyle = {
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: fg } },
        fill: { patternType: "solid", fgColor: { rgb: bg } },
        alignment: { horizontal: "center", vertical: "center" },
        border: thinBorder,
      }
      data.push([sub(`Player ${i + 1} — ${r.name}`)])
      data.push([label("Position"), value(r.position)])
      data.push([label("League"), value(r.league)])
      data.push([label("Age"), value(`${r.age} years`)])
      data.push([label("Est. contract"), value(r.contractValue)])
      data.push([label("Market"), value(r.market)])
      data.push([label("Priority"), { v: r.priority, s: priorityBadge }])
      data.push([label("Fit"), value(r.fit)])
      data.push([
        label("Strengths"),
        value(
          r.strengths.length > 0
            ? r.strengths.map((s) => `• ${s}`).join("\n")
            : "—",
        ),
      ])
      data.push([label("")])
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(data.map((r) => r.map((c) => c.v)))
  ws["!cols"] = [{ wch: 24 }, { wch: 95 }]
  ws["!rows"] = [{ hpt: 36 }]

  for (const [addr, cell] of Object.entries(ws)) {
    if (addr.startsWith("!") || !cell) continue
    const { r, c } = XLSX.utils.decode_cell(addr)
    const row = data[r]
    if (!row) continue
    const col = row[c]
    if (col?.s) (cell as XLSX.CellObject).s = col.s as XLSX.CellStyle
  }
  ws["!pageSetup"] = {
    orientation: "portrait",
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  }
  return ws
}

function buildConversationSheet(payload: ExportPayload): XLSX.WorkSheet {
  const { messages } = payload
  const header = ["#", "Type", "Message"]
  const data: SheetRow[] = [
    header.map((h) => ({ v: h, s: STYLES.tableHeader })),
  ]
  messages.forEach((m, i) => {
    const cleaned = m.data ? buildAdvisorText(m.data) : stripMarkdown(m.content)
    const isAi = m.type === "ai"
    const cellBase: XLSXStyle = {
      font: { name: "Calibri", sz: 11, color: { rgb: COLORS.text } },
      fill: {
        patternType: "solid",
        fgColor: { rgb: isAi ? "FFFBEB" : "F9FAFB" },
      },
      alignment: {
        horizontal: "left",
        vertical: "top",
        wrapText: true,
        indent: 1,
      },
      border: thinBorder,
    }
    const typeBase: XLSXStyle = {
      font: {
        name: "Calibri",
        sz: 11,
        bold: true,
        color: { rgb: isAi ? COLORS.brandDark : COLORS.muted },
      },
      fill: {
        patternType: "solid",
        fgColor: { rgb: isAi ? COLORS.subHeaderBg : "F3F4F6" },
      },
      alignment: { horizontal: "center", vertical: "center" },
      border: thinBorder,
    }
    const idxBase: XLSXStyle = {
      font: { name: "Calibri", sz: 10, color: { rgb: COLORS.muted } },
      alignment: { horizontal: "center", vertical: "top" },
      border: thinBorder,
    }
    data.push([
      { v: i + 1, s: idxBase },
      { v: isAi ? "Advisor" : "User", s: typeBase },
      { v: cleaned, s: cellBase },
    ])
  })
  if (messages.length === 0) {
    data.push([
      { v: "—", s: STYLES.cell },
      { v: "—", s: STYLES.cell },
      { v: "No messages in this conversation.", s: STYLES.cell },
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(data.map((r) => r.map((c) => c.v)))
  ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 100 }]
  ws["!rows"] = [{ hpt: 30 }]
  applyStyles(ws, data, { freezeFirstRow: true, autofilter: true })
  return ws
}

export function buildAdvisorText(data: AdvisorOutput): string {
  const lines: string[] = []
  const label = data.intentLabel?.trim()
  if (label) {
    lines.push(`${data.intentEmoji ?? ""} ${label}`)
    lines.push("")
  }
  lines.push(stripMarkdown(data.analysis))
  lines.push("")
  lines.push(`Gap detected: ${data.gap}`)
  lines.push("")
  if (data.recommendations.length > 0) {
    lines.push("Candidates:")
    data.recommendations.forEach((r, i) => {
      lines.push(
        `  ${i + 1}. ${r.name} (${r.position}, ${r.league}, ${r.age} years) — ${r.contractValue} [${r.priority}]`,
      )
      lines.push(`     Fit: ${r.fit}`)
      if (r.strengths.length > 0) {
        lines.push(`     Strengths: ${r.strengths.join(", ")}`)
      }
    })
  }
  if (data.considerations.length > 0) {
    lines.push("")
    lines.push("Considerations:")
    for (const c of data.considerations) lines.push(`  - ${c}`)
  }
  return lines.join("\n")
}

export function exportToExcel(payload: ExportPayload): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildCoverSheet(payload), "Cover")
  XLSX.utils.book_append_sheet(
    wb,
    buildRecommendationsSheet(payload),
    "Recommendations",
  )
  XLSX.utils.book_append_sheet(wb, buildPlayerCardsSheet(payload), "Profiles")
  XLSX.utils.book_append_sheet(
    wb,
    buildConversationSheet(payload),
    "Conversation",
  )

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  saveAs(blob, buildFileName(payload.team.name, "xlsx"))
}

export function exportToPdf(payload: ExportPayload): void {
  const { team, messages, generatedAt = new Date() } = payload
  const last = lastAdvisorOutput(messages)

  // ── Palette (matches simulator export) ─────────────────────────
  type RGB = [number, number, number]
  const BRAND: RGB = [230, 106, 30]
  const BRAND_DARK: RGB = [183, 78, 14]
  const INK: RGB = [26, 24, 22]
  const BODY: RGB = [62, 60, 64]
  const SUBTLE: RGB = [122, 120, 126]
  const LIGHTFILL: RGB = [245, 244, 246]
  const LINE: RGB = [223, 221, 226]

  const PAGE_W = 210
  const MARGIN = 16
  const CONTENT_W = PAGE_W - MARGIN * 2
  const BOTTOM_LIMIT = 274
  const leagueLabel = team.leagueName ?? team.leagueSlug

  const doc = new jsPDF({ unit: "mm", format: "a4" })

  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])

  // ── Helpers ────────────────────────────────────────────────────

  function drawLogo(cx: number, cy: number, r: number) {
    setFill([255, 255, 255])
    doc.circle(cx, cy, r, "F")
    setDraw(BRAND_DARK)
    doc.setLineWidth(0.3)
    doc.line(cx - r, cy, cx + r, cy)
    doc.line(cx, cy - r, cx, cy + r)
    setText(BRAND_DARK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(r * 1.45)
    doc.text("GH", cx, cy + r * 0.5, { align: "center" })
  }

  function topBand(subtitle: string) {
    setFill(BRAND)
    doc.rect(0, 0, PAGE_W, 22, "F")
    drawLogo(MARGIN + 5, 11, 5.5)
    setText([255, 255, 255])
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text("GLOBAL HOOP STATS", MARGIN + 14, 10)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.text(subtitle, MARGIN + 14, 15.5)
    doc.setFontSize(8)
    doc.text(
      generatedAt.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      PAGE_W - MARGIN,
      13,
      { align: "right" },
    )
  }

  function addFooters() {
    const total = doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      setDraw(LINE)
      doc.setLineWidth(0.2)
      doc.line(MARGIN, 285, PAGE_W - MARGIN, 285)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      setText(SUBTLE)
      doc.text(
        "Generado por Global Hoop Stats · Cifras estimadas heurísticamente, no son valores reales de contrato.",
        MARGIN,
        290,
      )
      doc.text(`${i} / ${total}`, PAGE_W - MARGIN, 290, { align: "right" })
    }
  }

  function sectionHeading(text: string, y: number): number {
    setFill(BRAND)
    doc.rect(MARGIN, y - 3.4, 1.6, 4.6, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    setText(INK)
    doc.text(text, MARGIN + 4.5, y)
    return y + 6.5
  }

  function ensure(y: number, needed: number): number {
    if (y + needed > BOTTOM_LIMIT) {
      doc.addPage()
      return 20
    }
    return y
  }

  function renderMarkdown(text: string, y: number): number {
    for (const raw of text.split("\n")) {
      const line = raw.trim()
      if (!line) { y += 1.8; continue }
      let content = line
      let bullet = false
      let heading = false
      if (content.startsWith("### ")) { content = content.slice(4); heading = true }
      else if (content.startsWith("## ")) { content = content.slice(3); heading = true }
      else if (content.startsWith("- ") || content.startsWith("* ")) { content = content.slice(2); bullet = true }
      content = content.replace(/\*\*/g, "").trim()
      if (!content) continue
      doc.setFont("helvetica", heading ? "bold" : "normal")
      doc.setFontSize(heading ? 10 : 9)
      const indent = bullet ? MARGIN + 5 : MARGIN
      const wrapW = bullet ? CONTENT_W - 5 : CONTENT_W
      const wrapped = doc.splitTextToSize(content, wrapW) as string[]
      for (let i = 0; i < wrapped.length; i++) {
        y = ensure(y, 6)
        if (bullet && i === 0) {
          setText(BRAND)
          doc.text("•", MARGIN + 1.5, y)
        }
        setText(heading ? INK : BODY)
        doc.text(wrapped[i], indent, y)
        y += heading ? 5 : 4.5
      }
      if (heading) y += 1
    }
    return y
  }

  // ── Page 1: Cover ───────────────────────────────────────────────

  topBand("Informe de asesoramiento")

  let y = 32
  doc.setFont("helvetica", "bold")
  doc.setFontSize(17)
  setText(INK)
  doc.text(team.name, MARGIN, y)
  y += 9

  // Team info card
  y = ensure(y, 24)
  setFill(LIGHTFILL)
  setDraw(LINE)
  doc.setLineWidth(0.2)
  doc.roundedRect(MARGIN, y - 2, CONTENT_W, 24, 1.6, 1.6, "FD")
  setText(BODY)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Liga: ${leagueLabel}  ·  Generado: ${formatDateEs(generatedAt)}`, MARGIN + 4, y + 8)
  y += 28

  y = ensure(y, 16)
  y = sectionHeading("Resumen", y)

  // Stats cards
  const cardW = (CONTENT_W - 8) / 2
  const cardH = 18
  const stats = [
    { label: "Mensajes", value: String(messages.length) },
    { label: "Candidatos", value: String(collectRecommendations(messages).length) },
  ]
  for (let i = 0; i < stats.length; i++) {
    const cx = MARGIN + i * (cardW + 8)
    setFill(BRAND)
    doc.roundedRect(cx, y, cardW, cardH, 1.2, 1.2, "F")
    setText([255, 255, 255])
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text(stats[i].value, cx + 4, y + 7)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.text(stats[i].label, cx + 4, y + 14)
  }
  y += cardH + 10

  // ── Team diagnosis ──────────────────────────────────────────────
  if (last) {
    y = ensure(y, 16)
    y = sectionHeading("Diagnóstico del equipo", y)

    if (last.intentLabel) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      setText(BRAND_DARK)
      doc.text(`${last.intentEmoji ?? ""} ${last.intentLabel}`, MARGIN, y)
      y += 5.5
    }

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    setText(BODY)
    y = renderMarkdown(last.analysis, y)
    y += 2

    // Gap highlight box
    y = ensure(y, 14)
    setFill([255, 247, 237])
    setDraw(BRAND)
    doc.setLineWidth(0.2)
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.2, 1.2, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    setText(BRAND_DARK)
    doc.text(`Carencia detectada: ${last.gap}`, MARGIN + 4, y + 5.5)
    y += 12

    if (last.team.topPlayers.length > 0) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      setText(SUBTLE)
      doc.text(`Jugadores actuales: ${last.team.topPlayers.join(" · ")}`, MARGIN, y)
      y += 5
    }

    y += 3

    // Considerations
    if (last.considerations.length > 0) {
      y = ensure(y, 16)
      y = sectionHeading("Antes de negociar", y)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      setText(BODY)
      for (const c of last.considerations) {
        y = ensure(y, 6)
        doc.text(`• ${c}`, MARGIN + 2, y)
        y += 4.5
      }
      y += 3
    }
  }

  // ── Candidates table ────────────────────────────────────────────
  const recs = collectRecommendations(messages)
  if (recs.length > 0) {
    y = ensure(y, 24)
    y = sectionHeading("Candidatos recomendados", y)
    const rows = recs.map((r, i) => [
      String(i + 1),
      r.name,
      r.position,
      r.league,
      r.priority,
    ])
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      theme: "grid",
      head: [["#", "Jugador", "Pos.", "Liga", "Prioridad"]],
      body: rows,
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { textColor: INK, fontSize: 8 },
      alternateRowStyles: { fillColor: LIGHTFILL },
      styles: { lineColor: LINE, lineWidth: 0.1, cellPadding: 2.2 },
      columnStyles: { 0: { cellWidth: 10 }, 4: { cellWidth: 22 } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 9
  }

  // ── Full conversation ───────────────────────────────────────────
  doc.addPage()
  topBand("Conversación completa")

  y = 32
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  setText(INK)
  doc.text("Conversación completa", MARGIN, y)
  y += 8
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  setText(SUBTLE)
  doc.text(`${messages.length} mensajes · ${team.name}`, MARGIN, y)
  y += 10

  if (messages.length === 0) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(10)
    setText(SUBTLE)
    doc.text("No hay mensajes en esta conversación.", MARGIN, y)
  } else {
    for (const [i, m] of messages.entries()) {
      y = ensure(y, 20)
      const isUser = m.type === "user"
      const msgBg: RGB = isUser ? LIGHTFILL : [255, 247, 237]
      const accentColor: RGB = isUser ? [59, 130, 246] : BRAND
      setFill(msgBg)
      setDraw(LINE)
      doc.setLineWidth(0.2)
      const msgH = 10
      doc.roundedRect(MARGIN, y, CONTENT_W, msgH, 1.2, 1.2, "FD")
      setText([255, 255, 255])
      setFill(accentColor)
      doc.circle(MARGIN + 5, y + msgH / 2, 2.8, "F")
      setText(isUser ? [30, 64, 175] : BRAND_DARK)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7.5)
      doc.text(isUser ? "Tú" : "Advisor", MARGIN + 11, y + 4)
      setText(SUBTLE)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(6.5)
      doc.text(`#${i + 1}`, MARGIN + CONTENT_W - 10, y + 4, { align: "right" })
      y += msgH + 3

      const content = m.data ? buildAdvisorText(m.data) : stripMarkdown(m.content)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      setText(BODY)
      for (const line of content.split("\n")) {
        if (line.trim()) {
          const indent = /^\s{2,}/.test(line) ? MARGIN + 8 : MARGIN + 2
          y = ensure(y, 6)
          const wrapped = doc.splitTextToSize(line.trim(), CONTENT_W - 10) as string[]
          for (const ln of wrapped) {
            y = ensure(y, 6)
            doc.text(ln, indent, y)
            y += 4
          }
        } else {
          y += 2
        }
      }
      y += 4
    }
  }

  addFooters()
  doc.save(buildFileName(team.name, "pdf"))
}

// Word export runs server-side via POST /api/ai-advisor/export-word
// (docx IIFE breaks Turbopack on the client)
