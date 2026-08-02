"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/provider"

const CONSENT_COOKIE = "ghs_cookie_consent"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

type Consent = "accepted" | "rejected"

function hasDecided(): boolean {
  if (typeof document === "undefined") return true
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${CONSENT_COOKIE}=`))
}

function persist(value: Consent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie =
    `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; ` +
    `SameSite=Lax${secure}`
}

/**
 * GDPR-style cookie consent banner. This site only sets first-party cookies
 * that are strictly necessary (session) plus a preferences cookie — no
 * third-party advertising or tracking — so this is primarily a transparency
 * notice. The choice is stored for a year; "Reject" is given equal prominence
 * to "Accept" as the regulation requires.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const t = useT()

  useEffect(() => {
    // Run after mount to avoid a hydration mismatch (document.cookie is
    // client-only). Only show if the user hasn't chosen yet.
    if (!hasDecided()) setVisible(true) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  if (!visible) return null

  const decide = (value: Consent) => {
    persist(value)
    setVisible(false)
    window.dispatchEvent(
      new CustomEvent("ghs:cookie-consent", { detail: value }),
    )
  }

  return (
    <div
      role="dialog"
      aria-label={t("cookies.bannerAria")}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[150] px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-hairline bg-surface-0/90 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-sm leading-relaxed text-ink-200">
          {t("cookies.message")}
          <Link
            href="/privacy"
            className="font-semibold text-brand-400 underline-offset-2 hover:underline"
          >
            {t("cookies.privacyLink")}
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <Button variant="secondary" size="sm" onClick={() => decide("rejected")}>
            {t("cookies.reject")}
          </Button>
          <Button variant="primary" size="sm" onClick={() => decide("accepted")}>
            {t("cookies.accept")}
          </Button>
        </div>
      </div>
    </div>
  )
}
