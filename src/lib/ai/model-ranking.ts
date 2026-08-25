/**
 * Ordering and filtering for a provider's LIVE model list.
 *
 * Two things were wrong with treating a `/models` response as a list. It
 * carries everything the vendor serves — embeddings, speech, image, moderation
 * and rerank models that would 400 the moment you sent them a chat request —
 * and it came back sorted alphabetically, which puts `gpt-3.5-turbo` above
 * `gpt-5`. A user asked to "pick a model" was being shown retired ones first.
 *
 * Nothing here hardcodes a model id. That is the point: the catalogue in
 * `providers.ts` has gone stale twice and broken the AI both times, so the
 * rules are about the SHAPE of an id — its version number, its tier word, its
 * parameter count — and a vendor shipping something new next week sorts to the
 * top on its own.
 */
import type { AiModel } from "@/lib/ai/providers"

/**
 * Model families that cannot answer a chat request. Matched on the id, which
 * is the only thing every provider's list agrees on.
 */
const NOT_CHAT =
  /(?:^|[-_/])(?:embed|embedding|embeddings|tts|stt|whisper|transcribe|audio|speech|voice|image|images|dall-?e|vision-encoder|moderation|guard|safety|rerank|reranker|search-index|code-?interpreter|clip|sd\d|stable-?diffusion|flux|imagen|veo|sora)(?:[-_/]|$)/i

/** Marked as not-for-production by the vendor's own naming. */
const UNSTABLE = /(?:^|[-_.])(?:alpha|nightly|test|deprecated|legacy)(?:[-_.]|$)/i

/**
 * Tier words, ordered by how capable the model usually is inside its own
 * family. The middle tier scores highest on purpose: the auto-pick should land
 * on the vendor's balanced flagship, not on the one that costs ten times more
 * per token. A user who wants the expensive one picks it themselves.
 */
const TIER: Array<[RegExp, number]> = [
  // Parameter counts used to be listed here (`8b|4b|1b|3b`), which caught the
  // four sizes somebody happened to think of and missed `7b`, `9b`, `2b`. Size
  // is a number, `paramsOf` already reads it, and `sizeScore` now judges it.
  [/(?:^|[-_.])(?:mini|nano|tiny|lite|small|flash-?lite|haiku|instant)(?:[-_.:]|$)/i, -6],
  [/(?:^|[-_.])(?:flash|turbo|fast|scout)(?:[-_.:]|$)/i, -2],
  [/(?:^|[-_.])(?:pro|opus|max|ultra|large|premier|405b|671b)(?:[-_.:]|$)/i, 2],
  [/(?:^|[-_.])(?:sonnet|flagship|standard|medium|maverick)(?:[-_.:]|$)/i, 4],
]

/** A preview of something new still beats a stable model two versions old. */
const PREVIEW = /(?:^|[-_.])(?:preview|exp|experimental|rc\d*|beta)(?:[-_.]|$)/i

/** Can this id plausibly answer a chat request? */
export function isChatModel(id: string): boolean {
  if (!id) return false
  if (NOT_CHAT.test(id)) return false
  if (UNSTABLE.test(id)) return false
  return true
}

/**
 * The biggest version number in an id: `gpt-5.5` → 5.5, `claude-sonnet-5` → 5,
 * `gemini-3.5-flash` → 3.5, `llama3.1:8b` → 3.1.
 *
 * Two conventions have to be reconciled. Anthropic writes a decimal with a
 * dash — `claude-3-5-sonnet` is version 3.5, not 3 and 5 — while newer ids put
 * a bare major at the end (`claude-sonnet-5`). Read naively, the first scores
 * a 5 from its own separator and the retired 3.5 Sonnet sorts above Sonnet 5.
 *
 * Parameter counts (`70b`, `8x22b`) and release dates are stripped first: both
 * are numbers, neither is a version, and either would dwarf every real one.
 */
export function versionOf(id: string): number {
  const stripped = id
    .replace(/(20\d{2})-?\d{2}-?\d{2}/g, " ")
    .replace(/\b\d+x\d+b\b/gi, " ")
    .replace(/(?:^|[-_.:])\d{1,4}b\b/gi, " ")
    // Mixture-of-experts counts: `llama-4-scout-17b-16e`, `maverick-…-128e`.
    // Left in, the scout read as version SIXTEEN and outranked everything any
    // vendor has ever shipped.
    .replace(/(?:^|[-_.:])\d{1,4}e\b/gi, " ")
  // "3-5-sonnet" → "3.5-sonnet", so the pair reads as the decimal it is.
  const normalised = stripped.replace(/(?<![\d.])(\d)-(\d)(?![\d])/g, "$1.$2")

  let best = 0
  // The digit run has to be WHOLE. `\d{1,2}` on its own happily matches the
  // "12" inside "128", so a 128-expert model came back as version 12.
  for (const m of normalised.matchAll(/(?<![\d.])\d{1,2}(?:\.\d{1,2})?(?![\d])/g)) {
    const n = Number(m[0])
    // A context length is not a version either.
    if (Number.isFinite(n) && n > best && n < 100) best = n
  }
  return best
}

