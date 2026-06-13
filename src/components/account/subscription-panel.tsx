"use client"

import { useCallback, useEffect, useState } from "react"
import { AccountSection } from "@/components/account/primitives"

export function SubscriptionPanel() {
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile", { cache: "no-store" })
      if (!res.ok) return
      await res.json()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      {/* NOTE: Plan section simplified during Beta — everything is free. */}
      <AccountSection
        title="Your plan"
        description="Everything is free during the public beta. No limits, no paywalls."
      >
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
        ) : (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.06] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-sm">
                🏀
              </span>
              <div>
                <p className="text-sm text-ink-400">Current status</p>
                <p className="font-display text-lg font-bold text-ink-50">
                  Everything unlocked — Beta
                </p>
              </div>
            </div>
            <p className="mt-2 text-[13px] text-ink-300">
              All features are available to everyone during the public beta. AI
              Advisor, AI comparisons, exports — no limits.
            </p>
          </div>
        )}
      </AccountSection>

      {/* NOTE: Plans section and usage meters hidden during Beta.
      <AccountSection title="Plans">...</AccountSection>
      */}
    </>
  )
}


