"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import {
  AccountSection,
  Field,
  FieldRow,
  StatusNote,
  TextInput,
} from "@/components/account/primitives"
import { getProvider } from "@/lib/ai/providers"

import { CURRENCIES, type CurrencyCode } from "@/lib/market/currency"

type Settings = {
  advisorProvider: string | null
  compareProvider: string | null
  currency?: string
}

type Profile = {
  name: string
  email: string
  planLabel: string
  role: string
  createdAt: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function ProfilePanel() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(
    null,
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
      setSettings(data.settings)
      setName(data.profile.name)
      setEmail(data.profile.email)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving || !profile) return
    setSaving(true)
    setStatus(null)
    try {
      const body: Record<string, string> = {}
      if (name.trim() !== profile.name) body.name = name.trim()
      const emailChanging =
        email.trim().toLowerCase() !== profile.email.toLowerCase()
      if (emailChanging) body.email = email.trim()
      if (Object.keys(body).length === 0) {
        setStatus({ type: "success", msg: "Nothing to change." })
        return
      }
      // Changing the sign-in email requires re-authentication.
      if (emailChanging) {
        if (!currentPassword) {
          setStatus({
            type: "error",
            msg: "Enter your current password to change your email.",
          })
          return
        }
        body.currentPassword = currentPassword
      }
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ type: "error", msg: data.error ?? "Could not save changes." })
        return
      }
      setProfile({ ...profile, name: body.name ?? profile.name, email: body.email ?? profile.email })
      setCurrentPassword("")
      setStatus({ type: "success", msg: "Profile updated." })
      // Refresh the navbar's account menu without a reload.
      window.dispatchEvent(new Event("auth:changed"))
    } catch {
      setStatus({ type: "error", msg: "Network error. Try again." })
    } finally {
      setSaving(false)
    }
  }

  const advisor = settings?.advisorProvider
    ? getProvider(settings.advisorProvider)
    : null
  const compare = settings?.compareProvider
    ? getProvider(settings.compareProvider)
    : null
  const anyAi = Boolean(advisor || compare)

  return (
    <>
      <AccountSection
        title="Profile"
        description="Your display name and the email you sign in with."
      >
        {loading ? (
          <SkeletonForm />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldRow>
              <Field label="Name" htmlFor="acc-name">
                <TextInput
                  id="acc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={60}
                  autoComplete="name"
                />
              </Field>
              <Field label="Email" htmlFor="acc-email" hint="Used to sign in.">
                <TextInput
                  id="acc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  autoComplete="email"
                />
              </Field>
            </FieldRow>

            {profile &&
            email.trim().toLowerCase() !== profile.email.toLowerCase() ? (
              <Field
                label="Current password"
                htmlFor="acc-current-password"
                hint="Required to change the email you sign in with."
              >
                <TextInput
                  id="acc-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  maxLength={200}
                  autoComplete="current-password"
                />
              </Field>
            ) : null}

            {status ? <StatusNote type={status.type}>{status.msg}</StatusNote> : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </AccountSection>

      <AccountSection
        title="AI engines"
        description="Which model powers each AI feature. Manage providers and keys in AI & keys."
        action={
          <Link
            href="/account/ai-keys"
            className="inline-flex h-9 items-center rounded-full border border-hairline bg-white/[0.04] px-4 text-[13px] font-medium text-ink-100 transition hover:bg-white/[0.08]"
          >
            Manage
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <EngineCard feature="AI Advisor" provider={advisor?.name ?? null} />
          <EngineCard feature="AI Compare" provider={compare?.name ?? null} />
        </div>
        {!anyAi && !loading ? (
          <div className="mt-4">
            <StatusNote type="info">
              You haven&apos;t connected an AI yet. AI features fall back to basic
              mode until you{" "}
              <Link href="/account/ai-keys" className="font-semibold underline">
                add a provider
              </Link>
              . New here?{" "}
              <Link href="/ai-setup" className="font-semibold underline">
                Read the setup guide
              </Link>
              .
            </StatusNote>
          </div>
        ) : null}
      </AccountSection>

      <AccountSection
        title="Currency"
        description="Default currency for market valuations and the trade simulator."
      >
        <div className="flex flex-wrap gap-2">
          {(["EUR", "USD", "GBP"] as CurrencyCode[]).map((code) => (
            <button
              key={code}
              onClick={async () => {
                const res = await fetch("/api/account/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ currency: code }),
                })
                if (res.ok) {
                  setSettings((prev) =>
                    prev ? { ...prev, currency: code } : prev,
                  )
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                (settings?.currency ?? "EUR") === code
                  ? "border-brand-500/40 bg-brand-500/15 text-brand-200"
                  : "border-hairline bg-surface-0 text-ink-300 hover:border-brand-500/30 hover:text-ink-100"
              }`}
            >
              <span className="text-xs">{CURRENCIES[code].symbol}</span>
              {code}
            </button>
          ))}
        </div>
      </AccountSection>

      {profile ? (
        <AccountSection title="Account details">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Plan" value={profile.planLabel} />
            <Detail label="Member since" value={formatDate(profile.createdAt)} />
          </dl>
        </AccountSection>
      ) : null}
    </>
  )
}

function EngineCard({
  feature,
  provider,
}: {
  feature: string
  provider: string | null
}) {
  return (
    <div className="rounded-xl border border-hairline bg-ink-900/40 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {feature}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm font-medium text-ink-100">
        <span
          className={`h-2 w-2 rounded-full ${
            provider ? "bg-emerald-400" : "bg-ink-600"
          }`}
        />
        {provider ?? "Not connected"}
      </p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-100">{value}</dd>
    </div>
  )
}

function SkeletonForm() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
      <div className="h-10 w-32 animate-pulse rounded-full bg-white/[0.04]" />
    </div>
  )
}
