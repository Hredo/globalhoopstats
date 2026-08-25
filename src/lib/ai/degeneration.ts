/**
 * Repetition-loop guard for model output.
 *
 * Small models (a local 8B, the fast hosted ones) fall into degeneration:
 * they lock onto a phrase and repeat it until they hit the token cap —
 * "de tiro de tiro de tiro…" — or they re-emit the same heading twenty times
 * with nothing under it. It is not a prompt bug and no wording prevents it;
 * the sampler is what stops it (see the penalties in chat.ts) and this is the
 * net that catches whatever still gets through.
 *
 * We cut the answer at the point it started looping and keep what came before,
 * because the first paragraphs are usually fine — that is far better than
 * showing the user a wall of the same four words.
 */

export type GuardedOutput = {
  /** The answer, cut at the point the model started repeating itself. */
  text: string
  /** True when a loop was found and removed. */
  looped: boolean
}

/** A line has to carry real content before its repeats mean anything. */
const MIN_LOOP_LINE_CHARS = 16
/** Longest phrase we look for. Beyond this a "loop" is just a long quote. */
const MAX_PHRASE_WORDS = 8
/** How many times a phrase must repeat back-to-back to count as a loop. */
const MIN_PHRASE_REPEATS = 3
/** A single word has to stutter harder than that to be a loop. */
const MIN_WORD_REPEATS = 6

