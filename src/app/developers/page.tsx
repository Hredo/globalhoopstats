import Link from "next/link"
import type { Metadata } from "next"
import { DirectoryHero } from "@/components/ui/directory-hero"
import { getT } from "@/lib/i18n/server"
import { pageSeo } from "@/lib/seo/metadata"
import { SITE } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT()
  return pageSeo({ locale, path: "/developers", title: t("developers.title"), description: t("developers.lede") })
}

const ENDPOINTS: Array<{ path: string; es: string; en: string }> = [
  { path: "GET /api/v1/leagues", es: "Ligas con clubes y jugadores de la temporada actual.", en: "Leagues with current-season club and player counts." },
  { path: "GET /api/v1/teams?league=acb&season=2026-27", es: "Clubes de una liga y temporada.", en: "The clubs of a league-season." },
  { path: "GET /api/v1/players?league=acb&season=2026-27&page=1&limit=50", es: "Jugadores de una liga y temporada, paginados (máx. 100), por puntos.", en: "Players of a league-season, paginated (max 100), by points." },
  { path: "GET /api/v1/players/{slug}", es: "Una ficha con todas sus temporadas.", en: "One player with every season line." },
]

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-hairline bg-court-950/60 p-4 font-mono text-[12.5px] leading-relaxed text-ink-200">
      <code>{children}</code>
    </pre>
  )
}

export default async function DevelopersPage() {
  const { t, locale } = await getT()
  const sample = `curl -H "Authorization: Bearer ghs_…" \\
  "${SITE.url}/api/v1/players?league=leb-oro&limit=2"`
  const response = `{
  "data": [
    {
      "slug": "…",
      "name": "…",
      "team": "…",
      "gamesPlayed": 24,
      "minutesPerGame": 27.4,
      "perGame": { "pts": 16.2, "reb": 4.1, "ast": 3.8, "stl": 1.2, "blk": 0.2 },
      "per40": { "pts": 23.6, "reb": 6.0, "ast": 5.5 },
      "trueShooting": 0.581,
      "per": 17.9
    }
  ],
  "meta": { "league": "leb-oro", "season": "2026-27", "page": 1, "limit": 2, "total": 212,
            "source": "globalhoopstats.es", "attribution": "…" }
}`
  return (
    <div className="pb-16">
      <DirectoryHero eyebrow={t("developers.eyebrow")} title={t("developers.title")} description={t("developers.lede")} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          <section>
            <h2 className="gh-eyebrow mb-3">{t("developers.auth")}</h2>
            <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-300">{t("developers.authBody")}</p>
            <Code>{sample}</Code>
          </section>
          <section>
            <h2 className="gh-eyebrow mb-3">{t("developers.endpoints")}</h2>
            <ul className="divide-y divide-white/[0.06] rounded-2xl border border-hairline">
              {ENDPOINTS.map((e) => (
                <li key={e.path} className="px-4 py-3">
                  <code className="break-all font-mono text-[12.5px] text-brand-200">{e.path}</code>
                  <p className="mt-1 text-[13px] text-ink-400">{locale === "es" ? e.es : e.en}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Code>{response}</Code>
            </div>
          </section>
          <section className="grid gap-6 sm:grid-cols-3">
            {(["quota", "attribution", "errors"] as const).map((k) => (
              <div key={k}>
                <h2 className="gh-eyebrow mb-2">{t(`developers.${k}`)}</h2>
                <p className="text-[13px] leading-relaxed text-ink-300">{t(`developers.${k}Body`)}</p>
              </div>
            ))}
          </section>
        </div>
        <aside className="gh-card h-fit p-5">
          <p className="text-sm leading-relaxed text-ink-300">{t("developers.lede")}</p>
          <Link
            href="/contact"
            className="mt-4 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-brand-400"
          >
            {t("developers.request")}
          </Link>
        </aside>
      </div>
    </div>
  )
}
