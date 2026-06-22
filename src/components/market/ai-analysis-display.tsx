"use client"

import type { ReactNode } from "react"

/** Render inline **bold** spans inside a line of AI text. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink-50">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

/**
 * Lightweight Markdown renderer for the trade AI analyses. Handles the subset
 * the prompts actually emit: ## / ### headings, "- " bullet lists, **bold**,
 * and plain paragraphs — without pulling in a full markdown dependency.
 */
export function AiAnalysisDisplay({ text }: { text: string }) {
  const lines = text.split("\n")
  const blocks: ReactNode[] = []
  let listItems: string[] = []

  const flushList = (key: string) => {
    if (listItems.length === 0) return
    const items = listItems
    listItems = []
    blocks.push(
      <ul key={key} className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-ink-200">
            <span
              aria-hidden
              className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-400"
            />
            <span>{renderInline(it)}</span>
          </li>
        ))}
      </ul>,
    )
  }

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) {
      flushList(`fl-${i}`)
      return
    }
    if (line.startsWith("### ")) {
      flushList(`fl-${i}`)
      blocks.push(
        <p key={i} className="pt-1 text-sm font-semibold text-ink-50">
          {renderInline(line.slice(4))}
        </p>,
      )
      return
    }
    if (line.startsWith("## ")) {
      flushList(`fl-${i}`)
      blocks.push(
        <p key={i} className="pt-1 text-[15px] font-bold text-ink-50">
          {renderInline(line.slice(3))}
        </p>,
      )
      return
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(line.slice(2))
      return
    }
    // A line that is entirely bold acts as a sub-heading.
    if (/^\*\*[^*]+\*\*:?$/.test(line)) {
      flushList(`fl-${i}`)
      blocks.push(
        <p key={i} className="pt-1 font-semibold text-ink-50">
          {line.replace(/\*\*/g, "").replace(/:$/, "")}
        </p>,
      )
      return
    }
    flushList(`fl-${i}`)
    blocks.push(
      <p key={i} className="text-ink-200">
        {renderInline(line)}
      </p>,
    )
  })
  flushList("fl-end")

  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink-200">{blocks}</div>
  )
}
