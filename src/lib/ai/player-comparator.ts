import type { ComparePlayer } from "@/lib/data/compare"
import type { Locale } from "@/lib/i18n/config"

export type CategoryKey =
  | "scoring"
  | "playmaking"
  | "rebounding"
  | "defense"
  | "efficiency"
  | "availability"

export type CategoryResult = {
  key: CategoryKey
  label: string
  emoji: string
  winner: "a" | "b" | "tie" | "n/a"
  margin: number
  aValue: number | null
  bValue: number | null
  formatted: { a: string; b: string }
  summary: string
}

export type Insight = {
  kind: "strength" | "weakness" | "edge" | "context"
  player: "a" | "b" | "both"
  text: string
}

export type ComparisonOutput = {
  a: { slug: string; fullName: string; league: string }
  b: { slug: string; fullName: string; league: string }
  categories: CategoryResult[]
  overall: {
    aScore: number
    bScore: number
    leader: "a" | "b" | "tie"
    confidence: "high" | "medium" | "low"
  }
  insights: Insight[]
  verdict: string
  archetype: { a: string; b: string }
  fitNotes: string[]
  warnings: string[]
}

type Stats = NonNullable<ComparePlayer["stats"]>

/** Pick the right string for the active locale. */
function pick(locale: Locale, en: string, es: string): string {
  return locale === "es" ? es : en
}

function num(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return v
}

function fmt1(v: number | null): string {
  return v == null ? "—" : v.toFixed(1)
}

function fmtPct(v: number | null): string {
  return v == null ? "—" : `${(v * 100).toFixed(1)}%`
}

function tot(
  v: number | null | undefined,
  gp: number | null | undefined,
): number | null {
  if (v == null) return null
  return v / ((gp ?? 1) || 1)
}

function compareNumbers(
  a: number | null,
  b: number | null,
  lowerBetter = false,
): { winner: "a" | "b" | "tie" | "n/a"; margin: number } {
  if (a == null && b == null) return { winner: "n/a", margin: 0 }
  if (a == null) return { winner: "b", margin: 1 }
  if (b == null) return { winner: "a", margin: 1 }
  const delta = lowerBetter ? b - a : a - b
  const base = Math.max(Math.abs(a), Math.abs(b), 0.0001)
  const margin = Math.abs(delta) / base
  if (Math.abs(delta) < 0.01) return { winner: "tie", margin: 0 }
  return { winner: delta > 0 ? "a" : "b", margin }
}

// Archetype is kept as a STABLE key for fit-note logic; the human label is
// resolved separately so localisation never breaks the matching below.
type ArchetypeKey =
  | "creating-star"
  | "perimeter-scorer"
  | "efficient-finisher"
  | "floor-general"
  | "defensive-big"
  | "dominant-interior"
  | "versatile-3d"
  | "rim-protector"
  | "rotation-bench"
  | "balanced-role"
  | "none"

function detectArchetypeKey(
  stats: Stats | null,
  position: string | null,
): ArchetypeKey {
  if (!stats) return position ? "none" : "none"
  const gp = stats.gamesPlayed || 1
  const pts = num(tot(stats.pointsTotal, gp)) ?? 0
  const ast = num(tot(stats.assistsTotal, gp)) ?? 0
  const reb = num(tot(stats.reboundsTotal, gp)) ?? 0
  const blk = num(tot(stats.blocksTotal, gp)) ?? 0
  const stl = num(tot(stats.stealsTotal, gp)) ?? 0

  if (pts >= 24 && ast >= 6) return "creating-star"
  if (pts >= 22) return "perimeter-scorer"
  if (pts >= 20) return "efficient-finisher"
  if (ast >= 7) return "floor-general"
  if (reb >= 10 && blk >= 1.2) return "defensive-big"
  if (reb >= 9 && pts >= 14) return "dominant-interior"
  if (stl >= 1.5) return "versatile-3d"
  if (blk >= 1.5) return "rim-protector"
  if (pts <= 8 && ast <= 3) return "rotation-bench"
  return "balanced-role"
}

