/**
 * The site's information architecture, in one place. The desktop panels, the
 * mobile sheet and the footer all read this, so a new page is added once and
 * appears everywhere with the same name, order and grouping.
 */
import type { NavIconName } from "@/components/layout/nav-icons"

export type NavItem = {
  href: string
  /** Key under nav.items — label and one-line description. */
  key: string
  icon: NavIconName
  badge?: "pro" | "beta" | "new"
}

export type NavGroup = {
  id: "explore" | "analyze" | "workspace"
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "explore",
    items: [
      { href: "/players", key: "players", icon: "players" },
      { href: "/teams", key: "teams", icon: "teams" },
      { href: "/coaches", key: "coaches", icon: "coaches" },
      { href: "/leagues", key: "leagues", icon: "leagues" },
    ],
  },
  {
    id: "analyze",
    items: [
      { href: "/compare", key: "compare", icon: "compare" },
      { href: "/projection", key: "projection", icon: "projection", badge: "new" },
      { href: "/ai-advisor", key: "aiAdvisor", icon: "advisor", badge: "pro" },
      { href: "/methodology", key: "methodology", icon: "methodology" },
    ],
  },
  {
    id: "workspace",
    items: [
      { href: "/shortlists", key: "shortlists", icon: "shortlists", badge: "new" },
      { href: "/following", key: "following", icon: "following", badge: "new" },
      { href: "/market/trade", key: "trade", icon: "trade" },
      { href: "/playbook", key: "playbook", icon: "playbook", badge: "beta" },
    ],
  },
]

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function activeGroup(pathname: string): NavGroup["id"] | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some((i) => isActivePath(pathname, i.href))) return g.id
  }
  return null
}
