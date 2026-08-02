/*
 * Exercises every part of the postgres-js-compatible API that the maintenance
 * scripts rely on, against a real MySQL server. Run before trusting the shim:
 *
 *   DATABASE_URL="mysql://root:ghsdev@127.0.0.1:3399/globalhoopstats" \
 *     pnpm exec tsx scripts/verify-sql-shim.ts
 */
import { createSql, type Row } from "./lib/sql"
import { randomUUID } from "node:crypto"

const sql = createSql()
let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++
    console.log(`  ok    ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function main() {
  // ── plain query + parameter binding ──────────────────────────────────────
  const one = await sql<{ n: number }[]>`select 1 + 1 as n`
  check("tagged template returns rows", Number(one[0]?.n) === 2)

  const bound = await sql<{ v: string }[]>`select ${"o'brien"} as v`
  check("values bind as parameters, not interpolation", bound[0]?.v === "o'brien")

  // ── fixtures ─────────────────────────────────────────────────────────────
  const lid = randomUUID()
  const sid = randomUUID()
  const tid = randomUUID()
  await sql`insert into leagues (id, name, slug, region) values (${lid}, ${"L"}, ${"shim-l"}, ${"ES"})`
  await sql`insert into seasons (id, name, is_current) values (${sid}, ${"SHIM"}, ${false})`
  await sql`insert into teams (id, name, slug) values (${tid}, ${"T"}, ${"shim-t"})`

  const ids: string[] = []
  for (const [i, last] of ["Álvarez", "Bravo", "Costa"].entries()) {
    const pid = randomUUID()
    ids.push(pid)
    await sql`insert into players (id, first_name, last_name, slug)
              values (${pid}, ${"P" + i}, ${last}, ${"shim-p" + i})`
  }

  // ── lazy fragments ───────────────────────────────────────────────────────
  // A query that is built but not awaited must stay inert and be embeddable in
  // another query, parameters and all. Executing it eagerly would turn it into
  // a Promise and silently corrupt the outer statement.
  const scope = sql`from players where slug like ${"shim-p%"}`
  const scoped = await sql<{ n: number }[]>`select count(*) as n ${scope}`
  check("an un-awaited query embeds as a fragment", Number(scoped[0]?.n) === 3,
    `got ${scoped[0]?.n}`)

  const twoParams = sql`where last_name = ${"Bravo"}`
  const merged = await sql<{ n: number }[]>`
    select count(*) as n from players ${twoParams} and slug like ${"shim-%"}`
  check("fragment parameters merge in order", Number(merged[0]?.n) === 1,
    `got ${merged[0]?.n}`)

  // ── sql(array) for IN lists ──────────────────────────────────────────────
  const inList = await sql<{ id: string }[]>`
    select id from players where id in ${sql(ids)} order by slug`
  check("sql(array) expands an IN list", inList.length === 3, `${inList.length} rows`)

  const emptyIn = await sql`select id from players where id in ${sql([])}`
  check("sql([]) matches nothing instead of crashing", emptyIn.length === 0)

  // ── sql(identifier) ──────────────────────────────────────────────────────
  const col = "last_name"
  const byIdent = await sql<{ v: string }[]>`
    select ${sql(col)} as v from players where id = ${ids[0]}`
  check("sql(col) renders an identifier", byIdent[0]?.v === "Álvarez", byIdent[0]?.v)

  const dotted = await sql<{ v: string }[]>`
    select ${sql("p.last_name")} as v from players p where p.id = ${ids[1]}`
  check("sql('p.col') renders a dotted identifier", dotted[0]?.v === "Bravo")

  let rejected = false
  try {
    await sql`select ${sql("evil; drop table players")} from players`
  } catch {
    rejected = true
  }
  check("sql() rejects an unsafe identifier", rejected)

  // ── sql(object) for UPDATE SET ───────────────────────────────────────────
  const fills: Record<string, unknown> = { nationality: "ES", height_cm: 201 }
  const upd = await sql`update players set ${sql(fills)} where id = ${ids[0]}`
  check("sql(obj) expands UPDATE SET", upd.count === 1, `count ${upd.count}`)
  const after = await sql<{ nationality: string; height_cm: number }[]>`
    select nationality, height_cm from players where id = ${ids[0]}`
  check(
    "the SET actually wrote both columns",
    after[0]?.nationality === "ES" && Number(after[0]?.height_cm) === 201,
    JSON.stringify(after[0]),
  )

  // ── .count semantics ─────────────────────────────────────────────────────
  const noMatch = await sql`update players set nationality = ${"FR"} where id = ${randomUUID()}`
  check(".count is 0 when nothing matches", noMatch.count === 0, `count ${noMatch.count}`)
  const readCount = await sql`select id from players where id in ${sql(ids)}`
  check(".count on a read is the row count", readCount.count === 3, `count ${readCount.count}`)

  // ── sql.json ─────────────────────────────────────────────────────────────
  const statId = randomUUID()
  await sql`insert into player_season_stats (id, player_id, team_id, league_id, season_id, games_played)
            values (${statId}, ${ids[0]}, ${tid}, ${lid}, ${sid}, ${1})`
  const zones = { paint: { m: 5, a: 9 }, leftWing3: { m: 2, a: 6 } }
  await sql`update player_season_stats set shot_zones = ${sql.json(zones)} where id = ${statId}`
  const back = await sql<{ shot_zones: unknown }[]>`
    select shot_zones from player_season_stats where id = ${statId}`
  const parsed =
    typeof back[0]?.shot_zones === "string"
      ? JSON.parse(back[0].shot_zones as string)
      : back[0]?.shot_zones
  // Compared key by key, not as a string: MySQL 8's native JSON type reorders
  // object keys on storage (MariaDB, where json is LONGTEXT, does not). The
  // application only ever reads these by key, so ordering is immaterial.
  const stable = (o: unknown): string =>
    o === null || typeof o !== "object"
      ? JSON.stringify(o)
      : Array.isArray(o)
        ? `[${o.map(stable).join(",")}]`
        : `{${Object.keys(o as object)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${stable((o as Row)[k])}`)
            .join(",")}}`
  check("sql.json round-trips", stable(parsed) === stable(zones),
    JSON.stringify(parsed))

  // ── transactions ─────────────────────────────────────────────────────────
  await sql.begin(async (tx) => {
    await tx`update players set nationality = ${"IT"} where id = ${ids[1]}`
  })
  const committed = await sql<{ nationality: string }[]>`
    select nationality from players where id = ${ids[1]}`
  check("sql.begin commits on success", committed[0]?.nationality === "IT")

  let threw = false
  try {
    await sql.begin(async (tx) => {
      await tx`update players set nationality = ${"XX"} where id = ${ids[2]}`
      throw new Error("boom")
    })
  } catch {
    threw = true
  }
  const rolled = await sql<{ nationality: string | null }[]>`
    select nationality from players where id = ${ids[2]}`
  check("sql.begin rolls back on throw", threw && rolled[0]?.nationality === null,
    `nationality ${rolled[0]?.nationality}`)

  // ── cleanup ──────────────────────────────────────────────────────────────
  await sql`delete from players where id in ${sql(ids)}`
  await sql`delete from teams where id = ${tid}`
  await sql`delete from seasons where id = ${sid}`
  await sql`delete from leagues where id = ${lid}`

  console.log(`\n${pass} passed, ${fail} failed`)
  await sql.end()
  if (fail > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error(err)
  await sql.end()
  process.exit(1)
})
