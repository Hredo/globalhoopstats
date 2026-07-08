import type { ReactNode } from "react"

const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g

const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/

/**
 * Render a single span of text with inline markdown support: `**bold**`,
 * `*italic*`, `` `code` `` and `[text](url)` links. Plain text passes through
 * unchanged, so this is safe to call on strings that may or may not contain
 * markdown.
 *
 * Block-level markdown (headings, lists, tables) is intentionally not handled
 * here — see `parseMarkdown` in message-bubble.tsx for that.
 */
export function renderInline(text: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN)
  return parts.map((part, i) => {
    if (!part) return null
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
