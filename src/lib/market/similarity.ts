/**
 * Similarity engine — the "find me a player like X" primitive that the AI
 * advisor lacked. Builds a normalised per-game style/production vector for
 * every player in the relevant league universe, then ranks by distance to the
 * target. Results are grounded in the database (real, clickable players),
 * priced via the valuation model, and annotated with a cross-league note.
 */
import { adjacentLeagueSlugs, translateRate } from "@/lib/market/league-strength"
import { getMarketPlayerBySlug, getMarketPool, type MarketPlayer } from "@/lib/market/pool"

export type SimilarPlayer = {
  player: MarketPlayer
  /** 0..100; 100 = statistical twin. */
  similarity: number
  /** Cross-league projection note vs the target's league, if different. */
  leagueNote: string | null
}

export type SimilarityOptions = {
  /** Restrict to these league slugs. Default: target league + adjacent ones. */
  leagueSlugs?: string[]
  /** Keep only players whose primary position bucket matches the target. */
  samePositionOnly?: boolean
  /** Maximum age. */
  maxAge?: number
  /** Exclude players on this team (e.g. the user's own roster). */
  excludeTeamId?: string
  limit?: number
}

type Vector = number[]

// Per-game feature set. Captures both volume and shooting profile so "similar"
// means similar ROLE, not just similar scoring.
function featureVector(p: MarketPlayer): Vector {
  const gp = p.stats.gamesPlayed || 1
  const pg = (t: number | null) => (t == null ? 0 : t / gp)
  return [
    pg(p.stats.pointsTotal),
    pg(p.stats.reboundsTotal),
    pg(p.stats.assistsTotal),
    pg(p.stats.stealsTotal),
    pg(p.stats.blocksTotal),
    (p.stats.fgPct ?? 0.45) * 30, // scale % onto a comparable magnitude
    (p.stats.threePct ?? 0.33) * 30,
    (p.stats.ftPct ?? 0.72) * 15,
    p.stats.minutesTotal != null ? p.stats.minutesTotal / gp : 20,
  ]
}

function positionBucket(position: string | null): string {
  const p = (position ?? "").toUpperCase()
  if (p.startsWith("PG") || p.startsWith("1")) return "G"
  if (p.startsWith("SG") || p.startsWith("2") || p === "G") return "G"
  if (p.startsWith("SF") || p.startsWith("3")) return "F"
  if (p.startsWith("PF") || p.startsWith("4")) return "F"
  if (p.startsWith("C") || p.startsWith("5")) return "C"
  return p.charAt(0) || "?"
}

/** Standardise each feature across the pool so no single stat dominates. */
function standardise(pool: MarketPlayer[]): {
  means: number[]
  stds: number[]
} {
  const vectors = pool.map(featureVector)
  const n = vectors.length || 1
  const dims = vectors[0]?.length ?? 0
  const means = new Array(dims).fill(0)
  for (const v of vectors) for (let i = 0; i < dims; i++) means[i] += v[i] / n
  const stds = new Array(dims).fill(0)
  for (const v of vectors)
    for (let i = 0; i < dims; i++) stds[i] += (v[i] - means[i]) ** 2 / n
  for (let i = 0; i < dims; i++) stds[i] = Math.sqrt(stds[i]) || 1
  return { means, stds }
}

function zScore(v: Vector, means: number[], stds: number[]): Vector {
  return v.map((x, i) => (x - means[i]) / stds[i])
}

function euclidean(a: Vector, b: Vector): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
  return Math.sqrt(s)
}

export async function findSimilarPlayers(
  slug: string,
  opts: SimilarityOptions = {},
): Promise<{ target: MarketPlayer; results: SimilarPlayer[] } | null> {
  const target = await getMarketPlayerBySlug(slug)
  if (!target) return null

  const leagueSlugs =
    opts.leagueSlugs ?? adjacentLeagueSlugs(target.league.slug, { includeSelf: true })
  const pool = await getMarketPool(leagueSlugs)

  // Make sure the target is in the pool we standardise over.
  const universe = pool.some((p) => p.id === target.id) ? pool : [...pool, target]
  if (universe.length < 2) return { target, results: [] }

  const { means, stds } = standardise(universe)
  const targetZ = zScore(featureVector(target), means, stds)
  const targetBucket = positionBucket(target.position)

  const scored = universe
    .filter((p) => p.id !== target.id)
    .filter((p) => !opts.excludeTeamId || p.team?.id !== opts.excludeTeamId)
    .filter((p) => opts.maxAge == null || p.age == null || p.age <= opts.maxAge)
    .filter(
      (p) => !opts.samePositionOnly || positionBucket(p.position) === targetBucket,
    )
    .map((p) => {
      const dist = euclidean(targetZ, zScore(featureVector(p), means, stds))
      // Map distance → 0..100 similarity (decaying). ~0 dist = 100.
      const similarity = Math.round(100 * Math.exp(-dist / 3))
      const rate = translateRate(p.league.slug, target.league.slug)
      const leagueNote =
        p.league.slug === target.league.slug
          ? null
          : rate < 0.97
            ? `Viene de ${p.league.name} (nivel inferior): proyecta a la baja al subir a ${target.league.name} (~×${rate.toFixed(2)}).`
            : rate > 1.03
              ? `Viene de ${p.league.name} (nivel superior): sus números deberían sostenerse o mejorar en ${target.league.name}.`
              : `Liga de nivel similar (${p.league.name}).`
      return { player: p, similarity, leagueNote }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, opts.limit ?? 12)

  return { target, results: scored }
}
