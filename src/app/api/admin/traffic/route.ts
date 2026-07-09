import { NextResponse } from "next/server"
import { getCurrentUser, isAdmin } from "@/lib/auth/current-user"
import { getCloudflareTraffic, type TrafficRange } from "@/lib/cloudflare/analytics"

const RANGES: TrafficRange[] = ["24h", "7d", "30d"]

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers.get("cookie"))
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(request.url)
  const raw = url.searchParams.get("range")
  const range: TrafficRange = RANGES.includes(raw as TrafficRange)
    ? (raw as TrafficRange)
    : "7d"

  const data = await getCloudflareTraffic(range)
  return NextResponse.json(data)
}
