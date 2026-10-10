import Link from "next/link"
import type { Metadata } from "next"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import { playbookPlays, players } from "@/lib/db/schema"
import { getT } from "@/lib/i18n/server"
import { openShare } from "@/lib/workspace/shares"
import { shortlistDetail } from "@/lib/workspace/shortlists"
import { getPlayerLines, getPlayerPercentiles } from "@/lib/scouting/profile"
import { baseLine } from "@/lib/scouting/projection"
import { metricValues, minutesPerGame, trueShooting } from "@/lib/scouting/metrics"
import { parsePlay } from "@/lib/playbook/types"
import { PercentileProfile } from "@/components/scouting/percentile-profile"
import { SmartImage } from "@/components/ui/smart-image"
import { PersonAvatar } from "@/components/ui/person-avatar"
import { SharedPlayViewer } from "./play-viewer"

export const dynamic = "force-dynamic"

// Share links are private by intent: never indexed, never followed, and the
// referrer of anything clicked from here does not leak the token.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
}

const STATUSES = ["target", "contact", "watch", "discard"] as const

function Shell({ kicker, title, note, children, footer }: {
  kicker: string
  title: string
  note?: { label: string; text: string } | null
  children?: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-5xl pb-16 pt-10">
      <p className="gh-eyebrow">{kicker}</p>
      <h1 className="mt-3 break-words font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-ink-50 sm:text-5xl">
        {title}
      </h1>
      {note ? (
        <blockquote className="mt-6 max-w-2xl border-l-2 border-brand-500 pl-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{note.label}</p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-100">{note.text}</p>
        </blockquote>
      ) : null}
      <div className="mt-8">{children}</div>
      <footer className="mt-12 border-t border-hairline pt-5 text-[12px] text-ink-500">{footer}</footer>
    </div>
  )
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { t, locale } = await getT()
  const share = await openShare(token)
  const dateFmt = (d: Date) =>
    d.toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", { day: "numeric", month: "long", year: "numeric" })

  if (share.state !== "ok") {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <p className="font-display text-3xl font-bold text-ink-50">{t(`sharePage.${share.state}`)}</p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">
          {t("sharePage.goHome")}
        </Link>
      </div>
    )
  }

  const note = share.note ? { label: t("sharePage.note"), text: share.note } : null
  const footer = (
    <span>
      {t("sharePage.sharedBy")} · {t("sharePage.readOnly")} · {t("sharePage.expires", { date: dateFmt(share.expiresAt) })}
    </span>
  )
  const db = getDb()

  if (share.kind === "player") {
    const row = (await db.select({ slug: players.slug }).from(players).where(eq(players.id, share.targetId)).limit(1))[0]
    const p = row ? await getPlayerLines(row.slug) : null
    if (!p) return <Shell kicker={t("sharePage.player")} title="—" footer={footer} />
    const base = baseLine(p.lines)
    const pg = base ? metricValues(base.line, "perGame") : null
    const pctl = base
      ? {
          per40pace: await getPlayerPercentiles(p.id, base.leagueSlug, base.season, "per40pace"),
          perGame: await getPlayerPercentiles(p.id, base.leagueSlug, base.season, "perGame"),
        }
      : null
    const tiles: Array<[string, string]> = base && pg
      ? [
          ["MIN", minutesPerGame(base.line)?.toFixed(1) ?? "—"],
          ["PTS", pg.pts?.toFixed(1) ?? "—"],
          ["REB", pg.reb?.toFixed(1) ?? "—"],
          ["AST", pg.ast?.toFixed(1) ?? "—"],
          ["TS%", trueShooting(base.line) != null ? (trueShooting(base.line)! * 100).toFixed(1) : "—"],
          ["PER", base.line.per?.toFixed(1) ?? "—"],
        ]
      : []
    return (
      <Shell kicker={t("sharePage.player")} title={p.fullName} note={note} footer={footer}>
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <div className="relative mx-auto aspect-square w-44 overflow-hidden rounded-2xl bg-court-800 ring-1 ring-hairline lg:w-full">
            <SmartImage src={p.imageUrl} alt={p.fullName} fallback={<PersonAvatar name={p.fullName} leagueSlug={base?.leagueSlug} />} />
          </div>
          <div className="space-y-8">
            {base ? (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                  {[p.position, base.teamName, base.leagueName, base.season].filter(Boolean).join(" · ")}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {tiles.map(([k, v]) => (
                    <div key={k} className="gh-card p-3">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{k}</dt>
                      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-50">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {pctl && base ? <PercentileProfile data={pctl} leagueName={base.leagueName} /> : null}
            <Link href={`/players/${p.slug}`} className="inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">
              {t("sharePage.openFull")} →
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  if (share.kind === "shortlist") {
    const d = await shortlistDetail(share.targetId)
    if (!d) return <Shell kicker={t("sharePage.shortlist")} title="—" footer={footer} />
    return (
      <Shell kicker={t("sharePage.shortlist")} title={d.name} note={note} footer={footer}>
        {d.description ? <p className="-mt-4 mb-8 max-w-2xl text-sm text-ink-400">{d.description}</p> : null}
        <div className="space-y-8">
          {STATUSES.map((s) => {
            const items = d.items.filter((i) => i.status === s)
            if (!items.length) return null
            return (
              <section key={s}>
                <h2 className="gh-eyebrow mb-3">{t(`workspace.statuses.${s}`)}</h2>
                <ul className="divide-y divide-white/[0.06] rounded-2xl border border-hairline">
                  {items.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <Link href={`/players/${i.player.slug}`} className="font-semibold text-ink-50 hover:text-brand-300">
                        {i.player.fullName}
                        <span className="ml-2 text-[12px] font-normal text-ink-500">
                          {[i.player.position, i.line?.team, i.line?.league].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                      {i.line ? (
                        <span className="font-mono text-[12px] tabular-nums text-ink-300">
                          {t("shortlistsPage.perGame", { ppg: i.line.ppg ?? "—", rpg: i.line.rpg ?? "—", apg: i.line.apg ?? "—" })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </Shell>
    )
  }

  const row = (await db.select({ data: playbookPlays.data }).from(playbookPlays).where(eq(playbookPlays.id, share.targetId)).limit(1))[0]
  const play = row ? parsePlay(row.data) : null
  if (!play) return <Shell kicker={t("sharePage.play")} title="—" footer={footer} />
  return (
    <Shell kicker={t("sharePage.play")} title={play.name} note={note} footer={footer}>
      {play.description ? <p className="-mt-4 mb-6 max-w-2xl text-sm text-ink-400">{play.description}</p> : null}
      <SharedPlayViewer
        play={play}
        labels={{ frame: t("sharePage.play"), prev: t("sharePage.prev"), next: t("sharePage.next") }}
      />
    </Shell>
  )
}
