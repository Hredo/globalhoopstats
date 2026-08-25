/**
 * One pipeline for every AI answer in the product.
 *
 * The promise this exists to keep: whatever engine the user has selected, what
 * reaches the screen is either a readable, grounded answer or an honest
 * failure — never the thing in between. Weak models will keep producing the
 * thing in between; the point is that nobody sees it.
 *
 * Each surface used to call `chatComplete` directly and guard the result its
 * own way, or not at all. That is how a compare screen shipped a translation
 * of its own brief as the analysis, and a trade report shipped four empty
 * headings about a player called "Tyrese Baskets" priced at figures that
 * appear nowhere in our data.
 *
 * Three rules hold everywhere now:
 *   1. The user turn carries DATA. Instructions live in `system`.
 *   2. The answer is verified against that data before it is returned.
 *   3. A failed verification is retried once, tightened, and then given up on.
 */
import { chatComplete, type ChatMessage } from "@/lib/ai/chat"
import type { AiProvider } from "@/lib/ai/providers"
import {
  echoesInstructions,
  isMostlyHeadings,
  isUsableAnswer,
  mentionsAnySubject,
  trimDegeneratedOutput,
} from "@/lib/ai/degeneration"
import { inventsFigures, unsupportedFigures } from "@/lib/ai/grounding"
import { cleanLlmOutput } from "@/lib/security/ai-advisor"
import type { Locale } from "@/lib/i18n/config"

export type AnswerEngine = {
  provider: AiProvider
  model: string
  apiKey: string | null
}

export type GroundedRequest = {
  engine: AnswerEngine
  /** Persona, brief, house style, language directive. Never data. */
  system: string
  /** The data block. Never instructions. */
  data: string
  /**
   * Where the figures the answer may quote actually live. Defaults to `data`.
   *
   * The advisor is the exception: its user turn is the coach's question, and
   * the team, budget, shortlist and roster context is assembled into `system`.
   * Grounding against `data` there would compare the answer's numbers against
   * a question that contains none, which is not a check at all.
   */
  groundingSource?: string
  /** Prior turns, for the conversational surfaces. */
  history?: ChatMessage[]
  /** Names the answer has to be about, checked by surname. */
  subjects?: string[]
  locale: Locale
  maxTokens?: number
  temperature?: number
  /** The model may search the web with the user's own key. */
  webSearch?: boolean
  /**
   * Check that every figure in the answer traces back to the data. On by
   * default.
   *
   * With `webSearch` on, an unsupported figure is accepted only when the
   * answer cites a source link for it — a salary from a news article is
   * legitimate, the same number with no source is indistinguishable from an
   * invented one. Pass `false` to switch the check off entirely, for a surface
   * whose answer is expected to DERIVE numbers: a play breakdown reasons about
   * distances and angles from metre coordinates.
   */
  checkFigures?: boolean
  /** Minimum answer length. Follow-ups in a chat are legitimately short. */
  requireLength?: boolean
}

export type FailureReason =
  /** The provider itself errored — bad key, model gone, timeout. */
  | "provider"
  /** The model answered, but with something we will not show a user. */
  | "unusable"

export type GroundedAnswer =
  | { ok: true; text: string; model: string; retried: boolean }
  | { ok: false; reason: FailureReason; error: string }

/** Why a candidate answer was rejected. Logged, never shown. */
type Rejection =
  | "empty"
  | "outline"
  | "too-short"
  | "echoed-brief"
  | "wrong-subject"
  | "invented-figures"

function groundingSource(req: GroundedRequest): string {
  return req.groundingSource ?? req.data
}

function verify(
  text: string,
  req: GroundedRequest,
): Rejection | null {
  if (text.trim().length === 0) return "empty"
  // An outline of headings the model never filled in. The single most common
  // failure on an 8B, and it reads as a broken page rather than a bad answer.
  if (isMostlyHeadings(text)) return "outline"
  if (req.requireLength !== false && !isUsableAnswer(text)) return "too-short"
  if (echoesInstructions(text, req.system)) return "echoed-brief"
  if (!mentionsAnySubject(text, req.subjects ?? [])) return "wrong-subject"

  if (req.checkFigures === false) return null

  const invented = inventsFigures(text, groundingSource(req))
  if (!invented) return null
  // A model that searched the web may legitimately quote a figure we do not
  // have — a salary from a news article, a transfer fee. But then it has to
  // say where it got it. Without a citation an outside figure is
  // indistinguishable from an invented one, and we treat it as invented.
  if (req.webSearch && citesSource(text)) return null
  return "invented-figures"
}

/** A markdown link, which is how the prompts ask for a source to be cited. */
const CITATION = /\[[^\]]+\]\(https?:\/\/[^)]+\)/

function citesSource(text: string): boolean {
  return CITATION.test(text)
}

/**
 * What to add to the second attempt.
 *
 * Naming the specific failure is what makes a retry worth its cost: told only
 * "try again" a model reproduces its answer, told "you invented €5.2M, every
 * figure must come from the data" it usually does not.
 */
