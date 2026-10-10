/**
 * Notification wording, in the recipient's language. Notifications are written
 * once, at the moment they are created, so the text is rendered here on the
 * server from the user's saved locale rather than by the UI dictionary.
 */
import type { Locale } from "@/lib/i18n/config"
import type { AlertEvent } from "@/lib/alerts/diff"

const METRIC: Record<Locale, Record<string, string>> = {
  es: { ppg: "puntos por partido", rpg: "rebotes por partido", apg: "asistencias por partido", per: "PER" },
  en: { ppg: "points per game", rpg: "rebounds per game", apg: "assists per game", per: "PER" },
}

export type RenderedAlert = { kind: string; title: string; body: string }

export function renderAlert(
  event: AlertEvent,
  subject: string,
  locale: Locale,
  names: (ids: string[]) => string,
): RenderedAlert {
  const es = locale === "es"
  switch (event.type) {
    case "team_change":
      return {
        kind: "team_change",
        title: es ? `${subject} cambia de equipo` : `${subject} has changed teams`,
        body: es
          ? `De ${event.fromTeam ?? "sin equipo"} a ${event.toTeam ?? "sin equipo"}.`
          : `From ${event.fromTeam ?? "no team"} to ${event.toTeam ?? "no team"}.`,
      }
    case "threshold": {
      const label = METRIC[locale][event.metric] ?? event.metric
      const value = event.value.toFixed(1)
      return {
        kind: "threshold",
        title: es
          ? `${subject} supera ${event.threshold} ${label}`
          : `${subject} is above ${event.threshold} ${label}`,
        body: es ? `Ahora promedia ${value}.` : `Now averaging ${value}.`,
      }
    }
    case "roster_in":
      return {
        kind: "roster_change",
        title: es ? `Altas en ${subject}` : `New in ${subject}`,
        body: names(event.playerIds),
      }
    case "roster_out":
      return {
        kind: "roster_change",
        title: es ? `Bajas en ${subject}` : `Left ${subject}`,
        body: names(event.playerIds),
      }
    case "coach_change":
      return {
        kind: "coach_change",
        title: es ? `Cambio de entrenador en ${subject}` : `Coaching change at ${subject}`,
        body: es
          ? `${event.to} sustituye a ${event.from}.`
          : `${event.to} replaces ${event.from}.`,
      }
    case "new_season":
      return {
        kind: "new_season",
        title: es ? `${subject}: plantilla ${event.season}` : `${subject}: ${event.season} roster`,
        body: es
          ? "Ya está publicada la plantilla de la nueva temporada."
          : "The new season's roster is out.",
      }
  }
}

export function digestSubject(count: number, locale: Locale): string {
  if (locale === "es") {
    return count === 1 ? "1 novedad de los que sigues" : `${count} novedades de los que sigues`
  }
  return count === 1 ? "1 update from who you follow" : `${count} updates from who you follow`
}
