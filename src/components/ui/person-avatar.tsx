import { leagueAccent } from "@/components/ui/league-badge"
import { getInitials } from "@/lib/format"

type Props = {
  /** Full name; initials are derived from it. */
  name: string
  /** Drives the accent color; omit for the neutral brand accent. */
  leagueSlug?: string
  /** Optional jersey number rendered below initials. */
  jerseyNumber?: string | null
  className?: string
}

/**
 * Typographic stand-in for people photos: a circular disk with the person's
 * initials set in Fraunces over a league-tinted plate, with a free-throw arc
 * as the only ornament. This is the deliberate design for players/coaches —
 * the photo ingestion pipeline is paused (grep "PHOTOS PAUSED"), so
 * `imageUrl`/`photoUrl` are null everywhere and SmartImage renders this as
 * its fallback.
 *
 * Pure SVG: no network request, works in server components, and scales to any
 * container via viewBox; `slice` mimics object-cover in non-square frames.
 */
export function PersonAvatar({
  name,
  leagueSlug = "",
  jerseyNumber,
  className = "",
}: Props) {
  const accent = leagueAccent(leagueSlug)
  const hasNumber = !!jerseyNumber

  return (
    <svg
      viewBox="0 0 96 96"
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label={name}
    >
      {/* Circular disk background */}
      <circle cx="48" cy="48" r="48" fill="var(--color-court-900)" />
      <circle cx="48" cy="48" r="48" fill={accent.color} opacity="0.1" />

      {/* Outer ring — gives the "plate" feel */}
      <circle
        cx="48"
        cy="48"
        r="45"
        fill="none"
        stroke={accent.color}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />

      {/* Free-throw arc ornament */}
      <path
        d="M14 96a34 34 0 0 1 68 0"
        fill="none"
        stroke={accent.color}
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />

      {/* Initials in Fraunces */}
      <text
        x="48"
        y={hasNumber ? 38 : 46}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="32"
        fontWeight="700"
        style={{ fontFamily: "var(--font-display)" }}
        fill={accent.text}
      >
        {getInitials(name)}
      </text>

      {/* Optional jersey number */}
      {hasNumber && (
        <text
          x="48"
          y={64}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="14"
          fontWeight="500"
          fontFamily="var(--font-mono), monospace"
          fill={accent.text}
          opacity="0.65"
        >
          #{jerseyNumber}
        </text>
      )}
    </svg>
  )
}
