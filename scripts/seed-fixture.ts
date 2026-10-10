/**
 * Deterministic SYNTHETIC dataset for local development and CI.
 *
 *   DATABASE_URL=mysql://root@127.0.0.1:3310/ghs_test pnpm db:push
 *   DATABASE_URL=mysql://root@127.0.0.1:3310/ghs_test pnpm seed:fixture
 *
 * Six leagues, three seasons, clubs, rosters, staff and box-score totals — all
 * invented, all reproducible from one seed — including players who move up a
 * level between seasons (EBA → Segunda FEB → Primera FEB, ACB → EuroLeague),
 * so the projection model has real transitions to learn from. Nobody in here
 * is a real person.
 *
 * It refuses to run against anything but a local database: it DELETES the
 * sports tables before writing, and pointing it at production would wipe the
 * real catalogue. That is also why it never reads .env / .env.local (which
 * point at production) — DATABASE_URL must be passed explicitly.
 *
 * Optional: SEED_USER_EMAIL + SEED_USER_PASSWORD create a login for E2E tests.
 */
import { closeDb, getDb } from "@/lib/db/client"
import {
  apiClients,
  coaches,
  leagues,
  newId,
  players,
  playerSeasonStats,
  seasons,
  teams,
  teamSeasonStats,
  users,
} from "@/lib/db/schema"
import { hashPassword } from "@/lib/auth/password"
import { hashApiKey } from "@/lib/api/keys"
import { CURRENT_SEASON_START_YEAR, seasonLabel } from "@/lib/seasons"
import { eq } from "drizzle-orm"

const url = process.env.DATABASE_URL ?? ""
const host = (() => {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
})()
if (!["127.0.0.1", "localhost", "::1", "mysql"].includes(host)) {
  console.error(
    `seed-fixture: refusing to run against "${host || "(no DATABASE_URL)"}". ` +
      "Only local databases (127.0.0.1 / localhost / the CI 'mysql' service) are allowed.",
  )
  process.exit(1)
}

/** mulberry32 — tiny, fast, and the same numbers on every machine. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20261010)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!
const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const LEAGUES = [
  { slug: "nba", name: "NBA", region: "USA", level: 1.0, city: ["Harbor", "Mesa", "Granite", "Lakeview", "Copper", "Summit"] },
  { slug: "euroleague", name: "EuroLeague", region: "Europe", level: 0.9, city: ["Aurora", "Borealis", "Castellan", "Danube", "Elbe", "Fjord"] },
  { slug: "acb", name: "Liga Endesa", region: "Spain", level: 0.74, city: ["Albar", "Brezo", "Cierzo", "Dunas", "Encina", "Faro"] },
  { slug: "leb-oro", name: "Primera FEB", region: "Spain", level: 0.52, city: ["Galera", "Hontana", "Isla", "Jara", "Lindes", "Mirador"] },
  { slug: "leb-plata", name: "Segunda FEB", region: "Spain", level: 0.4, city: ["Nogal", "Olmo", "Pinar", "Quejigo", "Robledo", "Sabina"] },
  { slug: "eba", name: "Tercera FEB", region: "Spain", level: 0.28, city: ["Tejo", "Ulmo", "Vega", "Yedra", "Zarza", "Alcor"] },
] as const

const FIRST = ["Adrián", "Bruno", "Carlos", "Dario", "Elías", "Fabio", "Gael", "Hugo", "Iker", "Jonás", "Kilian", "Leo", "Marco", "Nil", "Óscar", "Pau", "Quique", "Rubén", "Saúl", "Teo", "Unai", "Víctor", "Xavi", "Yeray", "Zaid", "Aaron", "Bastian", "Caleb", "Dorian", "Emil"]
const LAST = ["Arenal", "Barroso", "Cuesta", "Delmonte", "Escobedo", "Ferrán", "Galdós", "Herrera", "Ibarra", "Jurado", "Lamela", "Montes", "Navas", "Olivera", "Prado", "Quintana", "Roldán", "Salcedo", "Torralba", "Urquiza", "Valcárcel", "Zamora", "Abreu", "Bermejo", "Carrasco", "Dorado"]
const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const

const SEASON_YEARS = [CURRENT_SEASON_START_YEAR - 2, CURRENT_SEASON_START_YEAR - 1, CURRENT_SEASON_START_YEAR]
const TEAMS_PER_LEAGUE = 6
const ROSTER = 12

type StatLine = typeof playerSeasonStats.$inferInsert

/** Box-score totals for a player of a given talent (0..1) in a league. */
function statLine(talent: number, level: number, games: number, position: string): Omit<StatLine, "id" | "playerId" | "teamId" | "leagueId" | "seasonId"> {
  // Production in a league scales with how far above that league's level the
  // player is: a talent of 0.6 dominates EBA and barely plays in the NBA.
  const edge = Math.max(0.05, 0.55 + (talent - level) * 1.6)
  const mpg = Math.min(36, 8 + edge * 22 + between(-2, 2))
  const big = position === "PF" || position === "C"
  const guard = position === "PG" || position === "SG"
  const ppg = Math.max(0.5, edge * 17 * (mpg / 28) + between(-1.5, 1.5))
  const rpg = Math.max(0.3, (big ? 6.5 : 3) * edge * (mpg / 28) + between(-0.6, 0.6))
  const apg = Math.max(0.1, (guard ? 4.8 : 1.6) * edge * (mpg / 28) + between(-0.4, 0.4))
  const fga = ppg / 1.1
  const fgPct = Math.min(0.62, Math.max(0.33, 0.42 + edge * 0.06 + between(-0.04, 0.04)))
  const threeA = guard ? fga * 0.45 : big ? fga * 0.12 : fga * 0.35
  const threePct = Math.min(0.45, Math.max(0.25, 0.33 + between(-0.05, 0.06)))
  const fta = ppg * 0.28
  const tot = (x: number) => Math.round(x * games)
  return {
    gamesPlayed: games,
    minutesTotal: tot(mpg),
    pointsTotal: tot(ppg),
    reboundsTotal: tot(rpg),
    offensiveRebounds: tot(rpg * 0.28),
    defensiveRebounds: tot(rpg * 0.72),
    assistsTotal: tot(apg),
    stealsTotal: tot(Math.max(0.1, 0.9 * edge + between(-0.2, 0.2))),
    blocksTotal: tot(Math.max(0, (big ? 0.9 : 0.2) * edge + between(-0.1, 0.1))),
    fgAttempted: tot(fga),
    fgMade: tot(fga * fgPct),
    threeAttempted: tot(threeA),
    threeMade: tot(threeA * threePct),
    ftAttempted: tot(fta),
    ftMade: tot(fta * 0.76),
    foulsTotal: tot(2.1),
    plusMinus: Math.round((edge - 0.55) * 4 * games),
    per: Number((9 + edge * 14 + between(-2, 2)).toFixed(1)),
    trueShootingPct: Number((fgPct + 0.1).toFixed(3)),
  }
}