function archetypeLabel(
  key: ArchetypeKey,
  position: string | null,
  locale: Locale,
): string {
  if (key === "none") return position ?? pick(locale, "No profile", "Sin perfil")
  const labels: Record<Exclude<ArchetypeKey, "none">, [string, string]> = {
    "creating-star": ["Creating star", "Estrella creadora"],
    "perimeter-scorer": ["Perimeter scorer", "Anotador perimetral"],
    "efficient-finisher": ["Efficient finisher", "Finalizador eficiente"],
    "floor-general": ["Floor general", "Base organizador"],
    "defensive-big": ["Defensive big", "Pívot defensivo"],
    "dominant-interior": ["Dominant interior", "Interior dominante"],
    "versatile-3d": ["Versatile 3&D", "3&D versátil"],
    "rim-protector": ["Rim protector", "Protector del aro"],
    "rotation-bench": ["Rotation / Bench", "Rotación / Banquillo"],
    "balanced-role": ["Balanced role", "Rol equilibrado"],
  }
  const [en, es] = labels[key]
  return pick(locale, en, es)
}

function categoryScoring(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): CategoryResult {
  const av = num(tot(a.stats?.pointsTotal, a.stats?.gamesPlayed))
  const bv = num(tot(b.stats?.pointsTotal, b.stats?.gamesPlayed))
  const cmp = compareNumbers(av, bv)
  return {
    key: "scoring",
    label: pick(locale, "Scoring", "Anotación"),
    emoji: "🎯",
    winner: cmp.winner,
    margin: cmp.margin,
    aValue: av,
    bValue: bv,
    formatted: { a: `${fmt1(av)} pts`, b: `${fmt1(bv)} pts` },
    summary:
      cmp.winner === "tie" || cmp.winner === "n/a"
        ? pick(
            locale,
            "Very similar scoring output.",
            "Producción anotadora muy similar.",
          )
        : cmp.winner === "a"
          ? pick(
              locale,
              `${a.fullName} averages ${fmt1(av)} pts to ${b.fullName}'s ${fmt1(bv)}.`,
              `${a.fullName} promedia ${fmt1(av)} pts frente a los ${fmt1(bv)} de ${b.fullName}.`,
            )
          : pick(
              locale,
              `${b.fullName} averages ${fmt1(bv)} pts to ${a.fullName}'s ${fmt1(av)}.`,
              `${b.fullName} promedia ${fmt1(bv)} pts frente a los ${fmt1(av)} de ${a.fullName}.`,
            ),
  }
}

function categoryPlaymaking(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): CategoryResult {
  const av = num(tot(a.stats?.assistsTotal, a.stats?.gamesPlayed))
  const bv = num(tot(b.stats?.assistsTotal, b.stats?.gamesPlayed))
  const cmp = compareNumbers(av, bv)
  return {
    key: "playmaking",
    label: pick(locale, "Playmaking", "Generación de juego"),
    emoji: "🎮",
    winner: cmp.winner,
    margin: cmp.margin,
    aValue: av,
    bValue: bv,
    formatted: { a: `${fmt1(av)} ast`, b: `${fmt1(bv)} ast` },
    summary:
      cmp.winner === "tie" || cmp.winner === "n/a"
        ? pick(locale, "Even assist volume.", "Volumen de asistencias parejo.")
        : cmp.winner === "a"
          ? pick(
              locale,
              `${a.fullName} dishes ${fmt1(av)} ast per game.`,
              `${a.fullName} reparte ${fmt1(av)} ast por partido.`,
            )
          : pick(
              locale,
              `${b.fullName} dishes ${fmt1(bv)} ast per game.`,
              `${b.fullName} reparte ${fmt1(bv)} ast por partido.`,
            ),
  }
}