function correction(rejection: Rejection, locale: Locale, detail: string): string {
  const es = locale === "es"
  const lead = es
    ? "Tu respuesta anterior no vale. Escríbela otra vez, entera, corrigiendo esto:"
    : "Your previous answer is not acceptable. Write it again, in full, fixing this:"
  const fixes: Record<Rejection, string> = es
    ? {
        empty: "no escribiste nada.",
        outline:
          "respondiste con una lista de titulares vacíos en lugar de con un análisis. Escribe prosa: párrafos con contenido, no encabezados sueltos.",
        "too-short": "te quedaste demasiado corto para responder de verdad.",
        "echoed-brief":
          "repetiste las instrucciones que te dieron en lugar de contestar. No describas lo que vas a hacer: hazlo.",
        "wrong-subject":
          "no hablaste de las personas sobre las que te preguntaron. Usa sus nombres tal y como aparecen en los datos.",
        "invented-figures": `te inventaste cifras que no están en los datos${detail}. Cada número que escribas tiene que salir del bloque de datos, tal cual o redondeado; si lo sacas de una fuente externa, cita el enlace con [nombre](url).`,
      }
    : {
        empty: "you wrote nothing.",
        outline:
          "you answered with a list of empty headings instead of an analysis. Write prose: paragraphs with content, not bare headings.",
        "too-short": "you stopped short of actually answering.",
        "echoed-brief":
          "you repeated the instructions you were given instead of answering. Do not describe what you are about to do — do it.",
        "wrong-subject":
          "you did not write about the people you were asked about. Use their names exactly as they appear in the data.",
        "invented-figures": `you invented figures that are not in the data${detail}. Every number you write has to come from the data block, exactly or rounded; if it comes from an outside source, cite the link as [name](url).`,
      }
  return `${lead} ${fixes[rejection]}`
}

/**
 * Ask the model, check what comes back, and retry once if it fails.
 *
 * Returns clean, guard-trimmed, XSS-safe text ready to render — or a failure
 * the caller should surface as a failure. Never returns something it would not
 * want a user to read.
 */
export async function generateGroundedAnswer(
  req: GroundedRequest,
): Promise<GroundedAnswer> {
  const attempt = async (
    system: string,
    temperature: number,
  ): Promise<
    | { kind: "provider-error"; error: string }
    | { kind: "candidate"; text: string; model: string; rejection: Rejection | null }
  > => {
    const result = await chatComplete({
      provider: req.engine.provider,
      model: req.engine.model,
      apiKey: req.engine.apiKey,
      system,
      messages: [...(req.history ?? []), { role: "user", content: req.data }],
      maxTokens: req.maxTokens ?? 900,
      temperature,
      webSearch: req.webSearch,
    })
    if (!result.ok) return { kind: "provider-error", error: result.error }
    const text = trimDegeneratedOutput(result.content).text
    return {
      kind: "candidate",
      text,
      model: result.model,
      rejection: verify(text, req),
    }
  }

  const baseTemp = req.temperature ?? 0.6
  const first = await attempt(req.system, baseTemp)
  if (first.kind === "provider-error") {
    return { ok: false, reason: "provider", error: first.error }
  }
  if (first.rejection === null) {
    return {
      ok: true,
      text: cleanLlmOutput(first.text),
      model: first.model,
      retried: false,
    }
  }

  // Second and last attempt: same brief, plus what went wrong, colder.
  const bad =
    first.rejection === "invented-figures"
      ? ` (${unsupportedFigures(first.text, groundingSource(req))
          .slice(0, 3)
          .map((n) => n.toLocaleString("en-US"))
          .join(", ")})`
      : ""
  const second = await attempt(
    `${req.system}\n\n${correction(first.rejection, req.locale, bad)}`,
    Math.max(0.1, baseTemp - 0.3),
  )
  if (second.kind === "provider-error") {
    return { ok: false, reason: "provider", error: second.error }
  }
  if (second.rejection === null) {
    return {
      ok: true,
      text: cleanLlmOutput(second.text),
      model: second.model,
      retried: true,
    }
  }

  console.error(
    `[ai] ${req.engine.provider.id}/${req.engine.model} rejected twice: ${first.rejection} then ${second.rejection}`,
  )
  return { ok: false, reason: "unusable", error: second.rejection }
}

/**
 * What to tell the user when the model could not produce a usable answer.
 *
 * Says which of the two things happened, because the fix is different: a
 * provider error is a key or a model id, an unusable answer is the engine
 * being too small for the job.
 */
export function answerFailureMessage(
  answer: Extract<GroundedAnswer, { ok: false }>,
  locale: Locale,
): string {
  const es = locale === "es"
  if (answer.reason === "provider") {
    return es
      ? `El proveedor de IA ha fallado: ${answer.error}`
      : `The AI provider failed: ${answer.error}`
  }
  return es
    ? "El modelo que tienes seleccionado no ha sido capaz de dar una respuesta fiable — lo ha intentado dos veces y las dos ha respondido con un guion vacío o con cifras que no salen de tus datos. Elige un modelo más grande en Ajustes."
    : "The model you have selected could not produce a reliable answer — it tried twice and both times came back with an empty outline or with figures that are not in your data. Pick a larger model in Settings."
}
