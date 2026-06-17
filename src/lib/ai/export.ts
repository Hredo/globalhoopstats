import * as XLSX from "xlsx-js-style"
import { saveAs } from "file-saver"
import jsPDF from "jspdf"
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

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 45
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  const drawSectionHeader = (text: string, color: [number, number, number] = [245, 158, 11]) => {
    ensureSpace(40)
    doc.setFillColor(...color)
    doc.rect(margin, y, 4, 18, "F")
    doc.setTextColor(17, 24, 39)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text(text, margin + 14, y + 13)
    y += 28
  }

  function drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
  ): number {
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.setFontSize(fontSize)
    doc.text(lines, x, y)
    return y + lines.length * (fontSize * 1.25)
  }

  // ==================== COVER / TITLE SECTION ====================
  doc.setFillColor(17, 24, 39)
  doc.rect(0, 0, pageWidth, 175, "F")
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 175, pageWidth, 4, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(26)
  doc.text("SIGNING ADVISOR", margin, 55)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(156, 163, 175)
  doc.text("Reporte generado por Global Hoop Stats", margin, 75)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(245, 158, 11)
  doc.text(`Equipo: ${team.name}`, margin, 140)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(209, 213, 219)
  const leagueLabel = team.leagueName ?? team.leagueSlug
  doc.text(`Liga: ${leagueLabel}  •  ${formatDateEs(generatedAt)}`, margin, 158)

  // ============== TEAM INFO BOX ==============
  y = 210
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.rect(margin, y, contentWidth, 75, "FD")

  doc.setTextColor(17, 24, 39)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text(team.name, margin + 16, y + 28)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(`Liga: ${leagueLabel}`, margin + 16, y + 48)
  doc.text(`Generado: ${formatDateEs(generatedAt)}`, margin + 16, y + 66)

  // ============== STATS CARDS ==============
  y = 310
  const boxW = (contentWidth - 16) / 2
  const cardH = 65

  const stats = [
    { label: "Mensajes", value: String(messages.length), color: [59, 130, 246] },
    { label: "Consideraciones", value: String(last?.considerations.length ?? 0), color: [245, 158, 11] },
  ] as const

  for (const [i, stat] of stats.entries()) {
    const bx = margin + i * (boxW + 16)
    doc.setFillColor(stat.color[0], stat.color[1], stat.color[2])
    doc.rect(bx, y, boxW, cardH, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(20)
    doc.text(stat.value, bx + 14, y + 28)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(stat.label, bx + 14, y + 48)
  }

  y = y + cardH + 35

  // ============== TEAM DIAGNOSIS ==============
  if (last) {
    drawSectionHeader("Diagnóstico del equipo")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(180, 83, 9)
    y = drawWrappedText(`${last.intentEmoji ?? ""} ${last.intentLabel}`, margin, y, contentWidth, 11) + 8

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(55, 65, 81)
    y = drawWrappedText(stripMarkdown(last.analysis), margin, y, contentWidth, 10) + 8

    ensureSpace(40)
    doc.setFillColor(254, 243, 199)
    doc.rect(margin, y, contentWidth, 26, "F")
    doc.setTextColor(146, 64, 14)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text(`Carencia detectada: ${last.gap}`, margin + 10, y + 17)
    y += 40

    if (last.team.topPlayers.length > 0) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(107, 114, 128)
      doc.text(`Jugadores actuales: ${last.team.topPlayers.join(" · ")}`, margin, y)
      y += 24
    }

    y += 6
  }

  // ============== CONSIDERATIONS ==============
  if (last && last.considerations.length > 0) {
    drawSectionHeader("Antes de negociar")

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(55, 65, 81)
    for (const c of last.considerations) {
      ensureSpace(20)
      y = drawWrappedText(`• ${c}`, margin, y, contentWidth, 10) + 5
    }
    y += 6
  }

  // ============== FULL CONVERSATION ==============
  doc.addPage()
  y = margin

  doc.setFillColor(17, 24, 39)
  doc.rect(0, 0, pageWidth, 60, "F")
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 60, pageWidth, 3, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text("Conversación completa", margin, 30)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(156, 163, 175)
  doc.text(`${messages.length} mensajes`, margin, 46)

  y = 90

  if (messages.length === 0) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(10)
    doc.setTextColor(156, 163, 175)
    doc.text("No hay mensajes en esta conversación.", margin, y)
  } else {
    for (const [i, m] of messages.entries()) {
      ensureSpace(60)

      const isUser = m.type === "user"
      const label = isUser ? "Tú" : "Advisor"
      const bgColor = isUser ? [249, 250, 251] as [number, number, number] : [254, 243, 199] as [number, number, number]
      const accentColor = isUser ? [59, 130, 246] as [number, number, number] : [245, 158, 11] as [number, number, number]
      const labelColor = isUser ? "1E40AF" : "92400E"

      doc.setFillColor(...bgColor)
      doc.rect(margin, y, contentWidth, 24, "F")

      doc.setFillColor(...accentColor)
      doc.circle(margin + 14, y + 12, 5, "F")

      doc.setTextColor(labelColor)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text(`${label} · mensaje ${i + 1}`, margin + 26, y + 16)

      y += 34

      const content = m.data ? buildAdvisorText(m.data) : stripMarkdown(m.content)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(55, 65, 81)

      const textLines = content.split("\n")
      for (const line of textLines) {
        if (line.trim()) {
          const indent = /^\s{2,}/.test(line) ? margin + 16 : margin + 8
          y = drawWrappedText(line.trim(), indent, y, contentWidth - 16, 9) + 3
        } else {
          y += 5
        }
      }

      y += 8
    }
  }

  doc.save(buildFileName(team.name, "pdf"))
}

// Word export runs server-side via POST /api/ai-advisor/export-word
// (docx IIFE breaks Turbopack on the client)
