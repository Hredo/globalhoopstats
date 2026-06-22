/**
 * Curated club budgets from PUBLIC reporting. Exact figures are never
 * disclosed, so these are the approximate annual squad budgets the Spanish /
 * European press has reported — "close enough to resemble reality". When a club
 * isn't listed we fall back to the league band midpoint from league-strength.ts.
 *
 * Sources (2024-26): solobasket, cronicaglobal, BasketNews, lucentumblogging,
 * palco23. Update as fresher numbers are published.
 */
import { leagueEconomics } from "@/lib/market/league-strength"

type KnownClub = { keys: string[]; eur: number; note: string }

// Matched by normalised-name substring, so sponsor prefixes ("MoraBanc",
// "BAXI", "Baxi", "Unicaja") don't break the lookup.
const KNOWN_CLUBS: KnownClub[] = [
  { keys: ["real madrid"], eur: 45_000_000, note: "ACB/EuroLeague, ~€45M (2024-25)" },
  { keys: ["barcelona", "barca"], eur: 32_000_000, note: "ACB/EuroLeague, ~€32M" },
  { keys: ["valencia"], eur: 27_500_000, note: "ACB/EuroLeague, ~€27.5M" },
  { keys: ["baskonia"], eur: 16_000_000, note: "ACB/EuroLeague, ~€16M" },
  { keys: ["unicaja", "malaga"], eur: 15_000_000, note: "ACB, ~€15M" },
  { keys: ["gran canaria", "granca"], eur: 10_300_000, note: "ACB, ~€10.3M" },
  { keys: ["joventut", "badalona", "penya"], eur: 7_300_000, note: "ACB, ~€7.3M" },
  { keys: ["manresa"], eur: 3_800_000, note: "ACB, ~€3.8M" },
  { keys: ["andorra"], eur: 2_700_000, note: "Andorra, ~€2.7M" },
  { keys: ["estudiantes"], eur: 1_300_000, note: "Estudiantes, ~€1.3M" },
  { keys: ["coruna", "leyma"], eur: 1_190_000, note: "Leyma Coruña, ~€1.19M" },
  { keys: ["lleida"], eur: 800_000, note: "Força Lleida, ~€0.8M" },
]

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export type ClubBudget = {
  eur: number
  /** "known" = curated public figure; "estimate" = league-band fallback. */
  source: "known" | "estimate"
  note: string
}

/**
 * Best public estimate of a club's annual squad budget. Tries the curated
 * table first (by name), then falls back to the geometric midpoint of the
 * league's reported budget band.
 */
export function estimateClubBudget(
  teamName: string | null | undefined,
  leagueSlug: string | null | undefined,
): ClubBudget {
  const n = normalize(teamName ?? "")
  if (n) {
    for (const club of KNOWN_CLUBS) {
      if (club.keys.some((k) => n.includes(normalize(k)))) {
        return { eur: club.eur, source: "known", note: club.note }
      }
    }
  }
  const band = leagueEconomics(leagueSlug).budget
  // Geometric mean keeps the midpoint sensible across a wide band.
  const mid = Math.round(Math.sqrt(band.min * band.max))
  return {
    eur: mid,
    source: "estimate",
    note: `Estimación por banda de ${leagueEconomics(leagueSlug).label} (€${Math.round(band.min / 1000)}K–€${(band.max / 1_000_000).toFixed(1)}M)`,
  }
}

/**
 * Sensible cap for what a single signing can cost a club: clubs rarely commit
 * more than ~40% of the squad budget to one player.
 */
export function singleSigningCap(budgetEur: number): number {
  return Math.round(budgetEur * 0.4)
}
