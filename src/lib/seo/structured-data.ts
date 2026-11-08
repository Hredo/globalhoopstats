import { SITE } from "@/lib/site"

type JsonLdObject = Record<string, unknown>

/**
 * schema.org BreadcrumbList for a page's location in the site hierarchy.
 * `path` is the absolute path (e.g. "/players/luka-doncic").
 */
export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE.url}${item.path}`,
    })),
  }
}

/** schema.org Person for a player profile (rich results for athletes). */
export function playerJsonLd(p: {
  fullName: string
  slug: string
  position?: string | null
  nationality?: string | null
  birthdate?: string | null
  heightCm?: number | null
  weightKg?: number | null
  photoUrl?: string | null
  teamName?: string | null
  /** Site path of the team page, e.g. "/teams/acb/real-madrid". */
  teamPath?: string | null
  leagueName: string
}): JsonLdObject {
  const data: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.fullName,
    url: `${SITE.url}/players/${p.slug}`,
    jobTitle: p.position
      ? `Basketball Player (${p.position})`
      : "Basketball Player",
  }
  if (p.nationality) data.nationality = p.nationality
  if (p.birthdate) data.birthDate = p.birthdate
  if (p.photoUrl) data.image = p.photoUrl
  if (p.heightCm) {
    data.height = {
      "@type": "QuantitativeValue",
      value: p.heightCm,
      unitCode: "CMT",
    }
  }
  if (p.weightKg) {
    data.weight = {
      "@type": "QuantitativeValue",
      value: p.weightKg,
      unitCode: "KGM",
    }
  }
  if (p.teamName) {
    data.memberOf = {
      "@type": "SportsTeam",
      name: p.teamName,
      sport: "Basketball",
      ...(p.teamPath ? { url: `${SITE.url}${p.teamPath}` } : {}),
      memberOf: {
        "@type": "SportsOrganization",
        name: p.leagueName,
        sport: "Basketball",
      },
    }
  }
  return data
}

/** schema.org SportsOrganization for a league page. */
export function leagueJsonLd(l: {
  name: string
  slug: string
  alternateName?: string | null
  logoUrl?: string | null
}): JsonLdObject {
  const data: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: l.name,
    sport: "Basketball",
    url: `${SITE.url}/leagues/${l.slug}`,
  }
  if (l.alternateName) data.alternateName = l.alternateName
  if (l.logoUrl) data.logo = l.logoUrl
  return data
}

/**
 * schema.org ProfilePage around a player's Person. `dateModified` is the
 * league's last successful sync — the date an answer engine quotes as
 * "as of", and the freshness signal Google reads for profile pages.
 */
export function profilePageJsonLd(
  person: JsonLdObject,
  dateModified: Date | null,
): JsonLdObject {
  const mainEntity = { ...person }
  delete mainEntity["@context"]
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: mainEntity.url,
    ...(dateModified ? { dateModified: dateModified.toISOString() } : {}),
    mainEntity,
  }
}

/**
 * schema.org Dataset for a league-season: what Google Dataset Search and the
 * answer engines index as "a table of numbers someone can cite". The creator is
 * this site (the normalised compilation); `isBasedOn` credits the publisher the
 * raw numbers come from.
 */
export function datasetJsonLd(d: {
  leagueName: string
  leagueSlug: string
  season: string
  description: string
  teams: number
  players: number
  dateModified: Date | null
  upstream: { name: string; url: string } | null
  locale: string
}): JsonLdObject {
  const data: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${d.leagueName} ${d.season} — player and team statistics`,
    description: d.description,
    url: `${SITE.url}/leagues/${d.leagueSlug}`,
    inLanguage: d.locale,
    isAccessibleForFree: true,
    keywords: [
      d.leagueName,
      `${d.leagueName} ${d.season}`,
      "basketball statistics",
      "estadísticas baloncesto",
    ],
    temporalCoverage: d.season,
    variableMeasured: [
      "games played",
      "minutes per game",
      "points per game",
      "rebounds per game",
      "assists per game",
      "field goal percentage",
      "three-point percentage",
      "free throw percentage",
      "true shooting percentage",
      "player efficiency rating (PER)",
    ],
    size: `${d.teams} teams, ${d.players} players`,
    creator: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    usageInfo: `${SITE.url}/terms`,
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${SITE.url}/api/v1/players?league=${d.leagueSlug}`,
        description: "Public read API (API key required). Spec: /openapi.json",
      },
    ],
  }
  if (d.dateModified) data.dateModified = d.dateModified.toISOString()
  if (d.upstream) {
    data.isBasedOn = {
      "@type": "CreativeWork",
      name: d.upstream.name,
      url: d.upstream.url,
    }
  }
  return data
}

/** schema.org SportsTeam for a team page. */
export function teamJsonLd(t: {
  name: string
  slug: string
  leagueSlug: string
  leagueName: string
  logoUrl?: string | null
  city?: string | null
  /** The roster, so an agent can resolve "who plays for X" from the page. */
  athletes?: Array<{ name: string; slug: string }>
  coach?: string | null
}): JsonLdObject {
  const data: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: t.name,
    sport: "Basketball",
    url: `${SITE.url}/teams/${t.leagueSlug}/${t.slug}`,
    memberOf: {
      "@type": "SportsOrganization",
      name: t.leagueName,
      sport: "Basketball",
    },
  }
  if (t.logoUrl) data.logo = t.logoUrl
  if (t.city) data.location = { "@type": "Place", name: t.city }
  if (t.athletes?.length) {
    data.athlete = t.athletes.map((a) => ({
      "@type": "Person",
      name: a.name,
      url: `${SITE.url}/players/${a.slug}`,
    }))
  }
  if (t.coach) data.coach = { "@type": "Person", name: t.coach }
  return data
}
