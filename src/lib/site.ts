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
]
