"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AccountSection,
  StatusNote,
  Toggle,
} from "@/components/account/primitives"
import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { useT } from "@/lib/i18n/provider"

type Settings = {
  emailProduct: boolean
  emailUsage: boolean
  reduceMotion: boolean
}

const DEFAULTS: Settings = {
  emailProduct: true,
  emailUsage: false,
  reduceMotion: false,
}

export function PreferencesPanel() {
  const t = useT()
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ type: "success" | "error"; msg: string } | null>(
    null,
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/settings", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { settings: Settings }
      setSettings({
        emailProduct: data.settings.emailProduct,
        emailUsage: data.settings.emailUsage,
        reduceMotion: data.settings.reduceMotion,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setNote(null)
    try {
      const res = await fetch("/api/account/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailProduct: settings.emailProduct,
          emailUsage: settings.emailUsage,
          reduceMotion: settings.reduceMotion,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNote({
          type: "error",
          msg: data.error ?? t("account.preferences.saveError"),
        })
        return
      }
      setNote({ type: "success", msg: t("account.preferences.saved") })
    } catch {
      setNote({ type: "error", msg: t("account.preferences.networkError") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AccountSection
        title={t("account.preferences.languageTitle")}
        description={t("account.preferences.languageDescription")}
      >
        <LanguageSwitcher variant="inline" />
      </AccountSection>

      <AccountSection
        title={t("account.preferences.notificationsTitle")}
        description={t("account.preferences.notificationsDescription")}
      >
        <div className="divide-y divide-white/5">
          <Toggle
            label={t("account.preferences.productUpdates")}
            description={t("account.preferences.productUpdatesHint")}
            checked={settings.emailProduct}
            onChange={(v) => setSettings((s) => ({ ...s, emailProduct: v }))}
            disabled={loading}
          />
          <Toggle
            label={t("account.preferences.usageAlerts")}
            description={t("account.preferences.usageAlertsHint")}
            checked={settings.emailUsage}
            onChange={(v) => setSettings((s) => ({ ...s, emailUsage: v }))}
            disabled={loading}
          />
        </div>
      </AccountSection>

      <AccountSection
        title={t("account.preferences.accessibilityTitle")}
        description={t("account.preferences.accessibilityDescription")}
      >
        <div className="divide-y divide-white/5">
          <Toggle
            label={t("account.preferences.reduceMotion")}
            description={t("account.preferences.reduceMotionHint")}
            checked={settings.reduceMotion}
            onChange={(v) => setSettings((s) => ({ ...s, reduceMotion: v }))}
            disabled={loading}
          />
        </div>
      </AccountSection>

      {note ? <StatusNote type={note.type}>{note.msg}</StatusNote> : null}

      <button
        type="button"
        onClick={save}
        disabled={saving || loading}
        className="inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:opacity-50"
      >
        {saving ? t("account.preferences.saving") : t("account.preferences.save")}
      </button>
    </>
  )
}