/** Strip markdown furniture and punctuation so "## X" and "#### X." match. */
function normaliseLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/[*_`#>]/g, "")
    .replace(/[.,;:!¡?¿()[\]—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Character offset of the third occurrence of a repeated line, or -1.
 *
 * Occurrences do not have to be consecutive: the failure mode we saw scattered
 * the same heading down the whole answer with blank runs in between.
 */
function findRepeatedLine(text: string): number {
  const seen = new Map<string, number>()
  let offset = 0
  for (const line of text.split("\n")) {
    const key = normaliseLine(line)
    if (key.length >= MIN_LOOP_LINE_CHARS) {
      const count = (seen.get(key) ?? 0) + 1
      seen.set(key, count)
      if (count >= 3) return offset
    }
    offset += line.length + 1
  }
  return -1
}

type Token = { word: string; index: number }

/**
 * Words only. Punctuation is dropped so that a markdown table separator
 * ("| --- | --- | --- |") is not mistaken for a three-times-repeated phrase.
 */
function tokenise(text: string): Token[] {
  const out: Token[] = []
  const re = /[\p{L}\p{N}][\p{L}\p{N}'%.,]*/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ word: m[0].toLowerCase(), index: m.index })
  }
  return out
}

function phraseEquals(
  tokens: Token[],
  a: number,
  b: number,
  length: number,
): boolean {
  for (let k = 0; k < length; k++) {
    if (tokens[a + k].word !== tokens[b + k].word) return false
  }
  return true
}

/**
 * Character offset just after the FIRST occurrence of a phrase that then
 * repeats back-to-back, or -1. Keeping the first occurrence matters: the
 * sentence usually reads correctly right up to the moment it derails.
 */
function findRepeatedPhrase(text: string): number {
  const tokens = tokenise(text)
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= MAX_PHRASE_WORDS; n++) {
      if (i + n * 2 > tokens.length) break
      let reps = 1
      while (
        i + n * (reps + 1) <= tokens.length &&
        phraseEquals(tokens, i, i + n * reps, n)
      ) {
        reps++
      }
      const needed = n === 1 ? MIN_WORD_REPEATS : MIN_PHRASE_REPEATS
      if (reps >= needed) return tokens[i + n].index
    }
  }
  return -1
}

/**
 * Cutting mid-loop leaves a half-finished sentence. Fall back to the last
 * sentence that did end — unless that throws away most of the answer, in
 * which case an ellipsis is the lesser evil.
 */
function tidyTail(text: string): string {
  const trimmed = text
    .replace(/\s+$/, "")
    // A heading or bold label with nothing under it is the start of the loop.
    .replace(/\n+\s*(#{1,6}\s*|\*\*)[^\n]*$/, "")
    .trimEnd()
  const lastStop = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("!"),
    trimmed.lastIndexOf("?"),
    trimmed.lastIndexOf("\n"),
  )
  if (lastStop > trimmed.length * 0.5) return trimmed.slice(0, lastStop + 1).trimEnd()
  return trimmed.length > 0 ? `${trimmed}…` : trimmed
}

/**
 * Run before showing any model-written PROSE to a user. Not for structured
 * output (the playbook photo import parses JSON, where repeated lines are
 * normal and legal).
 */
export function trimDegeneratedOutput(raw: string): GuardedOutput {
  // Blank-line spam is the same illness in a milder form, and it is what turns
  // one broken answer into three screens of scrolling.
  const text = raw.replace(/\n{3,}/g, "\n\n").trimEnd()

  const cuts = [findRepeatedLine(text), findRepeatedPhrase(text)].filter(
    (c) => c >= 0,
  )
  if (cuts.length === 0) return { text, looped: false }

  return { text: tidyTail(text.slice(0, Math.min(...cuts))), looped: true }
}

/**
 * Did enough survive the cut to be worth showing? Only asked when we actually
 * cut something — a follow-up ("Sí, entra en tu presupuesto.") is legitimately
 * short, and must not be thrown away for it.
 */
export function isUsableAnswer(text: string): boolean {
  return text.trim().length >= 120
}

/** How many words make a shingle long enough that a match is not a coincidence. */
const ECHO_SHINGLE_WORDS = 6
/** How many distinct shingles have to match before we call it an echo. */
const MIN_ECHO_SHINGLES = 2

function shingles(text: string, size: number): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    const out = new Set<string>()
  for (let i = 0; i + size <= words.length; i++) {
    out.add(words.slice(i, i + size).join(" "))
  }
  return out
}

/**
 * Did the model answer with our own instructions instead of with an answer?
 *
 * The compare surface shipped this to a user: "Primero, voy a analizar algunos
 * datos… Prose sencillo solo: no listas, no encabezados, no negrita" — a
 * translated paraphrase of the brief, presented as the analysis. It happens
 * when instructions sit in the USER turn, where a small model reads them as
 * material to work with rather than as orders. The fix is to put them in the
 * system prompt; this is the net for when one still comes back.
 *
 * Pass ONLY the instruction text, never the data block: an answer is supposed
 * to reuse the data's wording, and would trip this on every call.
 */
export function echoesInstructions(answer: string, instructions: string): boolean {
  const fromPrompt = shingles(instructions, ECHO_SHINGLE_WORDS)
  if (fromPrompt.size === 0) return false
  let hits = 0
  for (const s of shingles(answer, ECHO_SHINGLE_WORDS)) {
    if (fromPrompt.has(s) && ++hits >= MIN_ECHO_SHINGLES) return true
  }
  return false
}

/**
 * Does the answer actually talk about the people it was given?
 *
 * A trade report came back about "Tyrese Baskets (Paso 1)" and "Harrison
 * Barnes" for a deal involving Tyrese Maxey and Stephen Curry, with every euro
 * figure invented. An answer that never names a single one of its subjects is
 * not about them, whatever else it says.
 *
 * Matched on the SURNAME, because that is the identifying half: models shorten
 * "Stephen Curry" to "Curry" constantly and that is a correct answer, while
 * the failure we are catching kept the first name and invented the rest
 * ("Tyrese Maxey" came back as "Tyrese Baskets"). A first name on its own is
 * not evidence the answer is about the right player.
 */
function surname(fullName: string): string | null {
  const parts = fullName
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.replace(/[^\p{L}\p{N}]/gu, "").length >= 3)
  return parts.length > 0 ? parts[parts.length - 1] : null
}

export function mentionsAnySubject(answer: string, names: string[]): boolean {
  if (names.length === 0) return true
  const haystack = answer.toLowerCase()
  const surnames = names
    .map(surname)
    .filter((s): s is string => s !== null)
  // Nothing usable to match on is not evidence of a bad answer.
  if (surnames.length === 0) return true
  return surnames.some((s) => haystack.includes(s))
}

/** Below this we are not looking at a structured answer, just a heading or two. */
const MIN_HEADINGS_TO_JUDGE = 3

/**
 * The other way a weak model fails: instead of answering, it restates the
 * question as a heading, then again with a different number of hashes, and
 * again — an outline of an answer it never writes. Headings outnumbering
 * paragraphs is the tell.
 */
export function isMostlyHeadings(text: string): boolean {
  let headings = 0
  let prose = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.length === 0 || /^[-*_]{3,}$/.test(line)) continue
    if (/^#{1,6}\s/.test(line)) headings++
    else prose++
  }
  return headings >= MIN_HEADINGS_TO_JUDGE && headings > prose
}
