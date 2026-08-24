/**
 * The reporting contract for a trade analysis: one fixed shape, and the rule
 * that the data block is the only source of numbers.
 *
 * Two things were wrong with what this replaces. It asked for 200-350 words
 * across five open-ended "dimensions", so a small model produced a different
 * structure on every scenario and the coach could not compare two reports side
 * by side. And it never said that the figures in the data block are the ONLY
 * figures, so the model happily wrote a market value that contradicted the
 * card printed right next to it.
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
    es
      ? "Escribe SIEMPRE con esta estructura, sin encabezados y sin listas:"
      : "ALWAYS write in this structure, with no headings and no lists:",
  )
  out.push(
    es
      ? "1. Una frase: quién sale ganando y por qué, apoyada en el balance."
      : "1. One sentence: who comes out ahead and why, anchored to the balance.",
  )
  out.push(
    es
      ? "2. Un párrafo de 2-3 frases: qué cambia en la pista para quien entrega al jugador, citando como mucho dos cifras de las de arriba."
      : "2. A 2-3 sentence paragraph: what changes on the floor for the side giving the player up, citing at most two of the figures above.",
  )
  out.push(
    es
      ? "3. Un párrafo de 2-3 frases: qué pierde o qué riesgo asume (encaje de posición, dependencia, plaza de extracomunitario si aplica)."
      : "3. A 2-3 sentence paragraph: what it loses or risks (positional fit, dependence, non-EU roster slot where it applies).",
  )
  out.push(
    es
      ? '4. Una última línea que empiece exactamente por "Veredicto:" y diga aceptar, rechazar o renegociar. Si el trato está desequilibrado, di qué haría falta para equilibrarlo.'
      : '4. A final line starting exactly with "Verdict:" that says accept, reject or renegotiate. If the deal is lopsided, say what would balance it.',
  )
  out.push("")
  out.push(
    es
      ? "Máximo 180 palabras. No repitas la ficha de estadísticas: el lector la tiene delante. Negrita solo en los nombres."
      : "180 words maximum. Do not repeat the stat sheet: the reader is looking at it. Bold only for names.",
  )
  out.push("")
  out.push(houseStyle(locale))
  return out
}