function categoryRebounding(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): CategoryResult {
  const av = num(tot(a.stats?.reboundsTotal, a.stats?.gamesPlayed))
  const bv = num(tot(b.stats?.reboundsTotal, b.stats?.gamesPlayed))
  const cmp = compareNumbers(av, bv)
  return {
    key: "rebounding",
    label: pick(locale, "Rebounding", "Rebote"),
    emoji: "🪣",
    winner: cmp.winner,
    margin: cmp.margin,
    aValue: av,
    bValue: bv,
    formatted: { a: `${fmt1(av)} reb`, b: `${fmt1(bv)} reb` },
    summary:
      cmp.winner === "tie" || cmp.winner === "n/a"
        ? pick(locale, "Balanced rebounding.", "Rebote equilibrado.")
        : cmp.winner === "a"
          ? pick(
              locale,
              `${a.fullName} controls the glass with ${fmt1(av)} per game.`,
              `${a.fullName} domina el rebote con ${fmt1(av)} por partido.`,
            )
          : pick(
              locale,
              `${b.fullName} controls the glass with ${fmt1(bv)} per game.`,
              `${b.fullName} domina el rebote con ${fmt1(bv)} por partido.`,
            ),
  }
}

function categoryDefense(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): CategoryResult {
  const aStl = num(tot(a.stats?.stealsTotal, a.stats?.gamesPlayed)) ?? 0
  const aBlk = num(tot(a.stats?.blocksTotal, a.stats?.gamesPlayed)) ?? 0
  const bStl = num(tot(b.stats?.stealsTotal, b.stats?.gamesPlayed)) ?? 0
  const bBlk = num(tot(b.stats?.blocksTotal, b.stats?.gamesPlayed)) ?? 0
  const av = aStl + aBlk
  const bv = bStl + bBlk
  const av2 = Number.isFinite(av) && av > 0 ? av : null
  const bv2 = Number.isFinite(bv) && bv > 0 ? bv : null
  const cmp = compareNumbers(av2, bv2)
  return {
    key: "defense",
    label: pick(locale, "Defensive impact", "Impacto defensivo"),
    emoji: "🛡️",
    winner: cmp.winner,
    margin: cmp.margin,
    aValue: av2,
    bValue: bv2,
    formatted: {
      a: `${fmt1(aStl)} stl · ${fmt1(aBlk)} blk`,
      b: `${fmt1(bStl)} stl · ${fmt1(bBlk)} blk`,
    },
    summary:
      cmp.winner === "tie" || cmp.winner === "n/a"
        ? pick(
            locale,
            "Similar defensive output in steals and blocks.",
            "Producción defensiva similar en robos y tapones.",
          )
        : cmp.winner === "a"
          ? pick(
              locale,
              `${a.fullName} adds ${(av2 ?? 0).toFixed(1)} defensive plays per game.`,
              `${a.fullName} suma ${(av2 ?? 0).toFixed(1)} acciones defensivas por partido.`,
            )
          : pick(
              locale,
              `${b.fullName} adds ${(bv2 ?? 0).toFixed(1)} defensive plays per game.`,
              `${b.fullName} suma ${(bv2 ?? 0).toFixed(1)} acciones defensivas por partido.`,
            ),
  }
}

