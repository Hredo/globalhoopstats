import type { Locale } from "@/lib/i18n/config"

/**
 * Position and nationality come straight from each source: ACB and FEB write
 * them in Spanish ("Alero", "Croacia", "R. Checa"), the NBA and EuroLeague
 * feeds in English ("Forward", "Spain", "USA") — sometimes both for the same
 * person across leagues. These helpers show them in the visitor's language.
 * Anything unrecognised is returned untouched rather than guessed.
 */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.\s]+/g, " ")
    .trim()

// ── Positions ──────────────────────────────────────────────────────────────

type Label = { es: string; en: string }

const POINT_GUARD: Label = { es: "Base", en: "Point guard" }
const SHOOTING_GUARD: Label = { es: "Escolta", en: "Shooting guard" }
const SMALL_FORWARD: Label = { es: "Alero", en: "Small forward" }
const POWER_FORWARD: Label = { es: "Ala-pívot", en: "Power forward" }
const CENTER: Label = { es: "Pívot", en: "Center" }

const POSITIONS: Record<string, Label> = {
  base: POINT_GUARD,
  "point guard": POINT_GUARD,
  escolta: SHOOTING_GUARD,
  "shooting guard": SHOOTING_GUARD,
  alero: SMALL_FORWARD,
  "small forward": SMALL_FORWARD,
  "ala-pivot": POWER_FORWARD,
  "ala pivot": POWER_FORWARD,
  "a-pivot": POWER_FORWARD,
  "power forward": POWER_FORWARD,
  pivot: CENTER,
  center: CENTER,
  centre: CENTER,
  guard: { es: "Exterior", en: "Guard" },
  forward: { es: "Alero", en: "Forward" },
}

/** "Alero" → "Small forward" in English; abbreviations (G-F, C) pass through. */
export function localizePosition(
  raw: string | null | undefined,
  locale: Locale,
): string | null {
  if (!raw) return null
  return POSITIONS[norm(raw)]?.[locale] ?? raw
}

// ── Nationalities ──────────────────────────────────────────────────────────

/** Spellings the sources use that ICU's own names don't cover. */
const ALIASES: Record<string, string> = {
  usa: "US",
  "u s a": "US",
  "ee uu": "US",
  eeuu: "US",
  "estados unidos": "US",
  "united states of america": "US",
  "r checa": "CZ",
  "rep checa": "CZ",
  "republica checa": "CZ",
  "czech republic": "CZ",
  "islas virgenes": "VI",
  "us virgin islands": "VI",
  "virgin islands": "VI",
  "gran bretana": "GB",
  "great britain": "GB",
  inglaterra: "GB",
  england: "GB",
  turkey: "TR",
  turquia: "TR",
  turkiye: "TR",
  "cabo verde": "CV",
  "cape verde": "CV",
  "bosnia-herzegovina": "BA",
  "bosnia herzegovina": "BA",
  bosnia: "BA",
  macedonia: "MK",
  "corea del sur": "KR",
  "south korea": "KR",
  "rd congo": "CD",
  "r d congo": "CD",
  "dr congo": "CD",
  "costa de marfil": "CI",
  "ivory coast": "CI",
  holanda: "NL",
  rusia: "RU",
}

let byName: Map<string, string> | null = null

/** name (ES or EN, accent-free) → ISO 3166 code, built once from ICU. */
function nameIndex(): Map<string, string> {
  if (byName) return byName
  const index = new Map<string, string>()
  const names = (["es", "en"] as const).map(
    (l) => new Intl.DisplayNames([l], { type: "region", fallback: "none" }),
  )
  const A = 65
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j)
      for (const dn of names) {
        const name = dn.of(code)
        if (name && name !== code) index.set(norm(name), code)
      }
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) index.set(alias, code)
  byName = index
  return index
}

const displayNames: Partial<Record<Locale, Intl.DisplayNames>> = {}

/** "Croacia" → "Croatia" in English, "Spain" → "España" in Spanish. */
export function localizeNationality(
  raw: string | null | undefined,
  locale: Locale,
): string | null {
  if (!raw) return null
  const code = nameIndex().get(norm(raw))
  if (!code) return raw
  const dn = (displayNames[locale] ??= new Intl.DisplayNames([locale], {
    type: "region",
  }))
  return dn.of(code) ?? raw
}
