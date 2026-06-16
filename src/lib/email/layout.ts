import { SITE } from "@/lib/site"

/**
 * Email-safe HTML building blocks. Everything uses inline styles, table
 * layout and web-safe fonts so it renders consistently across mail clients
 * (Gmail, Outlook, Apple Mail). Dark, on-brand theme with the court-orange
 * accent (#F2711C).
 */

const ACCENT = "#F2711C"
const BG = "#0a0a09"
const CARD = "#16140f"
const BORDER = "rgba(255,255,255,0.08)"
const TEXT = "#e7e5e4"
const HEADING = "#fafaf9"
const MUTED = "#a8a29e"

/** Escape user-supplied content before interpolating into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function h1(text: string): string {
  return `<h1 style="margin:0 0 14px;font:700 22px/1.3 Arial,Helvetica,sans-serif;color:${HEADING};">${text}</h1>`
}

export function p(text: string): string {
  return `<p style="margin:0 0 16px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:${TEXT};">${text}</p>`
}

export function muted(text: string): string {
  return `<p style="margin:0 0 16px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${text}</p>`
}

/** Bulletproof, table-based CTA button. */
export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:10px;background:${ACCENT};">
    <a href="${url}" style="display:inline-block;padding:13px 26px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#1c1310;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`
}

/** Large, letter-spaced one-time code block. */
export function codeBox(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 20px;"><tr><td align="center" style="padding:18px;background:#0e0d0a;border:1px solid ${BORDER};border-radius:12px;">
    <span style="font:700 32px/1 'Courier New',monospace;letter-spacing:8px;color:${HEADING};">${code}</span>
  </td></tr></table>`
}

/** A labelled key/value line, used in admin notification emails. */
export function field(label: string, value: string): string {
  return `<p style="margin:0 0 10px;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${TEXT};"><span style="color:${MUTED};">${label}:</span> ${value}</p>`
}

/** A quoted block for free-text content (e.g. a contact message). */
export function quote(text: string): string {
  return `<div style="margin:4px 0 20px;padding:14px 16px;background:#0e0d0a;border-left:3px solid ${ACCENT};border-radius:8px;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:${TEXT};white-space:pre-wrap;">${text}</div>`
}

function domain(): string {
  return SITE.url.replace(/^https?:\/\//, "")
}

type RenderInput = {
  /** <title> + hidden preheader shown in the inbox preview line. */
  preview: string
  /** Assembled inner HTML (use the helpers above). */
  content: string
}

export function renderEmail({ preview, content }: RenderInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(preview)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${CARD};border:1px solid ${BORDER};border-radius:18px;overflow:hidden;">
<tr><td style="padding:26px 32px 4px;">
<span style="font:800 19px/1 Arial,Helvetica,sans-serif;color:${HEADING};letter-spacing:-0.02em;">globalhoopstats<span style="color:${ACCENT};">.</span></span>
</td></tr>
<tr><td style="padding:18px 32px 8px;">
${content}
</td></tr>
<tr><td style="padding:18px 32px 28px;border-top:1px solid ${BORDER};">
<p style="margin:14px 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">
${SITE.name} · <a href="${SITE.url}" style="color:${MUTED};text-decoration:underline;">${domain()}</a><br>
Questions? Just reply, or email <a href="mailto:${SITE.contact}" style="color:${MUTED};text-decoration:underline;">${SITE.contact}</a>.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
