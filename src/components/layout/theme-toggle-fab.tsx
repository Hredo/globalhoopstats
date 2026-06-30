"use client"

import { useTheme } from "@/lib/theme/provider"
import { useT } from "@/lib/i18n/provider"
import { cn } from "@/components/ui/cn"

/**
 * Floating theme switch — docked to the right edge, outside the navbar, so it is
 * always reachable. The sun⇄moon icon morphs on toggle: the rays burst out with
 * a staggered spring, the crescent "bite" slides away to fill the disc, and the
 * whole glyph rotates. Big hit area + a text label that slides out on hover keep
 * it friendly for readers who want the lighter, higher-contrast mode.
 */
export function ThemeToggleFab() {
  const { theme, toggleTheme } = useTheme()
  const t = useT()
  const isLight = theme === "light"

  const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

  return (
    <div className="pointer-events-none fixed right-0 top-1/2 z-[60] -translate-y-1/2">
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={isLight}
        aria-label={isLight ? t("theme.switchToDark") : t("theme.switchToLight")}
        title={isLight ? t("theme.switchToDark") : t("theme.switchToLight")}
        className={cn(
          "group pointer-events-auto flex items-center gap-2 rounded-l-2xl border border-r-0 py-3 pl-3.5 pr-3.5",
          "gh-glass shadow-[var(--shadow-court)] backdrop-blur-xl",
          "transition-[transform,padding,box-shadow] duration-500 ease-spring",
          "hover:pr-4 hover:-translate-x-0.5 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0",
        )}
      >
        <span
          className={cn(
            "relative grid h-7 w-7 shrink-0 place-items-center transition-[color,transform] duration-700 ease-spring",
            isLight
              ? "rotate-0 text-brand-500"
              : "-rotate-[40deg] text-ink-200",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <mask id="ghs-theme-moon-mask">
                <rect x="0" y="0" width="24" height="24" fill="white" />
                {/* The "bite" that carves the crescent. It slides up-and-away
                    (translate) when switching to the sun, revealing a full disc. */}
                <circle
                  cx="12"
                  cy="12"
                  r="6.2"
                  fill="black"
                  className="origin-center transition-transform duration-700 ease-spring"
                  style={{
                    transform: isLight
                      ? "translate(9px, -9px)"
                      : "translate(4.5px, -3.5px)",
                  }}
                />
              </mask>
            </defs>

            {/* Sun rays — burst outward with a staggered spring in light mode. */}
            <g
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="transition-opacity duration-300"
            >
              {RAY_ANGLES.map((angle, i) => (
                <line
                  key={angle}
                  x1="12"
                  y1="12"
                  x2="12"
                  y2="12"
                  className="origin-center transition-all duration-500 ease-spring"
                  style={{
                    transitionDelay: isLight ? `${i * 35}ms` : "0ms",
                    transform: isLight
                      ? `rotate(${angle}deg) translateY(-8.5px) scaleY(1)`
                      : `rotate(${angle}deg) translateY(-6px) scaleY(0)`,
                    opacity: isLight ? 0.95 : 0,
                  }}
                />
              ))}
            </g>

            {/* The body: a moon crescent that fills into a full sun disc. */}
            <circle
              cx="12"
              cy="12"
              r={isLight ? 5 : 6}
              fill="currentColor"
              mask="url(#ghs-theme-moon-mask)"
              className="transition-all duration-700 ease-spring"
            />
          </svg>
        </span>

        {/* Label reveals on hover/focus (and is read by screen readers always). */}
        <span className="grid max-w-0 grid-rows-[1fr] overflow-hidden text-left text-[13px] font-semibold text-ink-100 transition-[max-width] duration-500 ease-fluid group-hover:max-w-[8rem] group-focus-visible:max-w-[8rem]">
          <span className="whitespace-nowrap pr-1">
            {isLight ? t("theme.dark") : t("theme.light")}
          </span>
        </span>
      </button>
    </div>
  )
}
