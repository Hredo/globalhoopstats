import type { ReactElement } from "react"

// Hard-coded brand colors matching the Logo component's CSS variables so the
// mark renders correctly inside `next/og` ImageResponse (satori has no access
// to CSS custom properties).
//
// Source variables (oklch → hex):
//   --color-brand-300: oklch(0.82 0.15 54) → #ffa75f
//   --color-brand-500: oklch(0.72 0.205 50) → #ff7300
//   --color-brand-700: oklch(0.53 0.18 43) → #bb3900
//   --color-court-900: oklch(0.15 0.035 50) → #160601
//   --color-court-950: oklch(0.09 0.022 48) → #060100
const BRAND_300 = "#ffa75f"
const BRAND_500 = "#ff7300"
const BRAND_700 = "#bb3900"
const COURT_900 = "#160601"
const COURT_950 = "#060100"

/**
 * The globalhoopstats basketball mark (orange ball + "GH") rendered with
 * satori-safe markup for use inside `next/og` ImageResponse (favicons, PWA
 * icons, social images). Mirrors the `Logo` SVG component used in the navbar.
 *
 * Pass the **pixel size** you want the ball drawn at.
 */
export function BallMark({ size }: { size: number }): ReactElement {
  const fontSize = Math.round(size * 0.34)
  const strokeW = Math.max(1, Math.round(size / 42))

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="ghBall" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BRAND_300} />
            <stop offset="55%" stopColor={BRAND_500} />
            <stop offset="100%" stopColor={BRAND_700} />
          </linearGradient>
          <linearGradient id="ghGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_500} stopOpacity={0.5} />
            <stop offset="100%" stopColor={BRAND_700} stopOpacity={0} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#ghGlow)" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="url(#ghBall)"
          stroke={COURT_900}
          strokeWidth="1.5"
        />
        <path
          d="M6 32 H58"
          stroke={COURT_950}
          strokeWidth={strokeW}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
        <path
          d="M32 6 C18 18 18 46 32 58"
          stroke={COURT_950}
          strokeWidth={strokeW}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
        <path
          d="M32 6 C46 18 46 46 32 58"
          stroke={COURT_950}
          strokeWidth={strokeW}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
      </svg>
      <div
        style={{
          position: "relative",
          display: "flex",
          fontWeight: 800,
          fontSize,
          color: COURT_950,
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        GH
      </div>
    </div>
  )
}
