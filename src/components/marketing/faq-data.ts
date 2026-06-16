import type { Locale } from "@/lib/i18n/config"

export type FaqItem = {
  question: string
  answer: string
}

const FAQ_DATA_EN: FaqItem[] = [
  {
    question: "Where does the data come from?",
    answer:
      "We ingest public box scores and team feeds from the NBA, EuroLeague and Liga ACB. Each league has its own pipeline that runs after tip-off and is normalized into the same per-game scale.",
  },
  {
    question: "Is the data live or delayed?",
    answer:
      "Stats are typically available within minutes of the final buzzer for NBA and EuroLeague games. ACB data lands a few hours after the game ends. The timestamps are visible in the player profile and the season dashboard.",
  },
  {
    question: "Do I need an account to browse?",
    answer:
      "No. The full directory — players, teams, coaches, comparisons and league hubs — is open to everyone.",
  },
  {
    question: "Which leagues are supported?",
    answer: "Today: the NBA, the EuroLeague and the Liga ACB.",
  },
  {
    question: "Can I compare a player from the NBA with one from EuroLeague?",
    answer:
      "Yes. We normalize pace and possessions across leagues so the comparison is fair. Open the Compare page, drop two names, and the radar, the shooting splits and the per-game lines will be apples-to-apples.",
  },
  {
    question: "What are advanced metrics and which ones do you expose?",
    answer:
      "We compute PER, Offensive / Defensive Rating, Net Rating, true shooting and pace at the team and player level when the underlying box score has the inputs (e.g. ACB has no FGA so offensive rating is not computed for ACB players).",
  },
  {
    question: "How much does it cost?",
    answer:
      "Everything is free during the public beta — the database, comparisons, exports and AI features are all open to everyone.",
  },
  {
    question: "Can I export or share a comparison?",
    answer:
      "Yes. The AI advisor and the compare page support export to PDF, Excel and Word.",
  },
  {
    question: "The AI features say Beta — what does that mean?",
    answer:
      "It means they're available to everyone right now, and we're still refining them based on usage. During Beta there are no limits or paywalls.",
  },
]

const FAQ_DATA_ES: FaqItem[] = [
  {
    question: "¿De dónde vienen los datos?",
    answer:
      "Ingerimos box scores públicos y feeds de equipos de la NBA, EuroLeague y Liga ACB. Cada liga tiene su propia tubería que se ejecuta tras el salto inicial y se normaliza a la misma escala por partido.",
  },
  {
    question: "¿Los datos son en vivo o con retraso?",
    answer:
      "Las estadísticas suelen estar disponibles a los pocos minutos de la bocina final en los partidos de NBA y EuroLeague. Los datos de la ACB llegan unas horas después del final. Las marcas de tiempo se ven en el perfil del jugador y en el panel de la temporada.",
  },
  {
    question: "¿Necesito una cuenta para navegar?",
    answer:
      "No. Todo el directorio — jugadores, equipos, entrenadores, comparaciones y hubs de ligas — está abierto para todos.",
  },
  {
    question: "¿Qué ligas están disponibles?",
    answer: "Hoy: la NBA, la EuroLeague y la Liga ACB.",
  },
  {
    question: "¿Puedo comparar a un jugador de la NBA con uno de la EuroLeague?",
    answer:
      "Sí. Normalizamos el ritmo y las posesiones entre ligas para que la comparación sea justa. Abre la página de Comparar, pon dos nombres, y el radar, los splits de tiro y las líneas por partido serán equiparables.",
  },
  {
    question: "¿Qué son las métricas avanzadas y cuáles mostráis?",
    answer:
      "Calculamos PER, Rating Ofensivo / Defensivo, Net Rating, true shooting y ritmo a nivel de equipo y jugador cuando el box score subyacente tiene los datos (p. ej., la ACB no tiene tiros de campo intentados, así que el rating ofensivo no se calcula para jugadores de la ACB).",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Todo es gratis durante la beta pública — la base de datos, las comparaciones, las exportaciones y las funciones de IA están abiertas para todos.",
  },
  {
    question: "¿Puedo exportar o compartir una comparación?",
    answer:
      "Sí. El asesor de IA y la página de comparar permiten exportar a PDF, Excel y Word.",
  },
  {
    question: "Las funciones de IA dicen Beta — ¿qué significa?",
    answer:
      "Significa que están disponibles para todos ahora mismo, y las seguimos mejorando según el uso. Durante la Beta no hay límites ni muros de pago.",
  },
]

export function getFaqData(locale: Locale): FaqItem[] {
  return locale === "es" ? FAQ_DATA_ES : FAQ_DATA_EN
}

/** Default English data kept for back-compat (e.g. structured-data fallbacks). */
export const FAQ_DATA = FAQ_DATA_EN
