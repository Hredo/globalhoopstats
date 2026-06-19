import type { ReactNode } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { readSessionUser } from "@/lib/auth/server-user"
import { userPlan } from "@/lib/db/schema"
import { planLabel } from "@/lib/auth/current-user"
import { AccountNav } from "@/components/account/account-nav"

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your profile, AI providers, subscription and security.",
  robots: { index: false, follow: false },
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
}

const PLAN_BADGE: Record<string, string> = {
  Admin: "border-brand-400/50 bg-brand-500/15 text-brand-200",
  Pro: "border-positive/50 bg-positive/10 text-positive",
  Free: "border-hairline bg-white/[0.04] text-ink-300",
}

export default async function AccountLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await readSessionUser()
  if (!user) redirect("/login?next=/account")

  const plan = userPlan(user)
  const label = planLabel(plan)

  return (
    <div className="py-8 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-ink-800/80 via-ink-900/80 to-ink-900/80 p-5 sm:p-6">
        {/* background handled globally by the fixed court backdrop */}
        <div className="relative flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-ember-600 text-lg font-bold text-ink-950 shadow-[var(--shadow-brand-glow)] ring-1 ring-white/10">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-bold text-ink-50 sm:text-2xl">
                {user.name}
              </h1>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  PLAN_BADGE[label] ?? PLAN_BADGE.Free
                }`}
              >
                {label}
              </span>
            </div>
            <p className="truncate text-sm text-ink-400">{user.email}</p>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-white/5 bg-ink-900/40 p-2">
            <AccountNav />
          </div>
        </aside>
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  )
}