function categoryEfficiency(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): CategoryResult {
  const aFg = a.stats?.fgPct ?? null
  const aTp = a.stats?.threePct ?? null
  const aFt = a.stats?.ftPct ?? null
  const bFg = b.stats?.fgPct ?? null
  const bTp = b.stats?.threePct ?? null
  const bFt = b.stats?.ftPct ?? null
  const aAvg = avg([aFg, aTp, aFt])
  const bAvg = avg([bFg, bTp, bFt])
  const cmp = compareNumbers(aAvg, bAvg)
  return {
    key: "efficiency",
    label: pick(locale, "Shooting efficiency", "Eficiencia de tiro"),
    emoji: "📈",
    winner: cmp.winner,
    margin: cmp.margin,
    aValue: aAvg,
    bValue: bAvg,
    formatted: {
      a: `${fmtPct(aFg)} / ${fmtPct(aTp)} / ${fmtPct(aFt)}`,
      b: `${fmtPct(bFg)} / ${fmtPct(bTp)} / ${fmtPct(bFt)}`,
    },
    summary:
      cmp.winner === "tie" || cmp.winner === "n/a"
        ? pick(
            locale,
            "Shooting splits at a similar level.",
            "Porcentajes de tiro a un nivel similar.",
          )
        : cmp.winner === "a"
          ? pick(
              locale,
              `${a.fullName} is more efficient across FG%/3P%/FT%.`,
              `${a.fullName} es más eficiente en TC%/T3%/TL%.`,
            )
          : pick(
              locale,
              `${b.fullName} is more efficient across FG%/3P%/FT%.`,
              `${b.fullName} es más eficiente en TC%/T3%/TL%.`,
            ),
  }
}

function categoryAvailability(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): CategoryResult {
  const aGp = num(a.stats?.gamesPlayed ?? null)
  const bGp = num(b.stats?.gamesPlayed ?? null)
  const cmp = compareNumbers(aGp, bGp)
  const gpUnit = pick(locale, "GP", "PJ")
  return {
    key: "availability",
    label: pick(locale, "Games played", "Partidos jugados"),
    emoji: "⏱️",
    winner: cmp.winner,
    margin: cmp.margin,
    aValue: aGp,
    bValue: bGp,
    formatted: {
      a: `${aGp ?? "—"} ${gpUnit}`,
      b: `${bGp ?? "—"} ${gpUnit}`,
    },
    summary:
      cmp.winner === "tie" || cmp.winner === "n/a"
        ? pick(locale, "Comparable games played.", "Partidos jugados comparables.")
        : cmp.winner === "a"
          ? pick(
              locale,
              `${a.fullName} has played ${aGp} games this season.`,
              `${a.fullName} ha jugado ${aGp} partidos esta temporada.`,
            )
          : pick(
              locale,
              `${b.fullName} has played ${bGp} games this season.`,
              `${b.fullName} ha jugado ${bGp} partidos esta temporada.`,
            ),
  }
}

function avg(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  return valid.reduce((acc, v) => acc + v, 0) / valid.length
}

function buildInsights(
  a: ComparePlayer,
  b: ComparePlayer,
  cats: CategoryResult[],
  locale: Locale,
): Insight[] {
  const insights: Insight[] = []
  const aWins = cats.filter((c) => c.winner === "a")
  const bWins = cats.filter((c) => c.winner === "b")

  const biggestAEdge = [...aWins].sort((x, y) => y.margin - x.margin)[0]
  const biggestBEdge = [...bWins].sort((x, y) => y.margin - x.margin)[0]

  if (biggestAEdge) {
    const pct = Math.round(biggestAEdge.margin * 100)
    insights.push({
      kind: "edge",
      player: "a",
      text: pick(
        locale,
        `Clear edge in ${biggestAEdge.label.toLowerCase()} (+${pct}% over ${b.fullName}).`,
        `Ventaja clara en ${biggestAEdge.label.toLowerCase()} (+${pct}% sobre ${b.fullName}).`,
      ),
    })
  }
  if (biggestBEdge) {
    const pct = Math.round(biggestBEdge.margin * 100)
    insights.push({
      kind: "edge",
      player: "b",
      text: pick(
        locale,
        `Clear edge in ${biggestBEdge.label.toLowerCase()} (+${pct}% over ${a.fullName}).`,
        `Ventaja clara en ${biggestBEdge.label.toLowerCase()} (+${pct}% sobre ${a.fullName}).`,
      ),
    })
  }

  if (a.league.slug !== b.league.slug) {
    insights.push({
      kind: "context",
      player: "both",
      text: pick(
        locale,
        `They play in different leagues (${a.league.name} vs ${b.league.name}). Pace and competition level vary — read the numbers through that lens.`,
        `Juegan en ligas distintas (${a.league.name} vs ${b.league.name}). El ritmo y el nivel de competición varían — interpreta los números con esa perspectiva.`,
      ),
    })
  }

  return insights.slice(0, 6)
}

