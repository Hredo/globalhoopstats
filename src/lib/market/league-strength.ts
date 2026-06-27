/**
 * League economics & strength model — the backbone of every market estimate.
 *
 * There is NO salary, value or budget data in the database (see schema.ts), so
 * the whole market layer is a transparent, tunable heuristic anchored here:
 *
 *  - `strength`   relative on-court level (0..1). Drives cross-league
 *                 translation ("his EBA numbers ≈ X in LEB Oro").
 *  - `tier`       coarse ladder used to pick "adjacent / similar leagues".
 *  - `valueCeiling` / `salaryCeiling`  the top realistic transfer value and
 *                 annual salary at that level, in EUR. Caps the valuation curve
 *                 so an EBA player can never be priced like an ACB starter.
 *  - `budget`     rough annual squad-budget band per club, in EUR.
 *
 * These are deliberate estimates, not scraped truth. Keep them in ONE place so
 * they are easy to audit and retune as real data arrives.
 */

export type LeagueTier = 1 | 2 | 3 | 4 | 5 | 6

export type LeagueEconomics = {
  slug: string
  label: string
  /** Relative competitive level, 0..1 (1 = strongest league modelled). */
  strength: number
  /** Coarse ladder; lower number = stronger league. */
  tier: LeagueTier
  /** Top realistic transfer/market value at this level (EUR). */
  valueCeiling: number
  /** Top realistic annual salary at this level (EUR). */
  salaryCeiling: number
  /** Typical annual club squad budget band (EUR). */
  budget: { min: number; max: number }
}

/**
 * Ceilings and budget bands are anchored to PUBLIC reporting from the Spanish
 * and European basketball press (exact figures are never disclosed, so these
 * are "good enough to resemble reality" ranges, not scraped truth):
 *
 *  - ACB budgets: Madrid €45M, Barça €32M, Valencia €27.5M, Baskonia €16M,
 *    Unicaja €15M, Gran Canaria €10.3M, Joventut €7.3M, Manresa €3.8M
 *    (solobasket / cronicaglobal, 2024-26).
 *  - ACB salaries: convenio minimum €28K; rotation €80–240K; starters
 *    €240–600K; top stars €1.8–5M gross (hispanosnba, 2024-25).
 *  - EuroLeague: top player+coach spend ~€20.5M; top salaries Mirotic/Fournier
 *    ~€4.5–5M net; top-10 entry ~€2.2M net (BasketNews / Eurohoops, 2024-25).
 *  - LEB Oro: average club budget ~€750K (Andorra €2.7M, Estudiantes €1.3M);
 *    salaries €20–50K (lucentumblogging / basketcantera).
 *  - LEB Plata / EBA: semi-pro / amateur; far less reported — kept conservative.
 *
 * NBA is included for completeness but its economics are not EUR-native and it
 * is isolated from the Spanish/European market in adjacentLeagueSlugs().
 */
export const LEAGUE_ECONOMICS: Record<string, LeagueEconomics> = {
  nba: {
    slug: "nba",
    label: "NBA",
    strength: 1.0,
    tier: 1,
    valueCeiling: 60_000_000,
    salaryCeiling: 50_000_000,
    budget: { min: 120_000_000, max: 220_000_000 },
  },
  euroleague: {
    slug: "euroleague",
    label: "EuroLeague",
    strength: 0.9,
    tier: 1,
    valueCeiling: 6_500_000,
    salaryCeiling: 5_000_000,
    budget: { min: 5_000_000, max: 50_000_000 },
  },
  acb: {
    slug: "acb",
    label: "Liga ACB",
    strength: 0.74,
    tier: 2,
    valueCeiling: 3_500_000,
    salaryCeiling: 2_500_000,
    budget: { min: 2_500_000, max: 45_000_000 },
  },
  "leb-oro": {
    slug: "leb-oro",
    label: "LEB Oro",
    strength: 0.52,
    tier: 3,
    valueCeiling: 120_000,
    salaryCeiling: 70_000,
    budget: { min: 400_000, max: 2_700_000 },
  },
  "leb-plata": {
    slug: "leb-plata",
    label: "LEB Plata",
    strength: 0.4,
    tier: 4,
    valueCeiling: 50_000,
    salaryCeiling: 30_000,
    budget: { min: 120_000, max: 600_000 },
  },
  eba: {
    slug: "eba",
    label: "EBA",
    strength: 0.28,
    tier: 5,
    valueCeiling: 20_000,
    salaryCeiling: 12_000,
    budget: { min: 30_000, max: 200_000 },
  },
}

/** Fallback for an unknown league: mid-low tier, conservative ceilings. */
const DEFAULT_ECONOMICS: LeagueEconomics = {
  slug: "unknown",
  label: "Unknown league",
  strength: 0.45,
  tier: 4,
  valueCeiling: 120_000,
  salaryCeiling: 70_000,
  budget: { min: 150_000, max: 800_000 },
}

export function leagueEconomics(slug: string | null | undefined): LeagueEconomics {
  if (!slug) return DEFAULT_ECONOMICS
  return LEAGUE_ECONOMICS[slug] ?? DEFAULT_ECONOMICS
}

export let strengthOverrides: Record<string, number> | null = null

export function setStrengthOverrides(overrides: Record<string, number> | null) {
  strengthOverrides = overrides
}

export function leagueStrength(slug: string | null | undefined): number {
  if (slug && strengthOverrides?.[slug] != null) return strengthOverrides[slug]
  return leagueEconomics(slug).strength
}

/**
 * Cross-league translation factor. Multiplying a raw per-game number from
 * `fromSlug` by this approximates the equivalent output in `toSlug`. Stepping
 * UP a level shrinks production (factor < 1); stepping down inflates it.
 *
 * Damped with a square root so the adjustment is sober, not literal — talent
 * does not scale perfectly linearly with league strength.
 */
export function translateRate(
  fromSlug: string | null | undefined,
  toSlug: string | null | undefined,
): number {
  const from = leagueStrength(fromSlug)
  const to = leagueStrength(toSlug)
  if (to <= 0) return 1
  return Math.sqrt(from / to)
}

/**
 * Leagues considered "adjacent / similar" to the given one — same tier or one
 * step up/down. This is the default search universe for finding signings: same
 * league first, then the realistic feeder/destination leagues around it.
 */
export function adjacentLeagueSlugs(
  slug: string | null | undefined,
  opts: { includeSelf?: boolean } = {},
): string[] {
  const { includeSelf = true } = opts
  const econ = leagueEconomics(slug)
  const out: string[] = []
  for (const e of Object.values(LEAGUE_ECONOMICS)) {
    if (e.slug === econ.slug) {
      if (includeSelf) out.push(e.slug)
      continue
    }
    // NBA is its own island: although it shares tier 1 with EuroLeague, it is
    // not a realistic feeder/destination for the Spanish/European market, and
    // letting it leak in would just resurface NBA stars as "signings".
    if ((e.slug === "nba") !== (econ.slug === "nba")) continue
    if (Math.abs(e.tier - econ.tier) <= 1) out.push(e.slug)
  }
  // Stable order: by tier (strongest first), then slug.
  return out.sort((a, b) => {
    const ea = leagueEconomics(a)
    const eb = leagueEconomics(b)
    return ea.tier - eb.tier || a.localeCompare(b)
  })
}

const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

/** Compact EUR label: "€1,2 M", "€350 K", "€18 K". */
export function formatEur(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1).replace(".", ",")} M`
  if (value >= 1_000) return `€${Math.round(value / 1_000)} K`
  return EUR.format(value)
}
