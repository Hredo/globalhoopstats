/**
 * Nationality / cupo helpers for the Spanish & European market. Spanish leagues
 * cap non-EU ("extracomunitario") players and require home-grown ones, so a
 * signing recommendation must consider passports, not just talent.
 *
 * The DB stores nationality inconsistently across sources (NBA: English country
 * names like "Spain"/"USA"; FEB: Spanish names like "España"/"Francia"), so
 * matching is tolerant: normalise and test against English + Spanish forms.
 * Best-effort by design — it won't catch every edge case.
 */
export type NatFilter = "spanish" | "eu" | "non-eu" | "any"

function norm(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Spain, in the forms the scrapers produce.
const SPAIN = new Set(["spain", "espana", "spanish", "espanol", "espanola"])

// EU member states (incl. Spain) in English + Spanish, plus a few common
// demonyms seen in basketball rosters. Cyprus/Malta included for completeness.
const EU = new Set([
  ...SPAIN,
  "france", "francia", "french", "frances", "francesa",
  "germany", "alemania", "german", "aleman", "alemana",
  "italy", "italia", "italian", "italiano", "italiana",
  "portugal", "portuguese", "portugues",
  "greece", "grecia", "greek", "griego", "griega",
  "lithuania", "lituania", "lithuanian", "lituano",
  "latvia", "letonia", "latvian", "leton",
  "estonia", "estonian", "estonio",
  "poland", "polonia", "polish", "polaco",
  "czech republic", "czechia", "chequia", "republica checa", "czech", "checo",
  "slovenia", "eslovenia", "slovenian", "esloveno",
  "slovakia", "eslovaquia", "slovak", "eslovaco",
  "croatia", "croacia", "croatian", "croata",
  "finland", "finlandia", "finnish", "fines",
  "sweden", "suecia", "swedish", "sueco",
  "netherlands", "holanda", "paises bajos", "dutch", "holandes",
  "belgium", "belgica", "belgian", "belga",
  "austria", "austrian", "austriaco",
  "ireland", "irlanda", "irish", "irlandes",
  "denmark", "dinamarca", "danish", "danes",
  "hungary", "hungria", "hungarian", "hungaro",
  "romania", "rumania", "romanian", "rumano",
  "bulgaria", "bulgarian", "bulgaro",
  "luxembourg", "luxemburgo",
  "cyprus", "chipre", "cypriot", "chipriota",
  "malta", "maltese", "maltes",
])

export function isSpanish(nat: string | null | undefined): boolean {
  return SPAIN.has(norm(nat))
}

export function isEU(nat: string | null | undefined): boolean {
  return EU.has(norm(nat))
}

/** Does a player's nationality satisfy the requested cupo filter? */
export function matchesNatFilter(
  nat: string | null | undefined,
  filter: NatFilter,
): boolean {
  switch (filter) {
    case "spanish":
      return isSpanish(nat)
    case "eu":
      return isEU(nat)
    case "non-eu":
      // Unknown nationality is NOT assumed non-EU (avoid wrongly flagging cupo).
      return Boolean(norm(nat)) && !isEU(nat)
    case "any":
    default:
      return true
  }
}

/** Detect an explicit cupo / nationality requirement in the user's question. */
export function detectNationalityFilter(q: string): NatFilter {
  const s = q.toLowerCase()
  if (/extracomunitario|extra-?comunitario|non-?eu|fuera de la ue/.test(s)) return "non-eu"
  if (/espa[nñ]ol|spanish|de formaci[oó]n|cantera espa|nacional espa/.test(s)) return "spanish"
  if (/comunitario|europe[oa]|\beu\b|pasaporte (comunitario|europeo)|sin cupo|que no ocupe cupo/.test(s))
    return "eu"
  return "any"
}

const NAT_FILTER_LABELS_ES: Record<NatFilter, string> = {
  spanish: "español (de formación / nacional)",
  eu: "comunitario (no ocupa cupo)",
  "non-eu": "extracomunitario",
  any: "cualquier nacionalidad",
}

export function natFilterLabel(filter: NatFilter): string {
  return NAT_FILTER_LABELS_ES[filter]
}
