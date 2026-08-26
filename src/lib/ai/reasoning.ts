/**
 * Take a model's internal reasoning out of its answer.
 *
 * Every reasoning-capable model — a Qwen3 or a DeepSeek-R1 distill on the
 * owner's local Ollama, gpt-oss on Groq, Magistral, Kimi — writes its scratch
 * work before the answer and marks it. Nothing in this codebase looked for
 * those marks, so the scratch work went to the screen: a coach who typed
 * "hola" was shown five paragraphs of the model talking to itself in English
 * ("Analyze User Input… Check against constraints… ✅") and then, at the
 * bottom, the one line that was actually meant for them.
 *
 * That is the single biggest reason the product "doesn't answer like an LLM":
 * every other chat app strips this and we did not, on any surface.
 *
 * It has to happen at the PROVIDER BOUNDARY (`chat.ts`), not per surface —
 * the advisor, the player report, compare, trade and the playbook all read the
 * same field, and the JSON paths break outright when a `<think>` block is
 * glued to the front of the document.
 *
 * Three shapes, because vendors did not agree on one:
 *   - XML-ish tags: `<think>…</think>` and its dozen synonyms.
 *   - OpenAI Harmony channels (gpt-oss): the answer is the `final` channel.
 *   - CJK bracket tags (Kimi): `◁think▷…◁/think▷`.
 *
 * Anything unpaired is treated as reasoning too, which matters more than it
 * sounds: a model that hits the token cap mid-thought emits an opener and no
 * closer, and the "answer" is then 900 tokens of deliberation with no
 * conclusion. Better to return nothing and let the caller say so.
 */

/**
 * Tag names models use for the part the reader is not meant to see.
 *
 * `analysis` and `plan` are in here because gpt-oss and a few Qwen fine-tunes
 * use them as literal tags. The risk of a basketball answer containing a
 * literal `<analysis>` element is not a real one.
 */
const REASONING_TAGS = [
  "think",
  "thinking",
  "thought",
  "thoughts",
  "reason",
  "reasoning",
  "reflection",
  "reflect",
  "scratchpad",
  "scratch_pad",
  "analysis",
  "monologue",
  "inner_monologue",
  "internal",
  "plan",
].join("|")

/** `<think>…</think>`, any attributes, any casing, spanning lines. */
const PAIRED = new RegExp(
  `<\\s*(${REASONING_TAGS})(?:\\s[^>]*)?>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`,
  "gi",
)

/** An opener with no closer: the model ran out of budget mid-thought. */
const DANGLING_OPEN = new RegExp(
  `<\\s*(?:${REASONING_TAGS})(?:\\s[^>]*)?>[\\s\\S]*$`,
  "i",
)

/**
 * A closer with no opener. Common: several providers strip the opening tag
 * when they stream the reasoning on a separate field, and leave the closing
 * one in the text.
 */
const DANGLING_CLOSE = new RegExp(
  `^[\\s\\S]*<\\s*/\\s*(?:${REASONING_TAGS})\\s*>`,
  "i",
)

/** Kimi and a few others mark the block with full-width brackets. */
const CJK_PAIRED = /◁\s*(think|thinking)\s*▷[\s\S]*?◁\s*\/\s*\1\s*▷/gi
const CJK_DANGLING_OPEN = /◁\s*(?:think|thinking)\s*▷[\s\S]*$/i
const CJK_DANGLING_CLOSE = /^[\s\S]*◁\s*\/\s*(?:think|thinking)\s*▷/i

/** Square-bracket variant emitted by some local GGUF chat templates. */
const BRACKET_PAIRED = /\[\s*(THINK|THINKING|REASONING)\s*\][\s\S]*?\[\s*\/\s*\1\s*\]/gi

/**
 * OpenAI Harmony, used by gpt-oss: the response is a sequence of channels and
 * only `final` is for the reader. Everything before the last `final` message
 * is deliberation, tool traffic or a discarded draft.
 */
const HARMONY_FINAL = /<\|channel\|>\s*final\s*<\|message\|>/gi
/** Leftover Harmony control tokens once the final channel has been isolated. */
const HARMONY_TOKENS = /<\|[a-z_]+\|>/gi

/**
 * Everything after the last `final` channel marker, or null when the model
 * never opened one.
 */
function harmonyFinal(text: string): string | null {
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  HARMONY_FINAL.lastIndex = 0
  while ((m = HARMONY_FINAL.exec(text)) !== null) last = m
  if (!last) return null
  return text.slice(last.index + last[0].length)
}

export type ReasoningSplit = {
  /** What the reader is meant to see. Empty when it was all reasoning. */
  answer: string
  /** True when something was actually removed. Logged, never shown. */
  hadReasoning: boolean
}

/**
 * Split a raw completion into the answer and the scratch work.
 *
 * Safe to run on structured output as well as prose: a `<think>` block in
 * front of a JSON document is exactly what breaks `JSON.parse`, and removing
 * it is what the playbook photo import needs too.
 */
export function splitReasoning(raw: string): ReasoningSplit {
  if (!raw) return { answer: "", hadReasoning: false }

  // Harmony first: its markers wrap the tag forms rather than the other way
  // round, so isolating the final channel is what makes the rest tractable.
  const final = harmonyFinal(raw)
  let text = final ?? raw

  text = text
    .replace(PAIRED, "")
    .replace(CJK_PAIRED, "")
    .replace(BRACKET_PAIRED, "")

  // Order matters. A closer left behind means the reasoning came FIRST and its
  // opener is missing, so the answer is what follows. An opener left behind
  // means the reasoning never ended, so there is no answer after it.
  if (DANGLING_CLOSE.test(text)) text = text.replace(DANGLING_CLOSE, "")
  if (CJK_DANGLING_CLOSE.test(text)) text = text.replace(CJK_DANGLING_CLOSE, "")
  if (DANGLING_OPEN.test(text)) text = text.replace(DANGLING_OPEN, "")
  if (CJK_DANGLING_OPEN.test(text)) text = text.replace(CJK_DANGLING_OPEN, "")

  if (final !== null) text = text.replace(HARMONY_TOKENS, "")

  const answer = text.replace(/\n{3,}/g, "\n\n").trim()
  return { answer, hadReasoning: answer !== raw.trim() }
}

/** The answer alone. Convenience wrapper for callers that discard the flag. */
export function stripReasoning(raw: string): string {
  return splitReasoning(raw).answer
}
