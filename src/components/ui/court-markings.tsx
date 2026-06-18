import type { CSSProperties } from "react"

type Variant = "hero" | "band" | "floor"

type Props = {
  /**
   * `hero` — concentric arcs anchored to a corner, for big expressive headers.
   * `band` — a half-court drawn side-on, for directory / section header bands.
   */
  variant?: Variant
  className?: string
  /**
   * Chalk line colour. Defaults to a soft court-white. Pass a league/team hue
   * (e.g. `oklch(0.7 0.19 50 / 0.16)`) to tint a page to its subject.
   */
  tone?: string
  style?: CSSProperties
}

const DEFAULT_CHALK = "oklch(0.96 0.01 80 / 0.1)"

/**
 * Decorative basketball court geometry, drawn as precise chalk linework.
 * The single recurring motif that ties every page's background together —
 * dialled up (hero) or down (band) per archetype. Pure SVG, zero client JS,
 * `aria-hidden`, and tintable via the `tone` prop / `--chalk` custom property.
 */
export function CourtMarkings({
  variant = "band",
  className,
  tone,
  style,
}: Props) {
  const vars = { "--chalk": tone ?? DEFAULT_CHALK } as CSSProperties

  if (variant === "hero") {
    return (
      <svg
        aria-hidden
        focusable="false"
        viewBox="0 0 560 560"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        className={className}
        style={{ ...vars, ...style }}
      >
        <g stroke="var(--chalk)" strokeWidth={2} strokeLinecap="round">
          {/* three-point arc */}
          <path d="M540 0 A 540 540 0 0 1 0 540" />
          {/* free-throw circle */}
          <path d="M300 0 A 300 300 0 0 1 0 300" />
          {/* restricted-area arc */}
          <path d="M150 0 A 150 150 0 0 1 0 150" strokeOpacity={0.7} />
          {/* radial hash marks fanning from the hoop */}
          <line x1="0" y1="0" x2="78" y2="0" strokeOpacity={0.45} />
          <line x1="0" y1="0" x2="55" y2="55" strokeOpacity={0.6} />
          <line x1="0" y1="0" x2="0" y2="78" strokeOpacity={0.45} />
        </g>
      </svg>
    )
  }

  if (variant === "floor") {
    return (
      <svg
        aria-hidden
        focusable="false"
        viewBox="0 0 940 500"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        className={className}
        style={{ ...vars, ...style }}
      >
        <g
          stroke="var(--chalk)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* boundary + half-court line */}
          <rect x="12" y="12" width="916" height="476" rx="3" />
          <line x1="470" y1="12" x2="470" y2="488" />
          <circle cx="470" cy="250" r="58" />
          <circle cx="470" cy="250" r="18" strokeOpacity={0.65} />
          {/* left half: key, free-throw circle, backboard, rim, three-point */}
          <rect x="12" y="178" width="182" height="144" />
          <circle cx="194" cy="250" r="58" />
          <line x1="44" y1="222" x2="44" y2="278" />
          <circle cx="58" cy="250" r="9" strokeOpacity={0.8} />
          <path d="M12 40 L92 40" />
          <path d="M12 460 L92 460" />
          <path d="M92 40 A 214 214 0 0 1 92 460" />
          {/* right half (mirror) */}
          <rect x="746" y="178" width="182" height="144" />
          <circle cx="746" cy="250" r="58" />
          <line x1="896" y1="222" x2="896" y2="278" />
          <circle cx="882" cy="250" r="9" strokeOpacity={0.8} />
          <path d="M928 40 L848 40" />
          <path d="M928 460 L848 460" />
          <path d="M848 40 A 214 214 0 0 0 848 460" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 1200 320"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ ...vars, ...style }}
    >
      <g stroke="var(--chalk)" strokeWidth={1.5} strokeLinecap="round">
        {/* baseline */}
        <line x1="120" y1="16" x2="120" y2="304" />
        {/* the key / painted area */}
        <rect x="120" y="108" width="196" height="104" rx="2" />
        {/* free-throw circle */}
        <circle cx="316" cy="160" r="58" />
        {/* three-point arc swinging up from the hoop */}
        <path d="M120 26 A 252 252 0 0 1 120 294" />
        {/* dimension ticks on the baseline — the "data instrument" detail */}
        <line x1="106" y1="62" x2="134" y2="62" strokeOpacity={0.55} />
        <line x1="106" y1="160" x2="134" y2="160" strokeOpacity={0.55} />
        <line x1="106" y1="258" x2="134" y2="258" strokeOpacity={0.55} />
        {/* half-court hint far right */}
        <line
          x1="1124"
          y1="16"
          x2="1124"
          y2="304"
          strokeOpacity={0.45}
          strokeDasharray="6 8"
        />
        <circle cx="1124" cy="160" r="72" strokeOpacity={0.45} />
      </g>
    </svg>
  )
}

export default CourtMarkings
