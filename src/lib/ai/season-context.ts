import type { Locale } from "@/lib/i18n/config"
import { THIN_SEASON_GAMES } from "@/lib/seasons"

/**
 * How the AI surfaces talk about the season.
 *
 * The rule the product wants is simple to say and easy to get wrong: **always
 * speak about the most recent season, and reach back to earlier ones only when
 * the current one is too thin to support a judgement.** A new campaign opens
 * with confirmed squads and zero games played, so for weeks every "analyse this
 * player" request has a current season worth 0–4 games. Without an explicit
 * instruction a model does one of two bad things with that: it invents a
 * verdict from three games, or it quietly answers about last season as if it
 * were this one.
 *
 * So the prompt gets both halves stated: which season is being discussed, and —
 * when it is thin — which earlier season the evidence is coming from and that
 * the answer must say so out loud.
 */

/** A season line reduced to what the "is this enough to judge on?" test needs. */
export type SeasonEvidence = {
  seasonName: string
  gamesPlayed: number
}

export type SeasonFraming = {
  /** Season the answer is about. */
  current: string
  /** True when `current` has too few games to stand on its own. */
  thin: boolean
  /** Earlier season the answer may lean on, when one exists. */
  fallback: string | null
}

/**
 * Decide how to frame a player's season for the model.
 *
 * `history` is every season line the player has, newest first. The fallback is
 * the richest EARLIER season — richest, not merely previous, because a player
 * who barely featured last year is better described by the season before it.
 */
export function frameSeason(
  current: SeasonEvidence | null,
  history: SeasonEvidence[],
): SeasonFraming | null {
  if (!current) {
    const best = [...history].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0]
    return best
      ? { current: best.seasonName, thin: false, fallback: null }
      : null
  }
  const thin = (current.gamesPlayed ?? 0) < THIN_SEASON_GAMES
  if (!thin) return { current: current.seasonName, thin: false, fallback: null }
  const fallback = history
    .filter((h) => h.seasonName !== current.seasonName && h.gamesPlayed > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0]
  return {
    current: current.seasonName,
    thin: true,
    fallback: fallback?.seasonName ?? null,
  }
}

const COPY: Record<
  Locale,
  {
    about: (season: string) => string
    noGames: (season: string) => string
    thin: (season: string, games: number) => string
    lean: (season: string) => string
    leanNone: string
    label: string
  }
> = {
  en: {
    label: "SEASON —",
    about: (season) => `The question is about the ${season} season.`,
    noGames: (season) =>
      `${season} has not started for this player: the squad is confirmed but no games have been played.`,
    thin: (season, games) =>
      `${season} is ${games} game${games === 1 ? "" : "s"} old — far too little to judge anyone on.`,
    lean: (season) =>
      `Base the judgement on ${season} instead, and say explicitly that you are doing so because this season has barely started.`,
    leanNone:
      "There is no earlier season on record either, so say plainly that there is not enough data yet rather than guessing.",
  },
  es: {
    label: "TEMPORADA —",
    about: (season) => `La pregunta es sobre la temporada ${season}.`,
    noGames: (season) =>
      `La ${season} aún no ha empezado para este jugador: la plantilla está confirmada pero no ha disputado ningún partido.`,
    thin: (season, games) =>
      `La ${season} lleva ${games} partido${games === 1 ? "" : "s"}: muy poco para juzgar a nadie.`,
    lean: (season) =>
      `Apóyate en la ${season} y di de forma explícita que lo haces porque esta temporada acaba de empezar.`,
    leanNone:
      "Tampoco hay temporadas anteriores registradas, así que di claramente que todavía no hay datos suficientes en lugar de inventar.",
  },
}

/**
 * The season block appended to a data prompt.
 *
 * Deliberately not a markdown heading: a model shown a document of "## " titles
 * writes one back (see the note in `player-report.ts`), so this matches the
 * plain "LABEL —" shape the rest of the data block uses.
 */
export function seasonPromptBlock(
  framing: SeasonFraming | null,
  games: number | null,
  locale: Locale,
): string {
  if (!framing) return ""
  const copy = COPY[locale] ?? COPY.en
  const lines = [copy.label, copy.about(framing.current)]
  if (framing.thin) {
    lines.push(
      games === 0 ? copy.noGames(framing.current) : copy.thin(framing.current, games ?? 0),
    )
    lines.push(framing.fallback ? copy.lean(framing.fallback) : copy.leanNone)
  }
  return lines.join("\n")
}
