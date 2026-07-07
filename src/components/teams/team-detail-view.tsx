import { FadeIn } from "@/components/animations/fade-in"
import { TeamHero } from "@/components/teams/team-hero"
import { TeamRosterGrid } from "@/components/teams/team-roster-grid"
import { TeamStaffList } from "@/components/teams/team-staff-list"
import { TeamThemeScope } from "@/components/teams/team-theme-scope"
import { buildTeamPalette, LEAGUE_BASE_COLORS } from "@/lib/theme/team-color"
import { getT } from "@/lib/i18n/server"

type Props = {
  team: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    city: string | null
    league: { name: string; slug: string; region: string }
    availableLeagues: { name: string; slug: string; region: string }[]
    roster: Array<{
      id: string
      fullName: string
      slug: string
      nationality: string | null
      position: string | null
      heightCm: number | null
      weightKg: number | null
      imageUrl: string | null
      league: { name: string; slug: string }
      team: { name: string; logoUrl: string | null } | null
      stats: {
        seasonName: string
        gamesPlayed: number
        pointsTotal: number | null
        reboundsTotal: number | null
        assistsTotal: number | null
        stealsTotal: number | null
        blocksTotal: number | null
        fgPct: number | null
        threePct: number | null
        ftPct: number | null
        per: number | null
      } | null
    }>
    staff: Array<{
      id: string
      fullName: string
      slug: string
      role: "head_coach" | "assistant_coach" | "staff"
      nationality: string | null
      age: number | null
      photoUrl: string | null
      league: { id: string; name: string; slug: string; region: string }
      team: { id: string; name: string; slug: string; logoUrl: string | null }
    }>
  }
}

export async function TeamDetailView({ team }: Props) {
  const baseHex = LEAGUE_BASE_COLORS[team.league.slug] ?? "#CC6B2C"
  const palette = buildTeamPalette(baseHex, team.league.slug)
  const { t } = await getT()

  return (
    <TeamThemeScope palette={palette}>
      <div className="team-detail-page relative py-8">
        <FadeIn>
          <TeamHero
            name={team.name}
            slug={team.slug}
            logoUrl={team.logoUrl}
            league={team.league}
            availableLeagues={team.availableLeagues}
            city={team.city}
            switchLabel={t("teamProfile.switchLeague")}
          />
        </FadeIn>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <FadeIn delay={0.05}>
            <section>
              <header className="mb-4 flex items-end justify-between">
                <h2 className="font-display text-xl font-bold text-ink-50">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(120deg, var(--team-500), var(--team-700))",
                    }}
                  >
                    {t("teamProfile.roster")}
                  </span>{" "}
                  <span className="text-ink-300">· {team.roster.length}</span>
                </h2>
                <span className="text-xs uppercase tracking-widest text-ink-400">
                  {t("teamProfile.currentSeason")}
                </span>
              </header>
              <TeamRosterGrid players={team.roster} />
            </section>
          </FadeIn>

          <div className="space-y-6">
            <FadeIn delay={0.1}>
              <TeamStaffList staff={team.staff} />
            </FadeIn>
          </div>
        </div>
      </div>
    </TeamThemeScope>
  )
}
