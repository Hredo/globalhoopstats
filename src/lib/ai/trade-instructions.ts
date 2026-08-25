/**
 * The reporting contract for a trade analysis: what has to be in it, and the
 * rule that the data block is the only source of numbers.
 *
 * Two things were wrong with the version before this one. It pinned a rigid
 * four-part template — "no headings and no lists", "180 words maximum", a final
 * line starting exactly with "Verdict:" — which is why the output read like a
 * form somebody filled in rather than an answer. And the shape was the ONLY
 * thing it pinned hard, so a small model spent its attention on obeying the
 * template instead of on the trade.
 *
 * What survives is the part that was actually load-bearing: the figures in the
 * data block are the only figures that exist, and the report has to end with a
 * call. How it is laid out is the shared house style's job now, the same as
 * every other AI surface.
 *
 * Lives outside the route because a Next.js route file may only export HTTP
 * handlers, and this is worth testing on its own.
 */
import { houseStyle } from "@/lib/ai/prompt-copy"
import type { Locale } from "@/lib/i18n/config"

export function tradeInstructions(locale: Locale): string[] {
  const es = locale === "es"
  const out: string[] = []

  out.push(es ? "INSTRUCCIONES" : "INSTRUCTIONS")
  out.push(
    es
      ? "Los únicos números que existen son los de arriba: valores, ratings, estadísticas y balance. No cites ninguna cifra distinta, no conviertas monedas y no te inventes edad, contrato, años restantes ni lesiones. Si un dato no está arriba, no existe para este informe."
      : "The only numbers that exist are the ones above: values, ratings, stats and balance. Never quote a different figure, never convert currencies, and never invent an age, a contract, years remaining or an injury. If it is not above, it does not exist for this report.",
  )
  out.push(
    es
      ? "Los clubes y la liga son los que aparecen arriba. No menciones otras ligas ni otros clubes."
      : "The clubs and the league are the ones above. Do not mention any other league or club.",
  )
  out.push("")
  out.push(
    es ? "El informe tiene que dejar claro:" : "The report has to make clear:",
  )
  out.push(
    es
      ? "- Quién sale ganando y por qué, apoyado en el balance."
      : "- Who comes out ahead and why, anchored to the balance.",
  )
  out.push(
    es
      ? "- Qué cambia en la pista para quien entrega al jugador, con dos cifras de arriba como mucho."
      : "- What changes on the floor for the side giving the player up, with at most two of the figures above.",
  )
  out.push(
    es
      ? "- Qué pierde o qué riesgo asume: encaje de posición, dependencia, plaza de extracomunitario si aplica."
      : "- What it loses or risks: positional fit, dependence, a non-EU roster slot where that applies.",
  )
  out.push(
    es
      ? "- Tu decisión: aceptar, rechazar o renegociar. Si el trato está desequilibrado, di qué haría falta para equilibrarlo."
      : "- Your call: accept, reject or renegotiate. If the deal is lopsided, say what would balance it.",
  )
  out.push("")
  out.push(
    es
      ? "Escríbelo como se lo contarías al director deportivo: seguido, sin encabezados por cada punto y sin convertir la lista de arriba en un formulario. No repitas la ficha de estadísticas, que el lector la tiene delante."
      : "Write it the way you would tell it to the GM: continuous, without a heading per point, and without turning the list above into a form. Do not repeat the stat sheet — the reader is looking at it.",
  )
  out.push("")
  out.push(houseStyle(locale))
  return out
}