async function main() {
  const db = getDb()
  console.log(`seed-fixture → ${host}`)

  // Children first: the foreign keys cascade, but being explicit keeps the
  // script independent of how the schema evolves.
  await db.delete(playerSeasonStats)
  await db.delete(teamSeasonStats)
  await db.delete(coaches)
  await db.delete(players)
  await db.delete(teams)
  await db.delete(seasons)
  await db.delete(leagues)

  const seasonRows = SEASON_YEARS.map((y) => ({
    id: newId(),
    name: seasonLabel(y),
    isCurrent: y === CURRENT_SEASON_START_YEAR,
  }))
  await db.insert(seasons).values(seasonRows)

  const usedSlugs = new Set<string>()
  const uniqueSlug = (base: string) => {
    let s = slugify(base)
    let n = 2
    while (usedSlugs.has(s)) s = `${slugify(base)}-${n++}`
    usedSlugs.add(s)
    return s
  }

  type SeedPlayer = { id: string; talent: number; position: string; league: number; team: string }
  const roster: SeedPlayer[][] = []
  const statRows: StatLine[] = []
  const teamIdsByLeague: string[][] = []

  for (const [li, lg] of LEAGUES.entries()) {
    const leagueId = newId()
    await db.insert(leagues).values({ id: leagueId, name: lg.name, slug: lg.slug, region: lg.region })

    const teamRows = lg.city.slice(0, TEAMS_PER_LEAGUE).map((city) => {
      const name = `${city} ${pick(["Basket", "CB", "Club", "Atlético", "Union", "Racing"])}`
      return {
        id: newId(),
        name,
        slug: uniqueSlug(name),
        city,
        arena: `Pabellón ${city}`,
        arenaCapacity: Math.round(between(800, 15000)),
        foundedYear: Math.round(between(1940, 2010)),
        primaryColor: pick(["#c2410c", "#1d4ed8", "#15803d", "#7e22ce", "#b91c1c", "#0f766e"]),
      }
    })
    await db.insert(teams).values(teamRows)
    teamIdsByLeague.push(teamRows.map((t) => t.id))

    const list: SeedPlayer[] = []
    for (const team of teamRows) {
      for (let i = 0; i < ROSTER; i++) {
        const first = pick(FIRST)
        const last = `${pick(LAST)} ${pick(LAST)}`
        const id = newId()
        const position = POSITIONS[i % POSITIONS.length]!
        await db.insert(players).values({
          id,
          firstName: first,
          lastName: last,
          slug: uniqueSlug(`${first} ${last}`),
          position,
          heightCm: Math.round(between(180, 215)),
          weightKg: Math.round(between(78, 118)),
          birthdate: `${Math.round(between(1992, 2006))}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`,
          nationality: pick(["España", "España", "España", "Francia", "Serbia", "Argentina", "EE. UU.", "Lituania"]),
        })
        list.push({ id, talent: Math.min(1.05, Math.max(0.15, lg.level + between(-0.12, 0.14))), position, league: li, team: team.id })
      }
      for (const [si, s] of seasonRows.entries()) {
        await db.insert(teamSeasonStats).values({
          teamId: team.id,
          seasonId: s.id,
          leagueId,
          gamesPlayed: si === 2 ? 6 : 30,
          wins: 0,
          losses: 0,
          pace: Number(between(68, 76).toFixed(1)),
        })
        const coachName = `${pick(FIRST)} ${pick(LAST)}`
        await db.insert(coaches).values({
          teamId: team.id,
          leagueId,
          seasonId: s.id,
          fullName: coachName,
          slug: slugify(coachName),
          role: "head_coach",
          nationality: "España",
        })
      }
    }
    roster.push(list)

    // Every player has a line in each of the two completed seasons and an
    // early line (6 games) in the current one.
    for (const p of list) {
      for (const [si, s] of seasonRows.entries()) {
        statRows.push({
          playerId: p.id,
          teamId: p.team,
          leagueId,
          seasonId: s.id,
          ...statLine(p.talent + si * 0.02, lg.level, si === 2 ? 6 : Math.round(between(22, 34)), p.position),
        })
      }
    }
  }

  // Promotions: the best players of a league move one level up in the
  // following season — same person, new league. Within FEB and within the top
  // tier only (a FEB person is never an ACB/EL/NBA record; see leagues-tier.ts).
  const leagueIds = (await db.select().from(leagues)).reduce<Record<string, string>>((acc, l) => ((acc[l.slug] = l.id), acc), {})
  const promotions: Array<[string, string]> = [
    ["eba", "leb-plata"],
    ["leb-plata", "leb-oro"],
    ["acb", "euroleague"],
  ]
  for (const [from, to] of promotions) {
    const fromIdx = LEAGUES.findIndex((l) => l.slug === from)
    const toIdx = LEAGUES.findIndex((l) => l.slug === to)
    const best = [...roster[fromIdx]!].sort((a, b) => b.talent - a.talent).slice(0, 14)
    for (const p of best) {
      const toTeam = pick(teamIdsByLeague[toIdx]!)
      // Last season → the new league; the current season too.
      for (const si of [1, 2]) {
        const season = seasonRows[si]!
        const idx = statRows.findIndex((r) => r.playerId === p.id && r.seasonId === season.id)
        statRows[idx] = {
          playerId: p.id,
          teamId: toTeam,
          leagueId: leagueIds[to]!,
          seasonId: season.id,
          ...statLine(p.talent + si * 0.02, LEAGUES[toIdx]!.level, si === 2 ? 6 : Math.round(between(20, 32)), p.position),
        }
      }
    }
  }

  for (let i = 0; i < statRows.length; i += 400) {
    await db.insert(playerSeasonStats).values(statRows.slice(i, i + 400))
  }

  const email = process.env.SEED_USER_EMAIL
  const password = process.env.SEED_USER_PASSWORD
  if (email && password) {
    await db.delete(users).where(eq(users.email, email))
    await db.insert(users).values({
      email,
      name: "E2E Scout",
      passwordHash: await hashPassword(password),
    })
    console.log(`  user ${email}`)

    // SEED_API_KEY (ghs_… format) registers a public-API client for that user,
    // so E2E can exercise /api/v1 without going through the admin panel.
    const apiKey = process.env.SEED_API_KEY
    if (apiKey && /^ghs_[A-Za-z0-9_-]{43}$/.test(apiKey)) {
      const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
      await db.delete(apiClients).where(eq(apiClients.keyHash, hashApiKey(apiKey)))
      await db.insert(apiClients).values({
        userId: owner!.id,
        name: "E2E",
        keyPrefix: apiKey.slice(0, 12),
        keyHash: hashApiKey(apiKey),
        dailyQuota: 500,
      })
      console.log("  api client E2E")
    }
  }

  console.log(`  ${LEAGUES.length} leagues · ${seasonRows.length} seasons · ${roster.flat().length} players · ${statRows.length} stat lines`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => closeDb())