/** A release date stamp in the id: `-20250219`, `-2025-02-19`, `-2504`. */
export function dateStampOf(id: string): number {
  const full = id.match(/(20\d{2})-?(\d{2})-?(\d{2})/)
  if (full) return Number(`${full[1]}${full[2]}${full[3]}`)
  const short = id.match(/(?:^|[-_.])(\d{2})(\d{2})(?:[-_.]|$)/)
  // "2504" = April 2025. Only plausible month values, or every "1234" matches.
  if (short && Number(short[2]) >= 1 && Number(short[2]) <= 12) {
    return Number(`20${short[1]}${short[2]}01`)
  }
  return 0
}

/** Parameter count in billions, for local tags like `llama3.1:70b`. */
export function paramsOf(id: string): number {
  const moe = id.match(/(\d+)x(\d+)b\b/i)
  if (moe) return Number(moe[1]) * Number(moe[2])
  const plain = id.match(/(?:^|[-_.:])(\d{1,4})b\b/i)
  return plain ? Number(plain[1]) : 0
}

/**
 * An id with no tier word at all IS the vendor's standard flagship — `gpt-5.5`
 * next to `gpt-5.5-pro` and `gpt-5.4-mini`. It scores as the balanced tier, so
 * the auto-pick lands there rather than on the variant that costs several
 * times more per token.
 */
const IMPLICIT_STANDARD = 3

function tierScore(id: string): number {
  let score = 0
  let matched = false
  for (const [re, weight] of TIER) {
    if (re.test(id)) {
      score += weight
      matched = true
    }
  }
  return matched ? score : IMPLICIT_STANDARD
}

/**
 * Under this many billion parameters a model cannot do the work this product
 * asks of it — read a roster, weigh three candidates, write a paragraph a
 * coach would act on.
 */
const SMALL_PARAMS = 14

/**
 * Big enough to matter, and not so small it should never be picked for you.
 *
 * The penalty is deliberately larger than a whole version bump. Groq serves
 * `allam-2-7b`, a seven-billion-parameter Arabic model; under the old scoring
 * it beat `gpt-oss-120b` on the strength of the "2" in its name and became the
 * automatic pick, whereupon it answered a request for an interior defender by
 * asking the coach where one might be found, and then ran out of tokens per
 * minute. Its size was in its id the whole time.
 *
 * An id that does not state a size scores neutral rather than badly: most
 * hosted flagships never mention one, and guessing against them would be worse
 * than not guessing at all.
 */
function sizeScore(id: string): number {
  const params = paramsOf(id)
  if (params === 0) return 0
  if (params < SMALL_PARAMS) return -2_500
  return Math.min(params, 700) / 10
}

/**
 * How strongly we would recommend this model, higher is better.
 *
 * Version dominates, because "newest" is what a user means by "the latest
 * model" and what the vendor keeps improving. Size is the one thing allowed to
 * override it: a brand-new 7B is still a 7B.
 */
export function modelScore(id: string): number {
  const version = versionOf(id) * 1_000
  const date = dateStampOf(id) > 0 ? 200 : 0
  const preview = PREVIEW.test(id) ? -300 : 0
  return version + date + sizeScore(id) + tierScore(id) * 100 + preview
}

/**
 * A provider's models, best first, with anything that cannot chat removed.
 *
 * Ties break on the date stamp and then alphabetically, so the order is stable
 * across calls — a picker that reshuffles itself between renders is worse than
 * one sorted badly.
 */
export function rankModels(models: AiModel[]): AiModel[] {
  return models
    .filter((m) => isChatModel(m.id))
    .slice()
    .sort((a, b) => {
      const byScore = modelScore(b.id) - modelScore(a.id)
      if (byScore !== 0) return byScore
      const byDate = dateStampOf(b.id) - dateStampOf(a.id)
      if (byDate !== 0) return byDate
      return a.id.localeCompare(b.id)
    })
}

/**
 * The one to use when the user has not pinned a choice.
 *
 * Returns null when the live list gave us nothing usable, so the caller can
 * fall back to the static catalogue rather than sending an empty model id.
 */
export function pickBestModel(models: AiModel[]): string | null {
  return rankModels(models)[0]?.id ?? null
}
