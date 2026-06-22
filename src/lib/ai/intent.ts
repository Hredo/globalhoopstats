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
  if (/fich|\bsign\b|contrat|incorpora|refuerzo|agente libre|free agent|necesit|busc/.test(s))
    return "signing"
  return "general"
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
