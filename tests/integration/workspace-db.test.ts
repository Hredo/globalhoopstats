/**
 * Integration tests against a REAL MySQL with the schema pushed and the
 * synthetic fixture loaded (scripts/seed-fixture.ts). Skipped unless
 * INTEGRATION_DATABASE_URL is set — CI sets it to its MySQL service:
 *
 *   INTEGRATION_DATABASE_URL=mysql://root@127.0.0.1:3310/ghs_test pnpm test tests/integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const URL_ = process.env.INTEGRATION_DATABASE_URL
const suite = URL_ ? describe : describe.skip

suite("workspace on a real database", () => {
  let backupDir = ""

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_
    backupDir = await mkdtemp(join(tmpdir(), "ghs-backup-"))
    process.env.BACKUP_DIR = backupDir
  })

  afterAll(async () => {
    const { closeDb } = await import("@/lib/db/client")
    await closeDb()
    await rm(backupDir, { recursive: true, force: true })
  })

  it("learns projection factors from the fixture's promotions", async () => {
    const { loadTransitions } = await import("@/lib/scouting/profile")
    const { learnFactors } = await import("@/lib/scouting/projection-model")
    const f = learnFactors(await loadTransitions("eba", "leb-plata"))
    expect(f?.method).toBe("transitions")
    // Promoted players produce less per minute against better opponents.
    expect(f!.rate.pts).toBeLessThan(1)
    expect(f!.sample).toBeGreaterThanOrEqual(8)
  })

  it("follow snapshot → diff produces a team-change alert", async () => {
    const { getDb } = await import("@/lib/db/client")
    const { players } = await import("@/lib/db/schema")
    const { playerSnapshot } = await import("@/lib/alerts/snapshot")
    const { diffPlayer } = await import("@/lib/alerts/diff")
    const db = getDb()
    const [p] = await db.select({ id: players.id }).from(players).limit(1)
    const snap = await playerSnapshot(p!.id)
    expect(snap?.kind).toBe("player")
    const moved = { ...snap!, teamId: "00000000-0000-0000-0000-000000000000", teamName: "Elsewhere" }
    const events = diffPlayer(snap!, moved, null)
    expect(events[0]?.type).toBe("team_change")
  })

  it("writes a backup that verifies row for row", async () => {
    const { runBackup, verifyBackup } = await import("@/lib/ops/backup")
    const status = await runBackup()
    expect(status.error).toBeUndefined()
    expect(status.ok).toBe(true)
    expect(status.tables.players).toBeGreaterThan(0)
    const files = await readdir(backupDir)
    expect(files.length).toBe(1)
    const check = await verifyBackup(join(backupDir, files[0]!))
    expect(check.footerOk).toBe(true)
    expect(check.tables.player_season_stats).toBe(status.tables.player_season_stats)
  })

  it("restores that backup into an empty database with identical counts", async () => {
    const target = process.env.INTEGRATION_RESTORE_URL
    if (!target) return
    const files = await readdir(backupDir)
    const res = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/restore-backup.ts", join(backupDir, files[0]!)],
      { env: { ...process.env, DATABASE_URL: target }, encoding: "utf8" },
    )
    expect(res.stderr).toBe("")
    expect(res.stdout).toContain("counts verified")
  }, 120_000)
})
