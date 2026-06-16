import type { Locale } from "../config"
import { en, type Messages } from "./en"
import { es } from "./es"

export type { Messages } from "./en"

const DICTIONARIES: Record<Locale, Messages> = { en, es }

export function getDictionary(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? en
}
