"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  AccountSection,
  Field,
  FieldRow,
  StatusNote,
  TextInput,
} from "@/components/account/primitives"
import { useLocale, useT, type ClientTranslator } from "@/lib/i18n/provider"
import type { Locale } from "@/lib/i18n/config"

type SessionRow = {
  id: string
  userAgent: string | null
  ip: string | null
  createdAt: string
  expiresAt: string
  current: boolean
}

function deviceLabel(ua: string | null, t: ClientTranslator): string {
  if (!ua) return t("account.security.unknownDevice")
  const browser =
    /Edg/i.test(ua) ? "Edge"
    : /Chrome/i.test(ua) ? "Chrome"
    : /Firefox/i.test(ua) ? "Firefox"
    : /Safari/i.test(ua) ? "Safari"
    : t("account.security.browser")
  const os =
    /Windows/i.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iOS/i.test(ua) ? "iOS"
    : /Linux/i.test(ua) ? "Linux"
    : ""
  return os ? `${browser} · ${os}` : browser
}

function timeAgo(iso: string, locale: Locale): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  // Match the app language rather than the browser's.
  return d.toLocaleString(locale === "es" ? "es-ES" : "en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SecurityPanel() {
  return (
    <>
      <PasswordSection />
      <TwoFactorSection />
      <SessionsSection />
      <DangerZone />
    </>
  )
}

