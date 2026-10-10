/**
 * Small helpers shared by the scouting-workspace API routes (follows,
 * notifications, shortlists, shares). Every one of them is per-user, so each
 * starts with the same three steps: rate limit, session, body.
 */
import { NextResponse } from "next/server"
import { getCurrentUser, type SessionUser } from "@/lib/auth/current-user"
import { clientIp, jsonTooManyRequests, readRateLimit } from "@/lib/security/ai-advisor"

export type Authed = { user: SessionUser } | { response: NextResponse }

export async function authed(
  request: Request,
  bucket: string,
  capacity = 60,
  refillPerSec = 1,
): Promise<Authed> {
  const limit = readRateLimit(clientIp(request), bucket, capacity, refillPerSec)
  if (!limit.ok) return { response: jsonTooManyRequests(limit.retryAfterSec) }
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) {
    return {
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    }
  }
  return { user }
}

export async function readJson<T = Record<string, unknown>>(
  request: Request,
): Promise<T | null> {
  try {
    const body = (await request.json()) as unknown
    return body && typeof body === "object" ? (body as T) : null
  } catch {
    return null
  }
}

export const badRequest = (error: string) =>
  NextResponse.json({ error }, { status: 400 })
export const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 })
export const forbidden = () => NextResponse.json({ error: "Forbidden." }, { status: 403 })

/** Trimmed string within a length budget, or null. */
export function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const v = value.trim()
  return v.length > 0 && v.length <= max ? v : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v)

const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/
export const isSlug = (v: unknown): v is string => typeof v === "string" && SLUG.test(v)
