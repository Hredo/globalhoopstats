import mysql from "mysql2/promise"
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2"
import { getServerEnv } from "@/lib/env"
import * as schema from "@/lib/db/schema"

// Named explicitly rather than inferred from `drizzle`: the inferred type
// intersects `$client` with mysql2's *callback* Pool, which is a different
// (and incompatible) type from the promise Pool we actually construct.
type DrizzleDb = MySql2Database<typeof schema>

let dbInstance: DrizzleDb | null = null
let poolInstance: mysql.Pool | null = null

export function getDb(): DrizzleDb {
  if (dbInstance) return dbInstance
  const { DATABASE_URL } = getServerEnv()
  poolInstance = mysql.createPool({
    uri: DATABASE_URL,
    // Read and write every datetime as UTC. MySQL's DATETIME carries no zone,
    // so without this mysql2 would reinterpret values in the server's local
    // zone and timestamps would drift — the one place a Postgres→MySQL move
    // silently corrupts data.
    timezone: "Z",
    // Return DECIMAL/BIGINT as JS numbers rather than strings, matching what
    // postgres-js used to hand back so downstream arithmetic is unchanged.
    // decimalNumbers matters more than it looks: every average computed in SQL
    // (`sum(points)/nullif(sum(games),0)`, `round(x, 1)`) comes back as DECIMAL,
    // and mysql2 hands those over as STRINGS by default — so `.toFixed()` and
    // any arithmetic on them would fail at runtime, not at compile time.
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
    // Shared hosting caps concurrent connections hard; stay well under it.
    connectionLimit: 5,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  })
  dbInstance = drizzle(poolInstance, { schema, mode: "default" })
  return dbInstance
}

/**
 * Rows from a raw `sql` query.
 *
 * postgres-js returned the row array straight out of `db.execute()`. mysql2
 * returns a `[rows, fields]` tuple instead, so the old call shape would hand
 * back field metadata — or, where the result was destructured, the wrong
 * element — while still type-checking. Every raw query goes through here so
 * that difference is handled in exactly one place.
 */
export async function rawRows<T>(
  result: Promise<unknown> | unknown,
): Promise<T[]> {
  const res = await result
  return (Array.isArray(res) ? res[0] : res) as T[]
}

export async function closeDb() {
  if (poolInstance) {
    try {
      await poolInstance.end()
    } catch {
      // already closed
    }
    poolInstance = null
    dbInstance = null
  }
}

export const schemaTables = schema
