"use client"

import type { ReactNode } from "react"
import { renderInline } from "@/app/ai-advisor/inline-markdown"

/**
 * One markdown renderer for every AI answer in the product.
 *
 * There used to be two, and neither rendered what a model actually writes. The
 * chat parser handled `#`, `##` and `###` but nothing deeper, so a `####` line
 * reached the reader with its hashes still attached; it injected an emoji chip
 * next to every `##` heading (picked by matching ENGLISH keywords, so Spanish
 * answers silently got none); and it turned any `### Name — meta` line into an
 * avatar card, which is why an ordinary heading sometimes came out as a player
 * badge. The panel renderer, meanwhile, had no ordered lists, no tables and no
 * code, and promoted every `**Label** text` line into a bulleted row.
 *
 * The rule here is the boring one: render markdown as markdown. Headings are
 * headings, paragraphs have air between them, lists nest, tables scroll, and
 * nothing is decorated that the model did not ask for.
 */

type ListNode = { ordered: boolean; items: ListItemNode[] }
type ListItemNode = { content: string; child: ListNode | null }

type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4; content: string }
  | { type: "p"; content: string }
  | { type: "list"; list: ListNode }
  | { type: "quote"; lines: string[] }
  | { type: "code"; code: string; lang: string | null }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^(\s*)[-*•]\s+(.+)$/
