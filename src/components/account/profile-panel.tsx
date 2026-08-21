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
import { useLocale, useT } from "@/lib/i18n/provider"
import type { Locale } from "@/lib/i18n/config"

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

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  // Follow the language the user picked in the app, not the browser's own
  // locale — otherwise a Spanish UI renders "January 3, 2026".
  return d.toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function ProfilePanel() {
  const t = useT()
  const locale = useLocale()
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
        setStatus({ type: "success", msg: t("account.profile.nothingToChange") })
        return
      }
      // Changing the sign-in email requires re-authentication.
      if (emailChanging) {
        if (!currentPassword) {
          setStatus({
            type: "error",
            msg: t("account.profile.needPasswordForEmail"),
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
        setStatus({
          type: "error",
          msg: data.error ?? t("account.profile.saveError"),
        })
        return
      }
      setProfile({ ...profile, name: body.name ?? profile.name, email: body.email ?? profile.email })
      setCurrentPassword("")
      setStatus({ type: "success", msg: t("account.profile.updated") })
      // Refresh the navbar's account menu without a reload.
      window.dispatchEvent(new Event("auth:changed"))
    } catch {
      setStatus({ type: "error", msg: t("account.profile.networkError") })
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
        title={t("account.profile.title")}
        description={t("account.profile.description")}
      >
        {loading ? (
          <SkeletonForm />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldRow>
              <Field label={t("account.profile.name")} htmlFor="acc-name">
                <TextInput
                  id="acc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={60}
                  autoComplete="name"
                />
              </Field>
              <Field
                label={t("account.profile.email")}
                htmlFor="acc-email"
                hint={t("account.profile.emailHint")}
              >
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
                label={t("account.profile.currentPassword")}
                htmlFor="acc-current-password"
                hint={t("account.profile.currentPasswordHint")}
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
                {saving ? t("account.profile.saving") : t("account.profile.save")}
              </button>
            </div>
          </form>
        )}
      </AccountSection>

      <AccountSection
        title={t("account.profile.aiEnginesTitle")}
        description={t("account.profile.aiEnginesDescription")}
        action={
          <Link
            href="/account/ai-keys"
            className="inline-flex h-9 items-center rounded-full border border-hairline bg-white/[0.04] px-4 text-[13px] font-medium text-ink-100 transition hover:bg-white/[0.08]"
          >
            {t("account.profile.manage")}
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <EngineCard
            feature={t("account.profile.advisorFeature")}
            provider={advisor?.name ?? null}
            emptyLabel={t("account.profile.notConnected")}
          />
          <EngineCard
            feature={t("account.profile.compareFeature")}
            provider={compare?.name ?? null}
            emptyLabel={t("account.profile.notConnected")}
          />
        </div>
        {!anyAi && !loading ? (
          <div className="mt-4">
            <StatusNote type="info">
              {t("account.profile.noAiNoticeBefore")}{" "}
              <Link href="/account/ai-keys" className="font-semibold underline">
                {t("account.profile.noAiNoticeLink")}
              </Link>
              {t("account.profile.noAiNoticeMiddle")}{" "}
              <Link href="/ai-setup" className="font-semibold underline">
                {t("account.profile.noAiNoticeGuide")}
              </Link>
              .
            </StatusNote>
          </div>
        ) : null}
      </AccountSection>

      <AccountSection
        title={t("account.profile.currencyTitle")}
        description={t("account.profile.currencyDescription")}
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
        <AccountSection title={t("account.profile.detailsTitle")}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail
              label={t("account.profile.plan")}
              value={profile.planLabel}
            />
            <Detail
              label={t("account.profile.memberSince")}
              value={formatDate(profile.createdAt, locale)}
            />
          </dl>
        </AccountSection>
      ) : null}
    </>
  )
}

function EngineCard({
  feature,
  provider,
  emptyLabel,
}: {
  feature: string
  provider: string | null
  emptyLabel: string
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
        {provider ?? emptyLabel}
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
