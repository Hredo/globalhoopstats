"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useT } from "@/lib/i18n/provider"
import type { LineupMember } from "@/lib/playbook/lineup"

type Data = { members: LineupMember[]; totals: { pts: number; reb: number; ast: number } }

/** The linked players' real numbers, shown beside the play they run. */
export function LineupStats({ slugs, compact = false }: { slugs: string[]; compact?: boolean }) {
  const t = useT()
  const [data, setData] = useState<Data | null>(null)
  const key = slugs.join(",")

  useEffect(() => {
    if (!key) {
      setData({ members: [], totals: { pts: 0, reb: 0, ast: 0 } }) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    let alive = true
    fetch(`/api/playbooks/lineup?slugs=${encodeURIComponent(key)}`)
      .then((r) => r.json() as Promise<Data>)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ members: [], totals: { pts: 0, reb: 0, ast: 0 } }))
    return () => {
      alive = false
    }
  }, [key])

  if (!data) return <div className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />
  if (data.members.length === 0) {
    return <p className="text-[13px] leading-relaxed text-ink-400">{t("playbook.lineup.empty")}</p>
  }
  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
            <th className="pb-2 text-left font-medium">{t("playbook.lineup.player")}</th>
            {compact ? null : <th className="pb-2 text-right font-medium">MIN</th>}
            <th className="pb-2 text-right font-medium">PTS</th>
            <th className="pb-2 text-right font-medium">REB</th>
            <th className="pb-2 text-right font-medium">AST</th>
            {compact ? null : <th className="pb-2 text-right font-medium">TS%</th>}
          </tr>
        </thead>
        <tbody>
          {data.members.map((m) => (
            <tr key={m.slug} className="border-t border-hairline">
              <td className="py-2 pr-2">
                <Link href={`/players/${m.slug}`} className="font-medium text-ink-100 hover:text-brand-300">
                  {m.name}
                </Link>
                <span className="block text-[11px] text-ink-500">
                  {[m.team, m.league, m.season].filter(Boolean).join(" · ")}
                </span>
              </td>
              {compact ? null : <td className="py-2 text-right font-mono tabular-nums text-ink-400">{m.mpg ?? "—"}</td>}
              <td className="py-2 text-right font-mono tabular-nums text-ink-50">{m.pts ?? "—"}</td>
              <td className="py-2 text-right font-mono tabular-nums text-ink-200">{m.reb ?? "—"}</td>
              <td className="py-2 text-right font-mono tabular-nums text-ink-200">{m.ast ?? "—"}</td>
              {compact ? null : (
                <td className="py-2 text-right font-mono tabular-nums text-ink-400">
                  {m.ts != null ? (m.ts * 100).toFixed(1) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-hairline-strong font-mono text-[12px] tabular-nums">
            <td className="pt-2 text-ink-400">{t("playbook.lineup.total")}</td>
            {compact ? null : <td />}
            <td className="pt-2 text-right font-semibold text-brand-300">{data.totals.pts}</td>
            <td className="pt-2 text-right text-ink-200">{data.totals.reb}</td>
            <td className="pt-2 text-right text-ink-200">{data.totals.ast}</td>
            {compact ? null : <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
