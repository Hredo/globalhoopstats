/**
 * Cloudflare Analytics — reads real traffic figures for globalhoopstats.es so
 * the admin panel can show them without opening the Cloudflare dashboard.
 *
 * Uses the classic zone HTTP-request datasets (httpRequests1dGroups /
 * httpRequests1hGroups) which return exact, unsampled figures — the same
 * numbers Cloudflare's own dashboard shows (requests, bytes, threats, cache,
 * status-code and country breakdowns, unique visitors).
 *
 * Requires two env vars (both optional; absent → { configured: false }):
 *   CLOUDFLARE_API_TOKEN — token with the "Analytics:Read" permission
 *   CLOUDFLARE_ZONE_ID   — zone id of the domain
 */

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql"

export type TrafficRange = "24h" | "7d" | "30d"

export type StatusBucket = { status: number; requests: number }
export type CountryBucket = { country: string; requests: number }
export type TrafficPoint = {
  /** ISO date (daily) or ISO datetime (hourly) label for the bucket. */
  label: string
  requests: number
  cached: number
  threats: number
}

export type TrafficSummary = {
  configured: true
  range: TrafficRange
  totals: {
    requests: number
    pageViews: number
    uniques: number
    bytes: number
    cachedRequests: number
    threats: number
    cacheRatio: number // 0..1
    errorRatio: number // share of 4xx+5xx over total, 0..1
  }
  statusCodes: StatusBucket[]
  countries: CountryBucket[]
  series: TrafficPoint[]
}

export type TrafficResult =
  | TrafficSummary
  | { configured: false; reason: string }

type RangeSpec = {
  dataset: "httpRequests1dGroups" | "httpRequests1hGroups"
  dimensionField: "date" | "datetime"
  filterKey: "date" | "datetime"
  since: string
  until: string
  limit: number
}

function rangeSpec(range: TrafficRange): RangeSpec {
  const now = new Date()
  if (range === "24h") {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    return {
      dataset: "httpRequests1hGroups",
      dimensionField: "datetime",
      filterKey: "datetime",
      since: since.toISOString(),
      until: now.toISOString(),
      limit: 25,
    }
  }
  const days = range === "7d" ? 7 : 30
  // Daily buckets use plain YYYY-MM-DD. date_lt is exclusive, so bound it with
  // tomorrow to include today's partial day.
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return {
    dataset: "httpRequests1dGroups",
    dimensionField: "date",
    filterKey: "date",
    since: iso(since),
    until: iso(until),
    limit: days + 2,
  }
}

type GroupRow = {
  dimensions: { date?: string; datetime?: string }
  sum: {
    requests: number
    bytes: number
    cachedRequests: number
    threats: number
    pageViews: number
    responseStatusMap: { edgeResponseStatus: number; requests: number }[]
    countryMap: { clientCountryName: string; requests: number }[]
  }
  uniq: { uniques: number }
}

function buildQuery(spec: RangeSpec): string {
  const geq = `${spec.filterKey}_geq`
  const lt = `${spec.filterKey}_lt`
  return `
    query ($zone: String!, $since: String!, $until: String!) {
      viewer {
        zones(filter: { zoneTag: $zone }) {
          ${spec.dataset}(
            limit: ${spec.limit}
            filter: { ${geq}: $since, ${lt}: $until }
            orderBy: [${spec.dimensionField}_ASC]
          ) {
            dimensions { ${spec.dimensionField} }
            sum {
              requests
              bytes
              cachedRequests
              threats
              pageViews
              responseStatusMap { edgeResponseStatus requests }
              countryMap { clientCountryName requests }
            }
            uniq { uniques }
          }
        }
      }
    }
  `
}

