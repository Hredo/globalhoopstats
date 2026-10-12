/**
 * Turning scraped HTML fragments into plain text. Shared by every adapter that
 * reads a table cell or link label so the two classic mistakes live nowhere:
 *
 * - Entities are decoded in ONE pass. Chained `.replace(/&amp;/…).replace(/&lt;/…)`
 *   turns `&amp;lt;` into `<` (double unescaping).
 * - Tags are stripped until nothing tag-shaped is left and any stray `<` goes,
 *   so `<scr<script>ipt>` can't reassemble into a tag after one pass.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  ccedil: "ç",
  Ccedil: "Ç",
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole
    }
    return NAMED[body] ?? whole
  })
}

export function stripTags(s: string, replacement = ""): string {
  let out = s
  let prev: string
  do {
    prev = out
    out = out.replace(/<[^<>]*>/g, replacement)
  } while (out !== prev)
  return out.replace(/[<>]/g, replacement)
}
