/**
 * Load a nightly backup (lib/ops/backup.ts) into a database.
 *
 *   DATABASE_URL=mysql://root@127.0.0.1:3310/ghs_restore pnpm db:push
 *   DATABASE_URL=mysql://root@127.0.0.1:3310/ghs_restore pnpm db:restore ghs-2026-10-11T05-40-00-000Z.ndjson.gz
 *
 * The target must already have the schema (`pnpm db:push`). Tables present in
 * the backup are emptied first and refilled in dependency order.
 *
 * Like seed-fixture it never reads .env (that points at production) and
 * refuses a non-local DATABASE_URL unless `--allow-remote` is passed — a
 * restore into production is a deliberate act, not a typo.
 */
import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { createGunzip } from "node:zlib"
import mysql from "mysql2/promise"
import { BACKUP_TABLES, verifyBackup } from "@/lib/ops/backup"

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const allowRemote = args.includes("--allow-remote")
const url = process.env.DATABASE_URL ?? ""

if (!file || !url) {
  console.error("usage: DATABASE_URL=… pnpm db:restore <backup.ndjson.gz> [--allow-remote]")
  process.exit(1)
}
const host = new URL(url).hostname
if (!["127.0.0.1", "localhost", "::1", "mysql"].includes(host) && !allowRemote) {
  console.error(`restore-backup: refusing to write to "${host}" without --allow-remote.`)
  process.exit(1)
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

/** JSON turned dates into ISO strings and json columns into objects; undo both. */
function cell(v: unknown): unknown {
  if (typeof v === "string" && ISO.test(v)) return v.replace("T", " ").replace("Z", "")
  if (v !== null && typeof v === "object") return JSON.stringify(v)
  return v
}

async function main() {
  console.log(`verifying ${file}…`)
  const check = await verifyBackup(file!)
  if (!check.footerOk) throw new Error("backup is truncated or its counts do not match")
  console.log(`  ok · sha256 ${check.sha256.slice(0, 16)}… · ${Object.keys(check.tables).length} tables`)

  const conn = await mysql.createConnection({ uri: url, timezone: "Z" })
  await conn.query("SET FOREIGN_KEY_CHECKS=0")
  try {
    for (const t of [...BACKUP_TABLES].reverse()) {
      if (check.tables[t] != null) await conn.query(`DELETE FROM \`${t}\``)
    }
    const lines = createInterface({ input: createReadStream(file!).pipe(createGunzip()), crlfDelay: Infinity })
    let table = ""
    let batch: Record<string, unknown>[] = []
    const flush = async () => {
      if (!batch.length) return
      const cols = Object.keys(batch[0]!)
      await conn.query(
        `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES ?`,
        [batch.map((r) => cols.map((c) => cell(r[c])))],
      )
      batch = []
    }
    for await (const line of lines) {
      if (!line) continue
      const obj = JSON.parse(line) as { t?: string; r?: Record<string, unknown> }
      if (!obj.t || !obj.r) continue
      if (obj.t !== table || batch.length >= 500) {
        await flush()
        table = obj.t
      }
      batch.push(obj.r)
    }
    await flush()
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS=1")
  }

  for (const [t, n] of Object.entries(check.tables)) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``)
    const got = Number((rows as Array<{ n: number }>)[0]?.n ?? 0)
    if (got !== n) throw new Error(`${t}: expected ${n} rows, found ${got}`)
  }
  await conn.end()
  console.log(`restored ${Object.values(check.tables).reduce((a, b) => a + b, 0)} rows, counts verified`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
