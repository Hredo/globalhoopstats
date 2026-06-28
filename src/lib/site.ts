export const SITE = {
  name: "globalhoopstats",
  shortName: "GHS",
  // Canonical production URL. Reads NEXT_PUBLIC_SITE_URL (set to the live domain
  // on Hostinger) and falls back to the real domain — NOT the .com — so the
  // canonical tag, sitemap, robots, OpenGraph and JSON-LD all point to .es.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://globalhoopstats.es").replace(
    /\/+$/,
    "",
  ),
  // Always points to the production domain for legal documents, regardless of
  // the local dev environment. The official business address is the .es domain.
  urlOfficial: "https://globalhoopstats.es",
  description:
    "Global basketball intelligence across the NBA, EuroLeague, Liga ACB and Spain's FEB leagues (LEB Oro, LEB Plata, EBA): box scores, advanced splits, side-by-side comparisons, player market valuations, a trade simulator and an AI scouting advisor — all in one console.",
  tagline: "Hoops, decoded.",
  taglineShort: "Global basketball intelligence",
  locale: "en",
  twitter: "",
  contact: "globalhoopstats@gmail.com",
  author: "Hugo Redondo Valdés",
}

export const SEO_KEYWORDS = [
  "basketball statistics",
  "NBA stats",
  "EuroLeague stats",
  "Liga ACB stats",
  "basketball scouting",
  "player comparison",
  "advanced metrics basketball",
  "PER basketball",
  "offensive rating",
  "net rating",
  "win shares",
  "basketball analytics",
  "scouting reports",
  "player profiles",
  "shot charts",
  "basketball market value",
  "player market valuation",
  "basketball trade simulator",
  "basketball trade machine",
  "AI basketball scouting",
  "globalhoopstats",
  // Spanish-language terms — the canonical domain is .es and we cover the
  // Spanish basketball pyramid (ACB, LEB, EBA), so target ES queries too.
  "estadísticas baloncesto",
  "estadísticas NBA",
  "estadísticas EuroLeague",
  "estadísticas Liga ACB",
  "estadísticas LEB Oro",
  "estadísticas LEB Plata",
  "estadísticas EBA",
  "baloncesto español",
  "comparar jugadores baloncesto",
  "valoración de mercado jugadores",
  "simulador de traspasos",
  "métricas avanzadas baloncesto",
  "scouting baloncesto",
  "perfiles de jugadores",
  "global hoop stats",
]

/**
 * Brand/profile URLs for the same organization across the web. Wired into the
 * Organization JSON-LD `sameAs` so Google can connect this site to the brand's
 * social presence (a real ranking/knowledge-panel signal). Fill in as accounts
 * are created; empty strings are filtered out before rendering.
 */
export const SITE_SOCIAL: string[] = [
  // "https://twitter.com/globalhoopstats",
  // "https://www.instagram.com/globalhoopstats",
  // "https://github.com/globalhoopstats",
].filter(Boolean)
