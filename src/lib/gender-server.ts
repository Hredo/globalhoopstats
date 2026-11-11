/**
 * Server-side gender resolution: an explicit `?gender=` wins, then the
 * `ghs_gender` cookie the switch writes, then men's. Importing `next/headers`
 * keeps this module server-only.
 */
import { cookies } from "next/headers"
import {
  DEFAULT_GENDER,
  GENDER_COOKIE,
  isGender,
  type Gender,
} from "@/lib/gender"
import { scopeLeague } from "@/lib/league-groups"

function first(
  value: string | string[] | null | undefined,
): string | undefined {
  return (Array.isArray(value) ? value[0] : value) ?? undefined
}

/** For pages: pass the `gender` search param. */
export async function resolveGender(
  param?: string | string[] | null,
): Promise<Gender> {
  const explicit = first(param)
  if (isGender(explicit)) return explicit
  try {
    const stored = (await cookies()).get(GENDER_COOKIE)?.value
    return isGender(stored) ? stored : DEFAULT_GENDER
  } catch {
    return DEFAULT_GENDER
  }
}

/**
 * League filter a search endpoint should run with: the league it was asked
 * for, else every league of the side the visitor is on. Never "all leagues".
 */
export function requestLeagueScope(
  request: Request,
  league: string | null | undefined,
): string {
  return scopeLeague(league, requestGender(request))
}

/** For route handlers: reads `?gender=` and falls back to the cookie header. */
export function requestGender(request: Request): Gender {
  const explicit = new URL(request.url).searchParams.get("gender")
  if (isGender(explicit)) return explicit
  const header = request.headers.get("cookie") ?? ""
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq < 0) continue
    if (part.slice(0, eq).trim() !== GENDER_COOKIE) continue
    const value = part.slice(eq + 1).trim()
    return isGender(value) ? value : DEFAULT_GENDER
  }
  return DEFAULT_GENDER
}
