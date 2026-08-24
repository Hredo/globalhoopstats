import type { Locale } from "@/lib/i18n/config"

/** English name of the language, for embedding inside prompts. */
export function aiLanguageName(locale: Locale): string {
  return locale === "es" ? "Spanish" : "English"
}

/**
 * Strong directive that forces the model to answer in one language, headings
 * and labels included. Used in every AI system prompt.
 *
 * Pass the locale from `replyLocale()`, not the raw UI locale: a coach who
 * types in Spanish on an English page expects a Spanish answer.
 */
export function aiLanguageDirective(locale: Locale): string {
  return locale === "es"
    ? "Responde SIEMPRE en español, sin importar el idioma en que esté escrita la información que te pasamos. Traduce al español todos los encabezados de sección y las etiquetas del formato."
    : "Respond ONLY in English, whatever language the data you are given is written in. Translate every section heading and label into English."
}

// Function words, not vocabulary: "Curry ACB stats" is ambiguous in any
// language, and guessing wrong is worse than falling back to the UI setting.
const ES_MARKERS =
  /(?:^|\s)(el|la|los|las|un|una|unos|unas|de|del|al|que|qué|cómo|cuál|cuánto|cuándo|quién|dónde|para|por|con|sin|pero|y|o|su|mi|tu|es|son|está|tiene|necesito|quiero|puedo|debería|mejor|jugador|jugadores|equipo|plantilla|fichaje|temporada|jugada|entrenador)(?=\s|$|[.,;:!?¿¡])/gi
const EN_MARKERS =
  /(?:^|\s)(the|a|an|of|to|for|with|without|and|or|but|is|are|has|have|do|does|did|who|where|when|which|how|why|should|would|could|need|want|best|player|players|team|roster|signing|season|play|coach)(?=\s|$|[.,;:!?])/gi

function countMatches(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0
}

/**
 * The language the user wrote in, or null when the text is too short or too
 * ambiguous to tell. Deliberately conservative — a wrong guess answers a
 * Spanish coach in English, which is exactly the complaint this fixes.
 */
export function detectMessageLocale(text: string): Locale | null {
  const sample = text.slice(0, 600)
  if (sample.trim().length < 8) return null

  let es = countMatches(sample, ES_MARKERS)
  const en = countMatches(sample, EN_MARKERS)
  // Spanish-only punctuation and accents settle most short questions.
  if (/[¿¡ñáéíóúü]/i.test(sample)) es += 2

  if (es >= 2 && es > en) return "es"
  if (en >= 2 && en > es) return "en"
  return null
}

/**
 * Which language to answer in: what the coach typed, falling back to the
 * language they set the site to.
 */
export function replyLocale(message: string, uiLocale: Locale): Locale {
  return detectMessageLocale(message) ?? uiLocale
}
