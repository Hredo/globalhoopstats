import type { ReactNode } from "react"

// `***both***` must come first: the `**bold**` alternative cannot match it
// (its inner class excludes `*`), so without this the outer markers were left
// on screen as literal asterisks.
const INLINE_PATTERN =
  /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g

const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/

/**
 * Render a single span of text with inline markdown support: `***both***`,
 * `**bold**`, `*italic*`, `` `code` `` and `[text](url)` links. Plain text
 * passes through unchanged, so this is safe to call on strings that may or may
 * not contain markdown — a lone asterisk in prose ("1,2 M€ * 3 años") stays a
 * lone asterisk rather than swallowing the rest of the sentence.
 *
 * Block-level markdown (headings, lists, tables) is intentionally not handled
 * here — see `parseMarkdown` in message-bubble.tsx for that.
 */
export function renderInline(text: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith("***") && part.endsWith("***")) {
      return (
        <strong key={i}>
          <em>{part.slice(3, -3)}</em>
        </strong>
      )
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 1) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-ink-900/80 px-1 py-0.5 font-mono text-[0.85em] text-brand-200"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    const linkMatch = part.match(LINK_PATTERN)
    if (linkMatch) {
      const [, linkText, linkUrl] = linkMatch
      return (
        <a
          key={i}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-300 underline decoration-brand-500/30 underline-offset-2 transition hover:text-brand-200 hover:decoration-brand-500/60"
        >
          {linkText}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}
