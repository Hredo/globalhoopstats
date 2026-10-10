"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useT } from "@/lib/i18n/provider"
import { useSession } from "@/lib/auth/use-session"

/** CSV download of the directory as filtered (league + season), for signed-in users. */
export function ExportLinks({ league, season }: { league: string; season: string }) {
  const t = useT()
  const pathname = usePathname()
  const { user, status } = useSession()
  if (status === "loading") return null
  const q = new URLSearchParams({ season })
  if (league) q.set("league", league)
  const cls = "font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 transition hover:text-brand-300"
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={cls}>
        {t("workspace.export.signIn")}
      </Link>
    )
  }
  return (
    <span className="flex items-center gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-600">{t("workspace.export.label")}</span>
      <a href={`/api/export/players?${q}`} className={cls}>CSV</a>
      <a href={`/api/export/players?${q}&excel=1`} className={cls}>{t("workspace.export.excel")}</a>
    </span>
  )
}
