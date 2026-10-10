/**
 * Line icons for the navigation, drawn for this site on a 24px grid with a
 * 1.6 stroke. Basketball-flavoured where it helps (a court key for teams, a
 * clipboard play for the playbook) and plain where it does not.
 */
import type { SVGProps } from "react"

export type NavIconName =
  | "players"
  | "teams"
  | "coaches"
  | "leagues"
  | "compare"
  | "projection"
  | "advisor"
  | "methodology"
  | "shortlists"
  | "following"
  | "trade"
  | "playbook"
  | "search"
  | "bell"
  | "menu"
  | "display"
  | "chevron"
  | "close"

const PATHS: Record<NavIconName, string> = {
  players: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 8a6.5 6.5 0 0 1 13 0",
  teams: "M4 5h16v14H4zM4 12h16M12 5v14M9 12a3 3 0 0 0 6 0",
  coaches: "M8 3h8v4H8zM6 7h12v13H6zM9 12h6M9 16h4",
  leagues: "M6 4h12v3a6 6 0 0 1-12 0zM12 13v4M8 20h8M6 6H3.5a2.5 2.5 0 0 0 3 3.5M18 6h2.5a2.5 2.5 0 0 1-3 3.5",
  compare: "M7 4v16M17 4v16M3 9l4-4 4 4M13 15l4 4 4-4",
  projection: "M4 19h16M5 16l4.5-5 3.5 3 6-7M15 7h4v4",
  advisor: "M5 5h14v10H9l-4 4zM9 9.5h.01M12 9.5h.01M15 9.5h.01",
  methodology: "M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5",
  shortlists: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  following: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z",
  trade: "M4 8h13l-3-3M20 16H7l3 3",
  playbook: "M6 3h12v18H6zM9 8l2 2M11 8l-2 2M15 14a1.5 1.5 0 1 0 0-.01M10 10c1 3 3 4 5 4",
  search: "m21 21-4.3-4.3M16.6 10.6a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
  menu: "M4 8h16M4 16h16",
  display: "M4 19 9 5l5 14M5.8 14h6.4M15 19l3-8 3 8M15.9 16.5h4.2",
  chevron: "m6 9 6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
}

export function NavIcon({ name, ...props }: { name: NavIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
