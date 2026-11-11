"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { useT } from "@/lib/i18n/provider"
import {
  DEFAULT_GENDER,
  GENDER_COOKIE,
  genderParam,
  isGender,
  type Gender,
} from "@/lib/gender"

const ONE_YEAR_S = 60 * 60 * 24 * 365

export function rememberGender(gender: Gender): void {
  document.cookie = `${GENDER_COOKIE}=${gender}; path=/; max-age=${ONE_YEAR_S}; samesite=lax`
}

export function readBrowsingGender(): Gender {
  const prefix = `${GENDER_COOKIE}=`
  const entry = document.cookie.split("; ").find((c) => c.startsWith(prefix))
  const value = entry?.slice(prefix.length)
  return isGender(value) ? value : DEFAULT_GENDER
}

/**
 * The side the visitor is browsing, for client components rendered outside a
 * directory page (the search palette). Read after mount — the cookie is not
 * available while server-rendering — and again whenever `signal` changes.
 */
export function useBrowsingGender(signal?: unknown): Gender {
  const [gender, setGender] = useState<Gender>(DEFAULT_GENDER)
  useEffect(() => {
    setGender(readBrowsingGender()) // eslint-disable-line react-hooks/set-state-in-effect
  }, [signal])
  return gender
}

/** Query params that only make sense inside one gender's set of leagues. */
const GENDER_BOUND_PARAMS = ["league", "team", "page"]

function MarsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="10" cy="14" r="5.5" />
      <path d="M14 10l6-6M15 4h5v5" />
    </svg>
  )
}

function VenusIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="9" r="5.5" />
      <path d="M12 14.5V22M8.5 18.5h7" />
    </svg>
  )
}

/**
 * Men's / women's switch. Two cells and a thumb that slides between them; the
 * choice goes to the URL (`?gender=women`, nothing for men's) and to a cookie
 * so it survives a jump to another directory. Switching drops the league and
 * team filters, which belong to the side being left.
 */
export function GenderToggle({
  value,
  className = "",
}: {
  /** Gender the server rendered this page with. */
  value: Gender
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const t = useT()
  const [isPending, startTransition] = useTransition()
  // Optimistic: the thumb moves on click, not when the new page arrives.
  const [active, setActive] = useState<Gender>(value)

  useEffect(() => {
    setActive(value) // eslint-disable-line react-hooks/set-state-in-effect
    // A shared `?gender=women` link should stick for the rest of the visit.
    rememberGender(value)
  }, [value])

  function choose(next: Gender) {
    if (next === active) return
    setActive(next)
    rememberGender(next)
    const params = new URLSearchParams(search.toString())
    for (const key of GENDER_BOUND_PARAMS) params.delete(key)
    const param = genderParam(next)
    if (param) params.set("gender", param)
    else params.delete("gender")
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  const options: { gender: Gender; label: string; Icon: typeof MarsIcon }[] = [
    { gender: "men", label: t("directory.gender.men"), Icon: MarsIcon },
    { gender: "women", label: t("directory.gender.women"), Icon: VenusIcon },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={t("directory.gender.aria")}
      aria-busy={isPending}
      className={`relative inline-grid h-9 shrink-0 grid-cols-2 rounded-full border border-hairline bg-surface-1/80 p-0.5 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-brand-500 shadow-[0_1px_0_0_oklch(1_0_0/0.18)_inset] transition-transform duration-300 ease-fluid motion-reduce:transition-none"
        style={{
          transform: active === "women" ? "translateX(100%)" : "translateX(0)",
        }}
      />
      {options.map(({ gender, label, Icon }) => {
        const selected = active === gender
        return (
          <button
            key={gender}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => choose(gender)}
            className={`relative z-10 inline-flex h-full w-10 items-center justify-center rounded-full outline-none transition-colors duration-300 ease-fluid focus-visible:ring-2 focus-visible:ring-brand-400/60 ${
              // Fixed dark glyph on the orange thumb: the ink ramp inverts in
              // light mode, where ink-950 would be near-white on orange (2.4:1).
              selected
                ? "text-[oklch(0.16_0.014_56)]"
                : "text-ink-300 hover:text-ink-50"
            }`}
          >
            <Icon
              className={`h-4 w-4 transition-transform duration-300 ease-fluid motion-reduce:transition-none ${
                selected ? "scale-110" : "scale-95"
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