function buildVerdict(
  a: ComparePlayer,
  b: ComparePlayer,
  cats: CategoryResult[],
  aScore: number,
  bScore: number,
  locale: Locale,
): string {
  const diff = Math.abs(aScore - bScore)
  if (diff < 0.5) {
    return pick(
      locale,
      `${a.fullName} and ${b.fullName} are essentially level: ${aScore.toFixed(1)} vs ${bScore.toFixed(1)} out of 6. The pick comes down to role and tactical fit.`,
      `${a.fullName} y ${b.fullName} están prácticamente igualados: ${aScore.toFixed(1)} vs ${bScore.toFixed(1)} sobre 6. La elección depende del rol y el encaje táctico.`,
    )
  }
  const leader = aScore > bScore ? a : b
  const trailing = aScore > bScore ? b : a
  const dominant = cats
    .filter((c) => (aScore > bScore ? c.winner === "a" : c.winner === "b"))
    .slice(0, 2)
    .map((c) => c.label.toLowerCase())
    .join(pick(locale, " and ", " y "))
  const fallbackArea = pick(locale, "several areas", "varias áreas")
  return pick(
    locale,
    `${leader.fullName} comes out ahead overall (${Math.max(aScore, bScore).toFixed(1)} vs ${Math.min(aScore, bScore).toFixed(1)}), driven mainly by ${dominant || fallbackArea}. ${trailing.fullName} keeps value in complementary roles.`,
    `${leader.fullName} sale por delante en conjunto (${Math.max(aScore, bScore).toFixed(1)} vs ${Math.min(aScore, bScore).toFixed(1)}), sobre todo por ${dominant || fallbackArea}. ${trailing.fullName} mantiene su valor en roles complementarios.`,
  )
}

function buildFitNotes(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): string[] {
  const notes: string[] = []
  const aKey = detectArchetypeKey(a.stats, a.position)
  const bKey = detectArchetypeKey(b.stats, b.position)

  if (aKey === "perimeter-scorer" && bKey === "floor-general") {
    notes.push(
      pick(
        locale,
        `Natural offensive pairing: ${a.fullName} creates their own shot while ${b.fullName} runs the offense.`,
        `Emparejamiento ofensivo natural: ${a.fullName} genera su propio tiro mientras ${b.fullName} dirige el ataque.`,
      ),
    )
  } else if (bKey === "perimeter-scorer" && aKey === "floor-general") {
    notes.push(
      pick(
        locale,
        `Natural offensive pairing: ${b.fullName} creates their own shot while ${a.fullName} runs the offense.`,
        `Emparejamiento ofensivo natural: ${b.fullName} genera su propio tiro mientras ${a.fullName} dirige el ataque.`,
      ),
    )
  }

  if (aKey === "defensive-big" || bKey === "defensive-big") {
    notes.push(
      pick(
        locale,
        "At least one brings a clear defensive profile — useful for closing games on that end.",
        "Al menos uno aporta un perfil defensivo claro — útil para cerrar partidos en ese lado.",
      ),
    )
  }

  if (a.position && b.position && a.position[0] === b.position[0]) {
    notes.push(
      pick(
        locale,
        `They share a primary position (${a.position}/${b.position}). Playing them together needs a two-guard or versatile-forward system.`,
        `Comparten posición principal (${a.position}/${b.position}). Jugar juntos exige un sistema de dos bases o de aleros versátiles.`,
      ),
    )
  }

  if (notes.length === 0) {
    notes.push(
      pick(
        locale,
        "Complementary profiles across many areas — easy to pair in a rotation.",
        "Perfiles complementarios en muchas áreas — fáciles de combinar en una rotación.",
      ),
    )
  }
  return notes
}

