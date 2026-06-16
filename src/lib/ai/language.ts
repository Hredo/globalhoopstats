import type { Locale } from "@/lib/i18n/config"

/** English name of the language, for embedding inside prompts. */
export function aiLanguageName(locale: Locale): string {
  return locale === "es" ? "Spanish" : "English"
}

/**
 * Strong directive that forces the model to answer in the chosen UI language,
 * regardless of the language the user typed in. Used in every AI system prompt.
 */
export function aiLanguageDirective(locale: Locale): string {
  return locale === "es"
    ? "Responde SIEMPRE en español, sin importar el idioma en que escriba el usuario. Traduce al español todos los encabezados de sección y las etiquetas del formato."
    : "Respond ONLY in English, regardless of the language the user writes in."
}
