import type { Locale } from "@/lib/i18n/config"

export type FaqItem = {
  question: string
  answer: string
}

const FAQ_DATA_EN: FaqItem[] = [
  {
    question: "Where does the data come from and how fresh is it?",
    answer:
      "We ingest public box scores and team feeds directly from the NBA, EuroLeague, Liga ACB and Spain's FEB ladder (LEB Oro, LEB Plata, EBA). NBA and EuroLeague stats land within minutes of the final buzzer; ACB and FEB data follows within a few hours. Every player profile shows a timestamp so you know exactly how fresh the numbers are.",
  },
  {
    question: "Do I need an account to use the platform?",
    answer:
      "No. The entire database — players, teams, coaches, league hubs, comparisons and AI queries — is open to everyone. No sign-up, no paywall, no limits.",
  },
  {
    question: "Which leagues are currently covered?",
    answer:
      "The NBA, EuroLeague, Liga ACB, LEB Oro, LEB Plata and EBA (Spain's full FEB ladder). That's six leagues under one roof with normalized stats across all of them.",
  },
  {
    question: "How do you make cross-league comparisons fair?",
    answer:
      "We normalize pace and possessions so a player in the EuroLeague and a player in the NBA are measured on the same scale. The Compare tool uses per-possession rates, not raw totals, and flags the leader on every stat line.",
  },
  {
    question: "What advanced metrics do you compute?",
    answer:
      "PER, Offensive / Defensive Rating, Net Rating, True Shooting %, usage rate and pace — at both the player and team level. Metrics that require granular box-score inputs (e.g. FGA for ORtg) are only shown when the source league provides that data.",
  },
  {
    question: "Can I install GlobalHoopStats on my phone?",
    answer:
      "Yes. The platform is a progressive web app — open globalhoopstats.es in Safari (iOS) or Chrome (Android), tap the share/install icon, and it will live on your home screen with its own window, just like a native app. No app store required.",
  },
  {
    question: "Can I export or share what I find?",
    answer:
      "Yes. The AI Advisor and the Compare page both support export to PDF, Excel and Word with the formatting ready to present. Player profiles can also be exported individually.",
  },
  {
    question: "How does the AI Advisor work?",
    answer:
      "The AI Advisor reads the same normalized database you see and answers scouting questions in plain language. Ask 'Who's the better pick-and-roll guard?' or 'Compare their defensive ratings' and it returns a sourced read with the numbers behind the answer.",
  },
  {
    question: "Is everything really free?",
    answer:
      "Yes. All features — database, comparisons, AI queries, exports — are completely free during the public beta. There are no usage caps, no hidden limits, and no credit card required. A forever-free tier will remain available after Beta — paid plans will only add advanced features, never remove existing ones.",
  },
]

const FAQ_DATA_ES: FaqItem[] = [
  {
    question: "¿De dónde vienen los datos y qué tan actualizados están?",
    answer:
      "Ingerimos box scores públicos y feeds de la NBA, EuroLeague, Liga ACB y el escalafón FEB de España (LEB Oro, LEB Plata, EBA). Las estadísticas de NBA y EuroLeague llegan a los pocos minutos de la bocina final; los datos de ACB y FEB, en cuestión de horas. Cada perfil de jugador muestra una marca de tiempo para que sepas exactamente qué tan frescos están los números.",
  },
  {
    question: "¿Necesito una cuenta para usar la plataforma?",
    answer:
      "No. Toda la base de datos — jugadores, equipos, entrenadores, hubs de ligas, comparaciones y consultas de IA — está abierta para todos. Sin registro, sin muros de pago, sin límites.",
  },
  {
    question: "¿Qué ligas están disponibles actualmente?",
    answer:
      "La NBA, la EuroLeague, la Liga ACB, LEB Oro, LEB Plata y EBA (los seis escalones del baloncesto profesional español). Seis ligas bajo un mismo techo con estadísticas normalizadas entre todas ellas.",
  },
  {
    question: "¿Cómo hacéis justas las comparaciones entre ligas?",
    answer:
      "Normalizamos el ritmo y las posesiones para que un jugador de la EuroLeague y uno de la NBA se midan en la misma escala. La herramienta de Comparar usa ratios por posesión, no totales brutos, y marca al líder en cada línea estadística.",
  },
  {
    question: "¿Qué métricas avanzadas calculáis?",
    answer:
      "PER, Rating Ofensivo / Defensivo, Net Rating, True Shooting %, tasa de uso y ritmo — tanto a nivel de jugador como de equipo. Las métricas que requieren datos granulados del box score (p. ej., FGA para ORtg) solo se muestran cuando la liga de origen proporciona esos datos.",
  },
  {
    question: "¿Puedo instalar GlobalHoopStats en mi móvil?",
    answer:
      "Sí. La plataforma es una aplicación web progresiva — abre globalhoopstats.es en Safari (iOS) o Chrome (Android), pulsa el icono de compartir/instalar y se quedará en tu pantalla de inicio con su propia ventana, como una app nativa. Sin pasar por la tienda de aplicaciones.",
  },
  {
    question: "¿Puedo exportar o compartir lo que encuentro?",
    answer:
      "Sí. El Asesor de IA y la página de Comparar permiten exportar a PDF, Excel y Word con el formato listo para presentar. Los perfiles de jugador también se pueden exportar individualmente.",
  },
  {
    question: "¿Cómo funciona el Asesor de IA?",
    answer:
      "El Asesor de IA lee la misma base de datos normalizada que tú ves y responde preguntas de scouting en lenguaje natural. Pregunta '¿Quién es mejor en el pick-and-roll?' o 'Compara sus rating defensivos' y recibirás una respuesta fundamentada con los números detrás.",
  },
  {
    question: "¿Todo es realmente gratis?",
    answer:
      "Sí. Todas las funciones — base de datos, comparaciones, consultas de IA, exportaciones — son completamente gratuitas durante la beta pública. Sin límites de uso, sin restricciones ocultas, sin necesidad de tarjeta de crédito. Tras la beta seguirá existiendo un nivel gratuito permanente — los planes de pago solo añadirán funciones avanzadas, nunca eliminarán las existentes.",
  },
]

export function getFaqData(locale: Locale): FaqItem[] {
  return locale === "es" ? FAQ_DATA_ES : FAQ_DATA_EN
}

/** Default English data kept for back-compat (e.g. structured-data fallbacks). */
export const FAQ_DATA = FAQ_DATA_EN