function buildWarnings(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale,
): string[] {
  const warnings: string[] = []
  if (!a.stats)
    warnings.push(
      pick(
        locale,
        `No season stats for ${a.fullName}; the analysis leans on partial data.`,
        `Sin estadísticas de temporada para ${a.fullName}; el análisis se apoya en datos parciales.`,
      ),
    )
  if (!b.stats)
    warnings.push(
      pick(
        locale,
        `No season stats for ${b.fullName}; the analysis leans on partial data.`,
        `Sin estadísticas de temporada para ${b.fullName}; el análisis se apoya en datos parciales.`,
      ),
    )
  if (a.league.slug !== b.league.slug) {
    warnings.push(
      pick(
        locale,
        "Comparing across leagues doesn't normalize pace or defensive level. Treat the rankings as indicative.",
        "Comparar entre ligas no normaliza el ritmo ni el nivel defensivo. Toma las clasificaciones como orientativas.",
      ),
    )
  }
  const aGp = num(a.stats?.gamesPlayed ?? null) ?? 0
  const bGp = num(b.stats?.gamesPlayed ?? null) ?? 0
  const gpUnit = pick(locale, "GP", "PJ")
  if (aGp > 0 && aGp < 15)
    warnings.push(
      pick(
        locale,
        `Small sample for ${a.fullName} (${aGp} ${gpUnit}).`,
        `Muestra pequeña para ${a.fullName} (${aGp} ${gpUnit}).`,
      ),
    )
  if (bGp > 0 && bGp < 15)
    warnings.push(
      pick(
        locale,
        `Small sample for ${b.fullName} (${bGp} ${gpUnit}).`,
        `Muestra pequeña para ${b.fullName} (${bGp} ${gpUnit}).`,
      ),
    )
  return warnings
}

export function comparePlayers(
  a: ComparePlayer,
  b: ComparePlayer,
  locale: Locale = "en",
): ComparisonOutput {
  const categories: CategoryResult[] = [
    categoryScoring(a, b, locale),
    categoryPlaymaking(a, b, locale),
    categoryRebounding(a, b, locale),
    categoryDefense(a, b, locale),
    categoryEfficiency(a, b, locale),
    categoryAvailability(a, b, locale),
  ]

  let aScore = 0
  let bScore = 0
  let valid = 0
  for (const c of categories) {
    if (c.winner === "a") {
      aScore += 1
      valid += 1
    } else if (c.winner === "b") {
      bScore += 1
      valid += 1
    } else if (c.winner === "tie") {
      aScore += 0.5
      bScore += 0.5
      valid += 1
    }
  }

  const confidence: "high" | "medium" | "low" =
    valid >= 5 ? "high" : valid >= 3 ? "medium" : "low"

  const insights = buildInsights(a, b, categories, locale)
  const verdict = buildVerdict(a, b, categories, aScore, bScore, locale)

  return {
    a: { slug: a.slug, fullName: a.fullName, league: a.league.name },
    b: { slug: b.slug, fullName: b.fullName, league: b.league.name },
    categories,
    overall: {
      aScore,
      bScore,
      leader: aScore > bScore ? "a" : bScore > aScore ? "b" : "tie",
      confidence,
    },
    insights,
    verdict,
    archetype: {
      a: archetypeLabel(detectArchetypeKey(a.stats, a.position), a.position, locale),
      b: archetypeLabel(detectArchetypeKey(b.stats, b.position), b.position, locale),
    },
    fitNotes: buildFitNotes(a, b, locale),
    warnings: buildWarnings(a, b, locale),
  }
}