export async function getCloudflareTraffic(
  range: TrafficRange,
): Promise<TrafficResult> {
  // Defensive sanitisation: hosting panels often store the value with wrapping
  // quotes, a stray "Bearer " prefix, or trailing whitespace/newlines — any of
  // which makes Cloudflare reject the token with a 401. Strip them here.
  const clean = (v: string | undefined): string | undefined =>
    v
      ?.trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^Bearer\s+/i, "")
      .trim()

  const token = clean(process.env.CLOUDFLARE_API_TOKEN)
  const zone = clean(process.env.CLOUDFLARE_ZONE_ID)
  if (!token || !zone) {
    return {
      configured: false,
      reason:
        "Faltan CLOUDFLARE_API_TOKEN y/o CLOUDFLARE_ZONE_ID en las variables de entorno.",
    }
  }

  const spec = rangeSpec(range)
  let res: Response
  try {
    res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: buildQuery(spec),
        variables: { zone, since: spec.since, until: spec.until },
      }),
      // Never cache — admins want live figures.
      cache: "no-store",
    })
  } catch (err) {
    return {
      configured: false,
      reason: `No se pudo contactar con la API de Cloudflare: ${
        err instanceof Error ? err.message : String(err)
      }`,
    }
  }

  // Read the body once as text so we can surface Cloudflare's real error
  // message whether the response is OK or not.
  const rawBody = await res.text()
  let json: {
    data?: { viewer?: { zones?: { [k: string]: GroupRow[] }[] } }
    errors?: { message: string }[] | null
    success?: boolean
  } = {}
  try {
    json = JSON.parse(rawBody)
  } catch {
    /* non-JSON error page */
  }

  if (!res.ok) {
    // 401 = the token itself was rejected (invalid / malformed / wrong value) —
    // NOT a permissions problem. 403 = authenticated but missing the scope.
    const cfMsg =
      json.errors?.map((e) => e.message).join("; ") || rawBody.slice(0, 200)
    const hint =
      res.status === 401
        ? "Token rechazado (401): el valor no es válido. Comprueba que en Hostinger esté SIN comillas ni espacios y que sea el token completo (no el Zone ID)."
        : res.status === 403
          ? "Sin permiso (403): al token le falta 'Zone → Analytics → Read' sobre esta zona."
          : "Revisa el token y el Zone ID."
    return {
      configured: false,
      reason: `Cloudflare respondió ${res.status}. ${hint}${cfMsg ? ` — ${cfMsg}` : ""}`,
    }
  }

  if (json.errors && json.errors.length > 0) {
    return {
      configured: false,
      reason: `Cloudflare GraphQL: ${json.errors.map((e) => e.message).join("; ")}`,
    }
  }

  const zoneNode = json.data?.viewer?.zones?.[0]
  const rows: GroupRow[] = (zoneNode?.[spec.dataset] as GroupRow[]) ?? []

  const statusMap = new Map<number, number>()
  const countryMap = new Map<string, number>()
  const series: TrafficPoint[] = []
  let requests = 0
  let bytes = 0
  let cachedRequests = 0
  let threats = 0
  let pageViews = 0
  let uniques = 0

  for (const row of rows) {
    const s = row.sum
    requests += s.requests
    bytes += s.bytes
    cachedRequests += s.cachedRequests
    threats += s.threats
    pageViews += s.pageViews
    uniques += row.uniq?.uniques ?? 0

    for (const st of s.responseStatusMap ?? []) {
      statusMap.set(
        st.edgeResponseStatus,
        (statusMap.get(st.edgeResponseStatus) ?? 0) + st.requests,
      )
    }
    for (const c of s.countryMap ?? []) {
      countryMap.set(
        c.clientCountryName,
        (countryMap.get(c.clientCountryName) ?? 0) + c.requests,
      )
    }

    series.push({
      label: row.dimensions.date ?? row.dimensions.datetime ?? "",
      requests: s.requests,
      cached: s.cachedRequests,
      threats: s.threats,
    })
  }

  const statusCodes: StatusBucket[] = [...statusMap.entries()]
    .map(([status, r]) => ({ status, requests: r }))
    .sort((a, b) => b.requests - a.requests)

  const countries: CountryBucket[] = [...countryMap.entries()]
    .map(([country, r]) => ({ country, requests: r }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 12)

  const errorRequests = statusCodes
    .filter((s) => s.status >= 400)
    .reduce((acc, s) => acc + s.requests, 0)

  return {
    configured: true,
    range,
    totals: {
      requests,
      pageViews,
      uniques,
      bytes,
      cachedRequests,
      threats,
      cacheRatio: requests > 0 ? cachedRequests / requests : 0,
      errorRatio: requests > 0 ? errorRequests / requests : 0,
    },
    statusCodes,
    countries,
    series,
  }
}
