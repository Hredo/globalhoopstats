/**
 * Nightly logical backup, written by the web process itself.
 *
 * Prod has no shell tooling of ours (no repo, no pnpm, no mysqldump wrapper —
 * see AGENTS.md rule 5), so the backup is a gzip'd NDJSON stream produced from
 * the app's own connection, then read back end to end to prove it restores:
 * every line parses, every table's row count matches the count taken when it
 * was dumped, and the file's SHA-256 is recorded. `scripts/restore-backup.ts`
 * loads one into a database.
 *
 * Ephemeral tables (sessions, rate limits, one-time codes, raw analytics) are
 * skipped: restoring them would resurrect expired logins and gigabytes of page
 * views, and losing them costs nothing.
 */
import { createReadStream, createWriteStream } from "node:fs"
import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises"
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { createGunzip, createGzip } from "node:zlib"
import { once } from "node:events"
import { sql } from "drizzle-orm"
import { getDb, rawRows } from "@/lib/db/client"
import { appConfig } from "@/lib/db/schema"
import { getServerEnv } from "@/lib/env"

/** Restore order: parents before children, so foreign keys hold. */
export const BACKUP_TABLES = [
  "leagues", "seasons", "teams", "players", "player_season_stats", "coaches",
  "team_season_stats", "videos", "sync_runs",
  "users", "user_settings", "user_api_keys", "two_factor_backup_codes",
  "conversations", "messages", "compare_uses", "playbook_plays",
  "announcements", "app_config", "waitlist_entries",
  "follows", "notifications", "push_subscriptions",
  "shortlists", "shortlist_members", "shortlist_items", "shortlist_comments",
  "shared_links", "api_clients", "app_errors",
] as const

const PAGE = 2000
export const BACKUP_STATUS_KEY = "ops.backup.last"

export type BackupStatus = {
  ok: boolean
  file: string | null
  bytes: number
  sha256: string | null
  tables: Record<string, number>
  startedAt: string
  finishedAt: string
  error?: string
}

export function backupDir(): string {
  return getServerEnv().BACKUP_DIR ?? join(homedir(), "backups", "ghs")
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await rawRows<{ n: number }>(
    getDb().execute(
      sql`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ${name}`,
    ),
  )
  return Number(rows[0]?.n ?? 0) > 0
}

/** Write one backup and verify it. Never throws: the status says what happened. */
export async function runBackup(): Promise<BackupStatus> {
  const startedAt = new Date().toISOString()
  const dir = backupDir()
  const file = join(dir, `ghs-${startedAt.replace(/[:.]/g, "-")}.ndjson.gz`)
  const tables: Record<string, number> = {}
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 })
    const gzip = createGzip({ level: 6 })
    const out = createWriteStream(file, { mode: 0o600 })
    gzip.pipe(out)
    const write = async (obj: unknown) => {
      if (!gzip.write(`${JSON.stringify(obj)}\n`)) await once(gzip, "drain")
    }
    await write({ type: "header", version: 1, createdAt: startedAt })

    const db = getDb()
    for (const table of BACKUP_TABLES) {
      if (!(await tableExists(table))) continue
      let count = 0
      for (let offset = 0; ; offset += PAGE) {
        // Table names come from the constant list above, and are still quoted
        // as identifiers rather than spliced in.
        const rows = await rawRows<Record<string, unknown>>(
          db.execute(
            sql`SELECT * FROM ${sql.identifier(table)} ORDER BY 1 LIMIT ${PAGE} OFFSET ${offset}`,
          ),
        )
        for (const row of rows) await write({ t: table, r: row })
        count += rows.length
        if (rows.length < PAGE) break
      }
      tables[table] = count
    }
    await write({ type: "footer", tables })
    gzip.end()
    await once(out, "finish")
    await chmod(file, 0o600).catch(() => {})

    const verified = await verifyBackup(file)
    const bytes = (await stat(file)).size
    const mismatch = Object.entries(tables).find(([t, n]) => (verified.tables[t] ?? 0) !== n)
    const status: BackupStatus = {
      ok: !mismatch && verified.footerOk,
      file,
      bytes,
      sha256: verified.sha256,
      tables,
      startedAt,
      finishedAt: new Date().toISOString(),
      ...(mismatch
        ? { error: `verify: ${mismatch[0]} has ${verified.tables[mismatch[0]] ?? 0} rows in the file, ${mismatch[1]} dumped` }
        : verified.footerOk
          ? {}
          : { error: "verify: footer missing — the file is truncated" }),
    }
    await prune(dir)
    await saveStatus(status)
    return status
  } catch (err) {
    const status: BackupStatus = {
      ok: false,
      file: null,
      bytes: 0,
      sha256: null,
      tables,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    }
    await rm(file, { force: true }).catch(() => {})
    await saveStatus(status).catch(() => {})
    return status
  }
}

/** Stream a backup back: parse every line, count rows per table, hash the file. */
export async function verifyBackup(file: string): Promise<{
  tables: Record<string, number>
  footerOk: boolean
  sha256: string
}> {
  const hash = createHash("sha256")
  const raw = createReadStream(file)
  raw.on("data", (chunk) => hash.update(chunk))
  const lines = createInterface({ input: raw.pipe(createGunzip()), crlfDelay: Infinity })
  const tables: Record<string, number> = {}
  let footer: Record<string, number> | null = null
  for await (const line of lines) {
    if (!line) continue
    const obj = JSON.parse(line) as { t?: string; type?: string; tables?: Record<string, number> }
    if (obj.t) tables[obj.t] = (tables[obj.t] ?? 0) + 1
    else if (obj.type === "footer") footer = obj.tables ?? {}
  }
  const footerOk =
    footer !== null && Object.entries(footer).every(([t, n]) => (tables[t] ?? 0) === n)
  return { tables, footerOk, sha256: hash.digest("hex") }
}

async function prune(dir: string) {
  const keep = getServerEnv().BACKUP_KEEP
  const files = (await readdir(dir)).filter((f) => /^ghs-.*\.ndjson\.gz$/.test(f)).sort().reverse()
  for (const f of files.slice(keep)) await rm(join(dir, f), { force: true })
}

async function saveStatus(status: BackupStatus) {
  const value = JSON.stringify({ ...status, file: status.file?.split(/[\\/]/).pop() ?? null })
  await getDb()
    .insert(appConfig)
    .values({ key: BACKUP_STATUS_KEY, value, description: "Last nightly backup (written by the app)" })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } })
}

export async function lastBackupStatus(): Promise<BackupStatus | null> {
  const rows = await getDb()
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(sql`\`key\` = ${BACKUP_STATUS_KEY}`)
    .limit(1)
  try {
    return rows[0] ? (JSON.parse(rows[0].value) as BackupStatus) : null
  } catch {
    return null
  }
}

/** Whether a successful backup already exists within `hours`. */
export async function backupIsFresh(hours = 20): Promise<boolean> {
  const last = await lastBackupStatus()
  return !!last?.ok && Date.now() - new Date(last.finishedAt).getTime() < hours * 3600_000
}