const ORDERED = /^(\s*)\d+[.)]\s+(.+)$/
const QUOTE = /^\s*>\s?(.*)$/
const FENCE = /^\s*```+\s*([A-Za-z0-9+#-]*)\s*$/
const RULE = /^\s*(?:[-*_]\s*){3,}$/

function indentOf(line: string): number {
  const m = /^(\s*)/.exec(line)
  return m ? m[1].replace(/\t/g, "  ").length : 0
}

function isListLine(line: string): boolean {
  return BULLET.test(line) || ORDERED.test(line)
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim())
  if (cells.length === 0 || cells.every((c) => c === "")) return null
  return cells
}

function isSeparatorRow(cells: string[] | null): boolean {
  return cells !== null && cells.every((c) => /^:?-{1,}:?$/.test(c))
}

/**
 * Consume one list (and any lists nested under its items), returning the node
 * and the index of the first line that is not part of it.
 *
 * Nesting is decided by indentation against the list's own first item, which
 * is what models emit — two spaces, four spaces or a tab, all of which land on
 * the same branch here.
 */
function parseList(lines: string[], start: number): [ListNode, number] {
  const first = lines[start]
  const base = indentOf(first)
  const ordered = ORDERED.test(first)
  const items: ListItemNode[] = []
  let i = start

  while (i < lines.length) {
    const line = lines[i]
    if (!isListLine(line)) break
    const indent = indentOf(line)
    if (indent < base) break
    if (indent >= base + 2) {
      // Deeper than our own items: it belongs to the item we just added.
      const [child, next] = parseList(lines, i)
      const last = items[items.length - 1]
      if (last && !last.child) last.child = child
      i = next
      continue
    }
    // A bullet where we are collecting numbers (or the reverse) starts a new
    // list rather than joining this one.
    if (ORDERED.test(line) !== ordered) break
    const m = BULLET.exec(line) ?? ORDERED.exec(line)
    if (!m) break
    items.push({ content: m[2].trim(), child: null })
    i++
  }

  return [{ ordered, items }, i]
}

export function parseMarkdown(text: string): Block[] {
  const lines = text.split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      i++
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const lang = fence[1] || null
      const body: string[] = []
      i++
      while (i < lines.length && !FENCE.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      i++ // closing fence (or end of input)
      blocks.push({ type: "code", code: body.join("\n"), lang })
      continue
    }

    // Checked before the bullet rule: "***" and "- - -" are rules, not lists.
    if (RULE.test(line)) {
      blocks.push({ type: "hr" })
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      // h5/h6 are vanishingly rare and would render smaller than body text;
      // clamping keeps them readable instead of dropping them.
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4
      const content = heading[2].trim()
      if (content) blocks.push({ type: "heading", level, content })
      i++
      continue
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = []
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push((QUOTE.exec(lines[i]) as RegExpExecArray)[1])
        i++
      }
      blocks.push({ type: "quote", lines: quoted })
      continue
    }

    const headerCells = parseTableRow(line)
    if (headerCells && isSeparatorRow(parseTableRow(lines[i + 1] ?? ""))) {
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length) {
        const r = parseTableRow(lines[j])
        if (!r || isSeparatorRow(r)) break
        rows.push(r)
        j++
      }
      blocks.push({ type: "table", headers: headerCells, rows })
      i = j
      continue
    }

    if (isListLine(line)) {
      const [list, next] = parseList(lines, i)
      blocks.push({ type: "list", list })
      i = next
      continue
    }

    // Paragraph: soft-wrapped lines belong together, anything structural ends it.
    const para: string[] = [line.trim()]
    i++
    while (i < lines.length) {
      const next = lines[i]
      if (next.trim() === "") break
      if (
        HEADING.test(next) ||
        isListLine(next) ||
        QUOTE.test(next) ||
        FENCE.test(next) ||
        RULE.test(next) ||
        parseTableRow(next)
      )
        break
      para.push(next.trim())
      i++
    }
    blocks.push({ type: "p", content: para.join(" ") })
  }

  return blocks
}

/** Body text size. The chat reads at 15px; side panels sit at 14px. */
export type MarkdownSize = "chat" | "panel"

const BODY: Record<MarkdownSize, string> = {
  chat: "text-[15px] leading-relaxed",
  panel: "text-sm leading-relaxed",
}

const HEADING_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "mt-5 mb-2 text-[1.15em] font-semibold tracking-tight text-ink-50 first:mt-0",
  2: "mt-5 mb-2 text-[1.08em] font-semibold tracking-tight text-ink-50 first:mt-0",
  3: "mt-4 mb-1.5 text-[1em] font-semibold text-ink-50 first:mt-0",
  4: "mt-3 mb-1 text-[0.95em] font-semibold text-ink-100 first:mt-0",
}

function List({ list, depth }: { list: ListNode; depth: number }) {
  const Tag = list.ordered ? "ol" : "ul"
  const marker = list.ordered
    ? "list-decimal marker:font-medium marker:text-ink-400"
    : depth === 0
      ? "list-disc marker:text-ink-400"
      : "list-[circle] marker:text-ink-400"
  return (
    <Tag className={`${marker} space-y-1 pl-[1.4em] ${depth === 0 ? "my-3" : "mt-1"}`}>
      {list.items.map((item, i) => (
        <li key={i} className="pl-0.5">
          {renderInline(item.content)}
          {item.child ? <List list={item.child} depth={depth + 1} /> : null}
        </li>
      ))}
    </Tag>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-ink-700/60">
      <table className="w-full text-[0.9em]">
        <thead>
          <tr className="bg-ink-900/60">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-ink-700/60 px-2.5 py-1.5 text-left font-semibold text-ink-200"
              >
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-ink-700/40 last:border-b-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-2.5 py-1.5 align-top text-ink-100">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Block({ block }: { block: Block }): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = (["h1", "h2", "h3", "h4"] as const)[block.level - 1]
      return (
        <Tag className={HEADING_CLASS[block.level]}>
          {renderInline(block.content)}
        </Tag>
      )
    }
    case "p":
      return <p className="my-3 first:mt-0 last:mb-0">{renderInline(block.content)}</p>
    case "list":
      return <List list={block.list} depth={0} />
    case "quote":
      return (
        <blockquote className="my-3 border-l-2 border-ink-600 pl-3 text-ink-300 italic">
          {block.lines.map((l, i) => (
            <p key={i} className="my-1">
              {renderInline(l)}
            </p>
          ))}
        </blockquote>
      )
    case "code":
      return (
        <pre className="my-3 overflow-x-auto rounded-lg border border-ink-700/60 bg-ink-900/70 p-3">
          <code className="font-mono text-[0.85em] text-ink-100">{block.code}</code>
        </pre>
      )
    case "table":
      return <Table headers={block.headers} rows={block.rows} />
    case "hr":
      return <hr className="my-4 border-ink-700/60" />
  }
}

/**
 * Render a model's answer. `size` only sets the body text scale — everything
 * else is sized in `em`, so the same answer keeps its proportions in the chat
 * and in a side panel.
 */
export function AiMarkdown({
  text,
  size = "chat",
}: {
  text: string
  size?: MarkdownSize
}) {
  const blocks = parseMarkdown(text)
  return (
    <div className={`${BODY[size]} text-ink-100`}>
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  )
}
