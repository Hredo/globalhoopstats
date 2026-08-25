/**
 * Shared market-need taxonomy. Lives apart from local-advisor.ts so both the
 * advisor (rule-based + LLM grounding) and the market layer can depend on it
 * without a circular import.
 */
export type Intent =
  | "defender"
  | "scorer"
  | "playmaker"
  | "wing"
  | "big"
  | "cheap"
  | "star"
  | "general"

/** Cheap keyword router for the user's question (Spanish + English). */
export function detectIntent(q: string): Intent {
  const s = q.toLowerCase()
  if (s.match(/defens|defender|defensor|stop|stoper|stopper/)) return "defender"
  if (s.match(/anot|tirador|scorer|scoring|puntos|3 puntos|triples/))
    return "scorer"
  if (s.match(/base|playmaker|director|point|asistente|generador|organizador/))
    return "playmaker"
  if (s.match(/ala|alero|wing|forward/)) return "wing"
  if (
    s.match(
      /p[ií]vot|pivot|center|interior|rebote|rebounder|post|aro|pintura|tap[oó]n|tablero/,
    )
  )
    return "big"
  if (s.match(/barato|econ[oó]mico|cheap|m[íi]nimo|low cost|salary cap/))
    return "cheap"
  if (s.match(/estrella|star|superstar|franquicia|all-star|mvp/)) return "star"
  return "general"
}

export const INTENT_LABELS_ES: Record<Intent, string> = {
  defender: "Refuerzo defensivo",
  scorer: "Anotador / tirador",
  playmaker: "Base organizador",
  wing: "Alero versátil",
  big: "Refuerzo interior",
  cheap: "Opción económica",
  star: "Movimiento de estrella",
  general: "Análisis general",
}

/**
 * Second dimension of a market question: WHAT KIND of move is being asked
 * about. Orthogonal to Intent (which describes the kind of player). Together
 * they let the advisor tailor both the data it gathers and how it answers.
 */
export type MarketOperation =
  | "signing" // fichar a un agente libre / reforzar
  | "trade" // traspaso / intercambio
  | "draft" // draft NBA / cantera / desarrollo de jóvenes
  | "release" // corte / baja / prescindir
  | "renewal" // renovación de un jugador propio
  | "loan" // cesión / préstamo
  | "buyout" // cláusula de rescisión / buy-out
  | "scouting" // evaluación / comparación, sin operación concreta
  | "general"

/** Keyword router for the market operation (Spanish + English). */
export function detectOperation(q: string): MarketOperation {
  const s = q.toLowerCase()
  if (/traspas|intercambi|\btrade\b|a cambio|paquete|por mi |ofrec.{0,15}por/.test(s))
    return "trade"
  if (
    /cort(?:ar|e|amos)|despid|dar de baja|rescind|prescindir|\brelease\b|waive|recortar|sobra en la plantilla|fuera de la plantilla/.test(
      s,
    )
  )
    return "release"
  if (/renov|renew|re-?firm|extender? contrato|ampliar contrato|mantener a|seguir en el/.test(s))
    return "renewal"
  if (/\bdraft\b|cantera|j[uú]nior|sub-?2[0-3]|promesa|prospecto|prospect|joven talento|desarroll/.test(s))
    return "draft"
  if (/cesi[oó]n|pr[eé]stamo|\bloan\b|cedid/.test(s)) return "loan"
  if (/buy-?out|cl[aá]usula|rescisi[oó]n/.test(s)) return "buyout"
  if (/compar|eval[uú]a|an[aá]lisis de|scouting|informe|qu[eé] tal es|c[oó]mo de bueno/.test(s))
    return "scouting"
  if (
    /fich|\bsign\b|contrat|incorpora|refuerz|agente libre|free agent|necesit|busc|recomien|recomend|sugier|sugerir|\bsuggest\b|me interesa|cubrir|tapar el hueco|mejorar (?:el|la|mi)|opci[oó]n|alternativ|deber[ií]a (?:fichar|traer|firmar)/.test(
      s,
    )
  )
    return "signing"
  return "general"
}

/**
 * Does this read as a question about basketball rather than about this club's
 * next move? "¿Quién es el mejor base de la ACB?" — yes. "¿Quién me
 * recomiendas para el poste?" — no, that is a signing question wearing a
 * question mark.
 *
 * Deliberately narrow, and deliberately the ONLY way to lose the shortlist.
 * `detectOperation` is a keyword router that misses plenty of real phrasings
 * ("Quiero un defensor fuerte para el equipo" and "Una opción económica para
 * la rotación" are two of our own suggested questions and neither used to
 * match), so gating the candidate list on a positive market match made the
 * advisor look broken for anything typed by hand: no shortlist reached the
 * prompt, and the model answered from memory — which is how an NBA club got
 * recommended a LEB player, once, with no price and no numbers.
 *
 * Getting this wrong in the "include the shortlist" direction costs a few
 * unused lines of context. Getting it wrong the other way costs the feature.
 */
const KNOWLEDGE_OPENERS =
  /^\s*[¿?]?\s*(qui[eé]n|cu[aá]l|qu[eé]|c[oó]mo|cu[aá]nt[oa]s?|cu[aá]ndo|d[oó]nde|por\s+qu[eé]|who|which|what|how|when|where|why)\b/i
/** Any of these turns a question back into a market question. */
const MARKET_WORDS =
  /necesit|busc|fich|refuerz|recomien|recomend|sugier|contrat|traspas|cort(?:ar|e)|renov|plantilla|roster|cubrir|reforzar|mejorar|encaj|presupuest|budget|\bsign\b|\btrade\b|\bcut\b|\bneed\b|\blooking for\b/i

export function looksLikeKnowledgeQuestion(message: string): boolean {
  const s = message.trim()
  if (s.length === 0) return false
  if (MARKET_WORDS.test(s)) return false
  return KNOWLEDGE_OPENERS.test(s)
}

/**
 * Is the user actually trying to move a player, or just asking about
 * basketball?
 *
 * The advisor used to treat every message as a transfer request: it attached a
 * six-player shortlist, a budget ceiling and a "you may only name these
 * players" rule to questions like "¿quién es el mejor base de la ACB?". The
 * answer that came back was either six replacement signings nobody asked for
 * or a refusal to name anyone. `scouting` is deliberately on the non-market
 * side: "¿qué tal es Llull?" wants an opinion about him, not a shortlist of
 * people to sign instead of him.
 */
export function isMarketOperation(op: MarketOperation): boolean {
  return op !== "general" && op !== "scouting"
}

export const OPERATION_LABELS_ES: Record<MarketOperation, string> = {
  signing: "Fichaje",
  trade: "Traspaso",
  draft: "Draft / Cantera",
  release: "Corte / Baja",
  renewal: "Renovación",
  loan: "Cesión",
  buyout: "Cláusula de rescisión",
  scouting: "Evaluación",
  general: "Mercado general",
}