function PasswordSection() {
  const t = useT()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ type: "success" | "error"; msg: string } | null>(
    null,
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setNote(null)
    if (next !== confirm) {
      setNote({ type: "error", msg: t("account.security.passwordsDoNotMatch") })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNote({
          type: "error",
          msg: data.error ?? t("account.security.passwordUpdateError"),
        })
        return
      }
      setNote({
        type: "success",
        msg: t("account.security.passwordUpdated"),
      })
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch {
      setNote({ type: "error", msg: t("account.security.networkError") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AccountSection
      title={t("account.security.passwordTitle")}
      description={t("account.security.passwordDescription")}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("account.security.currentPassword")} htmlFor="cur-pw">
          <TextInput
            id="cur-pw"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <FieldRow>
          <Field label={t("account.security.newPassword")} htmlFor="new-pw">
            <TextInput
              id="new-pw"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </Field>
          <Field
            label={t("account.security.repeatPassword")}
            htmlFor="new-pw2"
          >
            <TextInput
              id="new-pw2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </Field>
        </FieldRow>

        {note ? <StatusNote type={note.type}>{note.msg}</StatusNote> : null}

        <button
          type="submit"
          disabled={saving || !current || !next}
          className="inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:opacity-50"
        >
          {saving
            ? t("account.security.updating")
            : t("account.security.updatePassword")}
        </button>
      </form>
    </AccountSection>
  )
}

function SessionsSection() {
  const t = useT()
  const locale = useLocale()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/sessions", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { sessions: SessionRow[] }
      setSessions(data.sessions)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const revoke = async (id: string) => {
    setBusy(true)
    try {
      await fetch(`/api/account/sessions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const revokeOthers = async () => {
    setBusy(true)
    try {
      await fetch("/api/account/sessions", { method: "DELETE" })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const hasOthers = sessions.some((s) => !s.current)

  return (
    <AccountSection
      title={t("account.security.sessionsTitle")}
      description={t("account.security.sessionsDescription")}
      action={
        hasOthers ? (
          <button
            type="button"
            onClick={revokeOthers}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-full border border-hairline bg-white/[0.04] px-4 text-[13px] font-medium text-ink-100 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {t("account.security.signOutOthers")}
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-ink-900/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-ink-100">
                  {deviceLabel(s.userAgent, t)}
                  {s.current ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-300">
                      {t("account.security.thisDevice")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {s.ip ? `${s.ip} · ` : ""}
                  {timeAgo(s.createdAt, locale)}
                </p>
              </div>
              {!s.current ? (
                <button
                  type="button"
                  onClick={() => revoke(s.id)}
                  disabled={busy}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-red-300/80 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                >
                  {t("account.security.revoke")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AccountSection>
  )
}

function TwoFactorSection() {
  const t = useT()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupStep, setSetupStep] = useState<"idle" | "sending" | "confirm" | "done">("idle")
  const [setupSessionId, setSetupSessionId] = useState<string | null>(null)
  const [setupCode, setSetupCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [backupCodesRevealed, setBackupCodesRevealed] = useState(false)
  const [regenPassword, setRegenPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; msg: string } | null>(null)
  const [remainingCodes, setRemainingCodes] = useState(0)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/account/2fa/status", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json() as { twoFactorEnabled: boolean; remainingBackupCodes: number }
      setEnabled(data.twoFactorEnabled)
      setRemainingCodes(data.remainingBackupCodes)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const startSetup = async () => {
    setBusy(true)
    setError(null)
    setSetupStep("sending")
    try {
      const res = await fetch("/api/account/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? t("account.security.setupError"))
        setSetupStep("idle")
        return
      }
      setSetupSessionId(data.sessionId)
      setSetupStep("confirm")
    } catch {
      setError("Network error.")
      setSetupStep("idle")
    } finally {
      setBusy(false)
    }
  }

  const confirmSetup = async () => {
    if (!setupSessionId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: setupSessionId, code: setupCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? t("account.security.invalidCode"))
        return
      }
      setBackupCodes(data.backupCodes ?? [])
      setSetupStep("done")
      setEnabled(true)
      setRemainingCodes(data.backupCodes?.length ?? 0)
    } catch {
      setError("Network error.")
    } finally {
      setBusy(false)
    }
  }

  const disable2FA = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: regenPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? t("account.security.disableError"))
        return
      }
      setEnabled(false)
      setSetupStep("idle")
      setBackupCodes([])
      setBackupCodesRevealed(false)
      setRegenPassword("")
      setStatusMsg({ type: "success", msg: t("account.security.disabledOk") })
    } catch {
      setError("Network error.")
    } finally {
      setBusy(false)
    }
  }

  const regenerateBackupCodes = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account/2fa/backup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: regenPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? t("account.security.regenerateError"))
        return
      }
      setBackupCodes(data.backupCodes ?? [])
      setBackupCodesRevealed(true)
      setRemainingCodes(data.backupCodes?.length ?? 0)
      setStatusMsg({ type: "success", msg: t("account.security.regeneratedOk") })
    } catch {
      setError("Network error.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <AccountSection
        title={t("account.security.twoFactorTitle")}
        description={t("account.security.twoFactorDescription")}
      >
        <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
      </AccountSection>
    )
  }

  return (
    <AccountSection
      title={t("account.security.twoFactorTitle")}
      description={t("account.security.twoFactorDescription")}
    >
      {setupStep === "done" ? (
        <div className="space-y-4">
          <StatusNote type="success">
            {t("account.security.twoFactorEnabledNote")}
          </StatusNote>

          {backupCodes.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
              <p className="text-sm font-semibold text-amber-200">
                {t("account.security.saveBackupCodes")}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {t("account.security.backupCodesHint")}
              </p>
              <div className={backupCodesRevealed ? "" : "mt-3"}>
                {backupCodesRevealed ? (
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {backupCodes.map((code, i) => (
                      <code key={i} className="rounded-lg bg-ink-900/60 px-3 py-2 text-xs font-mono text-amber-100">
                        {code}
                      </code>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBackupCodesRevealed(true)}
                    className="mt-3 inline-flex h-9 items-center rounded-full border border-hairline bg-white/[0.04] px-4 text-[13px] font-medium text-ink-100 transition hover:bg-white/[0.08]"
                  >
                    {t("account.security.revealBackupCodes")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setBackupCodesRevealed(false)
                    setSetupStep("idle")
                    void loadStatus()
                  }}
                  className="mt-3 inline-flex h-9 items-center rounded-full bg-brand-500 px-4 text-[13px] font-semibold text-ink-950 transition hover:bg-brand-400"
                >
                  {t("account.security.doneSavedCodes")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : setupStep === "confirm" ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-300">
            {t("account.security.enterCode")}
          </p>
          <Field
            label={t("account.security.verificationCode")}
            htmlFor="tfa-code"
          >
            <TextInput
              id="tfa-code"
              type="text"
              inputMode="numeric"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
            />
          </Field>
          {error ? <StatusNote type="error">{error}</StatusNote> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirmSetup}
              disabled={busy || setupCode.length !== 6}
              className="inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:opacity-50"
            >
              {busy
                ? t("account.security.verifying")
                : t("account.security.confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSetupStep("idle")
                setSetupCode("")
                setError(null)
              }}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-ink-300 transition hover:text-ink-50"
            >
              {t("account.security.cancel")}
            </button>
          </div>
        </div>
      ) : enabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t("account.security.enabled")}
            </span>
            <span className="text-xs text-ink-500">
              {remainingCodes > 0
                ? t(
                    remainingCodes === 1
                      ? "account.security.backupCodesRemainingOne"
                      : "account.security.backupCodesRemainingOther",
                    { count: remainingCodes },
                  )
                : t("account.security.noBackupCodesRemaining")}
            </span>
          </div>

          {backupCodesRevealed && backupCodes.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
              <p className="text-sm font-semibold text-amber-200">
                {t("account.security.backupCodes")}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {backupCodes.map((code, i) => (
                  <code key={i} className="rounded-lg bg-ink-900/60 px-3 py-2 text-xs font-mono text-amber-100">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <StatusNote type="error">{error}</StatusNote> : null}
          {statusMsg ? <StatusNote type={statusMsg.type}>{statusMsg.msg}</StatusNote> : null}

          <div className="space-y-2">
            <Field
              label={t("account.security.confirmYourPassword")}
              htmlFor="tfa-pw"
            >
              <TextInput
                id="tfa-pw"
                type="password"
                value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={t("account.security.yourPassword")}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={regenerateBackupCodes}
                disabled={busy || !regenPassword}
                className="inline-flex h-9 items-center rounded-full border border-hairline bg-white/[0.04] px-4 text-[13px] font-medium text-ink-100 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {busy
                  ? t("account.security.working")
                  : t("account.security.regenerateBackupCodes")}
              </button>
              <button
                type="button"
                onClick={disable2FA}
                disabled={busy || !regenPassword}
                className="inline-flex h-9 items-center rounded-full border border-red-500/40 bg-red-500/10 px-4 text-[13px] font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                {busy
                  ? t("account.security.working")
                  : t("account.security.disable2fa")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-300">
            {t("account.security.enablePrompt")}
          </p>
          {error ? <StatusNote type="error">{error}</StatusNote> : null}
          <button
            type="button"
            onClick={startSetup}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:opacity-50"
          >
            {busy
              ? t("account.security.sendingCode")
              : t("account.security.enable2fa")}
          </button>
        </div>
      )}
    </AccountSection>
  )
}

function DangerZone() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? t("account.security.deleteError"))
        return
      }
      window.dispatchEvent(new Event("auth:changed"))
      window.location.assign("/")
    } catch {
      setError(t("account.security.networkError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-red-200 sm:text-lg">
        {t("account.security.dangerTitle")}
      </h2>
      <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-ink-400">
        {t("account.security.dangerDescription")}
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex h-10 items-center rounded-full border border-red-500/40 bg-red-500/10 px-5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
        >
          {t("account.security.deleteMyAccount")}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <Field
            label={t("account.security.confirmWithPassword")}
            htmlFor="del-pw"
          >
            <TextInput
              id="del-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t("account.security.yourPassword")}
            />
          </Field>
          {error ? <StatusNote type="error">{error}</StatusNote> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy || !password}
              className="inline-flex h-10 items-center rounded-full bg-red-500 px-5 text-sm font-semibold text-[#fff] transition hover:bg-red-400 disabled:opacity-50"
            >
              {busy
                ? t("account.security.deleting")
                : t("account.security.permanentlyDelete")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setPassword("")
                setError(null)
              }}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-ink-300 transition hover:text-ink-50"
            >
              {t("account.security.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
