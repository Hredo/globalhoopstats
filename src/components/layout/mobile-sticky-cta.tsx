"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/provider"
import { Logo } from "@/components/svg/logo"

export function MobileStickyCta() {
  const t = useT()
  const [show, setShow] = useState(false)
  const [cookieVisible, setCookieVisible] = useState(false)

  useEffect(() => {
    const checkCookie = () => {
      const decided = document.cookie
        .split("; ")
        .some((c) => c.startsWith("ghs_cookie_consent="))
      setCookieVisible(!decided)
    }
    checkCookie()
    const onConsent = () => setCookieVisible(false)
    window.addEventListener("ghs:cookie-consent", onConsent)
    return () => window.removeEventListener("ghs:cookie-consent", onConsent)
  }, [])

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!show) return null

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[140] transition-transform duration-300 ease-fluid ${
        cookieVisible ? "translate-y-0" : "translate-y-0"
      } block sm:hidden`}
    >
      <div className="gh-glass rounded-t-2xl border-b-0 px-4 py-3">
        <Link
          href="/compare"
          className="flex items-center justify-center gap-2.5 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 active:scale-[0.97]"
        >
          <Logo className="h-4 w-4" />
          {t("home.hero.comparePlayers")}
        </Link>
      </div>
    </div>
  )
}
