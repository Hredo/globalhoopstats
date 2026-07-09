"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

function parsePageType(pathname: string): { pageType: string; pageSlug: string | null; leagueSlug: string | null } {
  const parts = pathname.split("/").filter(Boolean)

  if (parts[0] === "players" && parts[1]) {
    return { pageType: "player", pageSlug: parts[1], leagueSlug: null }
  }

  if (parts[0] === "teams" && parts[1] && parts[2]) {
    return { pageType: "team", pageSlug: parts[2], leagueSlug: parts[1] }
  }

  if (parts[0] === "leagues") {
    return { pageType: "league", pageSlug: parts[1] ?? null, leagueSlug: parts[1] ?? null }
  }

  if (parts[0] === "compare") {
    return { pageType: "compare", pageSlug: null, leagueSlug: null }
  }

  if (parts[0] === "market") {
    return { pageType: "market", pageSlug: parts[1] ?? null, leagueSlug: null }
  }

  return { pageType: "other", pageSlug: pathname, leagueSlug: null }
}

export function PageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const { pageType, pageSlug, leagueSlug } = parsePageType(pathname)

    fetch("/api/track/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageType,
        pageSlug,
        leagueSlug,
        referrer: typeof document !== "undefined" ? document.referrer : "",
      }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
