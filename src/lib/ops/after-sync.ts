/**
 * Work that runs after a data sync, in the same detached job, so production
 * needs no extra cron lines: alerts for followers, then the nightly backup
 * (at most once every 20 hours, whichever sync triggers it).
 */
import { runAlerts } from "@/lib/alerts/engine"
import { backupIsFresh, runBackup } from "@/lib/ops/backup"

export async function afterSync(tag: string): Promise<void> {
  try {
    const r = await runAlerts()
    console.log(`[${tag}] alerts: ${r.notifications} notifications, ${r.pushed} pushed, ${r.emailed} emailed`)
  } catch (err) {
    console.error(`[${tag}] alerts failed:`, err)
  }
  try {
    if (!(await backupIsFresh())) {
      const b = await runBackup()
      console.log(
        b.ok
          ? `[${tag}] backup ok — ${(b.bytes / 1e6).toFixed(1)} MB, verified`
          : `[${tag}] backup FAILED — ${b.error}`,
      )
    }
  } catch (err) {
    console.error(`[${tag}] backup crashed:`, err)
  }
}
