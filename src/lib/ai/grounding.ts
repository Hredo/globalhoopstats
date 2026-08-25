/**
 * Numeric grounding: does every figure in the answer come from the data we
 * handed the model?
 *
 * This is the check that actually catches a hallucination. A trade report for
 * Tyrese Maxey (€57.0 M) and Stephen Curry (€54.1 M) came back describing a
 * player worth "€5,2 millones" who grabs "7,6 rebotes" and carries an "injury
 * risk of 0,5" — every one of those numbers invented, none of them anywhere in
 * the block above it. Prose is hard to verify; numbers are not.
 *
 * The rules are deliberately generous, because a good answer rounds: told
 * €1,234,567 it should write "about 1.2 million", and that has to pass. What
 * must not pass is a figure with no relative anywhere in the data.
 */

/** Below this, a number is a count, a squad size, a frame or a jersey number. */
const IGNORE_BELOW = 13
/** A money-sized figure with no source is a hallucination on its own. */
const MONEY_THRESHOLD = 100_000
/** How far off a figure may be and still count as a rounding of a real one. */
const ROUNDING_TOLERANCE = 0.05
/** Under this many unsupported figures we assume paraphrase, not invention. */
const MAX_UNSUPPORTED = 2

const NUMBER_TOKEN =
  /(\d+(?:[.,  ]\d+)*)\s*(%|k\b|m\b|mill(?:on|ón|ones|ion|ions)?\b)?/gi

/**
 * "900.000", "14,2", "1,234.5" and "€8,0 M" all have to come out as one
 * number. The last separator in a token is the decimal point UNLESS it is
 * followed by exactly three digits and the token has more than one group, in
 * which case it is a thousands separator.
 */
function parseNumber(raw: string, unit: string | undefined): number | null {
  const cleaned = raw.replace(/[  ]/g, "")
  if (!/\d/.test(cleaned)) return null

  const groups = cleaned.split(/[.,]/)
  let value: number
  if (groups.length === 1) {
    value = Number(groups[0])
  } else {
    const last = groups[groups.length - 1]
    if (last.length === 3) {
      // Thousands all the way: 900.000, 1,234,567.
      value = Number(groups.join(""))
    } else {
      value = Number(`${groups.slice(0, -1).join("")}.${last}`)
    }
  }
  if (!Number.isFinite(value)) return null

  const u = (unit ?? "").toLowerCase()
  if (u === "k") return value * 1_000
  if (u.startsWith("m")) return value * 1_000_000
  return value
}

/** Every number mentioned in a block of text, in canonical units. */
export function extractFigures(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(NUMBER_TOKEN)) {
    const value = parseNumber(m[1], m[2])
    if (value !== null) out.push(value)
  }
  return out
}

function isSupported(figure: number, sources: number[]): boolean {
  const abs = Math.abs(figure)
  // Small integers are counts, positions, frame numbers, years of contract.
  if (abs < IGNORE_BELOW && Number.isInteger(figure)) return true
  // A year is not a claim about our data.
  if (Number.isInteger(figure) && abs >= 1900 && abs <= 2100) return true

  return sources.some((source) => {
    if (source === figure) return true
    const scale = Math.max(Math.abs(source), 1)
    if (Math.abs(source - figure) / scale <= ROUNDING_TOLERANCE) return true
    // "€900 K" in the data, "0,9 millones" in the answer, and the reverse.
    return (
      Math.abs(source - figure * 1_000) / Math.max(scale, 1) <= ROUNDING_TOLERANCE ||
      Math.abs(source - figure / 1_000) / Math.max(scale, 1) <= ROUNDING_TOLERANCE
    )
  })
}

/**
 * Figures in the answer that appear nowhere in the data, in any rounding.
 * Exported so a caller can log what was wrong, not just that it was.
 */
export function unsupportedFigures(answer: string, data: string): number[] {
  const sources = extractFigures(data)
  if (sources.length === 0) return []
  return extractFigures(answer).filter((f) => !isSupported(f, sources))
}

/**
 * Is the answer inventing numbers?
 *
 * One stray figure is usually a paraphrase we failed to trace (a difference
 * the model worked out, a percentage it restated). A money-sized figure with
 * no source, or several unsupported figures at once, is not.
 *
 * Do NOT run this on an answer from a model that searched the web: a cited
 * salary or a transfer fee from a news article is legitimately absent from our
 * data, and rejecting it would punish the better engines.
 */
export function inventsFigures(answer: string, data: string): boolean {
  const unsupported = unsupportedFigures(answer, data)
  if (unsupported.some((f) => Math.abs(f) >= MONEY_THRESHOLD)) return true
  return unsupported.length >= MAX_UNSUPPORTED
}


/**
 * Did the model transcribe the data block instead of analysing it?
 *
 * A scouting note for Darius Garland came back as this, and nothing rejected
 * it: "En la pista: * Pintura: 53.7% (158 goles de 294) * Lateral izquierdo
 * (2PT): 62,5% (10 goles de 16) …" — the shot-zone table copied out, then
 * copied out a second time under a different heading, and a closing line
 * asking the coach to send more information. Every figure in it was real, so
 * `inventsFigures` passed it; the labels were translated, so the shingle check
 * for echoed instructions never matched either. What was missing was any
 * judgement at all.
 *
 * Numbers per word is what separates the two. A note that says "he is a
 * 53.7% finisher in the paint but disappears from the right wing" quotes two
 * figures in a paragraph. A transcription quotes twenty in the same space —
 * and it does it whatever language it translates the labels into, which is why
 * this counts figures rather than words.
 */

/** Fewer figures than this and there is no dump to detect, whatever the ratio. */
const MIN_DUMP_FIGURES = 10
/** Figures per hundred words. A dense but genuine paragraph sits near three. */
const MAX_FIGURES_PER_100_WORDS = 8
/** `Left corner (3PT): 44.2% (38/86)` — a table row wearing a sentence's clothes. */
const DATA_ROW = /^\s*(?:[-*•>]|\d+[.)])?\s*[^:\n]{1,48}:\s*[^\n]*\d/
/** Enough rows that the shape is the answer, not a stray line inside one. */
const MAX_DATA_ROWS = 4

export function isDataDump(text: string): boolean {
  // A markdown table is a legitimate way to compare the same three numbers
  // across three players, and the house style allows exactly that. It is also
  // dense by design, so judging density on it would reject the good case
  // along with the bad one.
  const prose = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*\|/.test(line))
    .join("\n")

  const words = prose.split(/\s+/).filter(Boolean).length
  if (words === 0) return false

  const figures = extractFigures(prose).length
  if (
    figures >= MIN_DUMP_FIGURES &&
    (figures * 100) / words > MAX_FIGURES_PER_100_WORDS
  ) {
    return true
  }

  // A model can also dump without being number-dense — the playbook breakdown
  // came back as one "Frame N — …" paragraph per frame, restating the
  // coordinates it had been given. Rows of `label: value` are that shape.
  const rows = prose.split(/\r?\n/).filter((line) => DATA_ROW.test(line)).length
  return rows > MAX_DATA_ROWS
}
