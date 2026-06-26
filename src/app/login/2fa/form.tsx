"use client"

import { useState, useEffect, useCallback, type FormEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"

function formatTime(ms: number): string {
  if (ms <= 0) return "0:00"
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function TwoFactorVerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session") ?? ""

  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useBackup, setUseBackup] = useState(false)
  const [expiresAt, setExpiresAt] = useState(
    () => Number(searchParams.get("e")) || 0,
  )
  const [now, setNow] = useState(Date.now())
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (expiresAt <= 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const remaining = Math.max(0, expiresAt - now)
  const expired = remaining <= 0

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting || !sessionId) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code: code.trim() }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error ?? "Invalid verification code.")
        return
      }
      window.dispatchEvent(new Event("auth:changed"))
      router.refresh()
      router.push("/ai-advisor")
    } catch {
      setError("We couldn't reach the server. Check your connection and retry.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = useCallback(async () => {
    if (resending || !sessionId) return
    setResending(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/2fa/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error ?? "Could not resend code.")
        return
      }
      setExpiresAt(payload.expiresAt)
      setNow(Date.now())
      setCode("")
    } catch {
      setError("We couldn't reach the server. Check your connection and retry.")
    } finally {
      setResending(false)
    }
  }, [sessionId, resending])

  if (!sessionId) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center px-6 py-10">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-2xl font-bold text-ink-50">
            Invalid verification session
          </h1>
          <p className="mt-2 text-sm text-ink-300">
            No verification session found. Please sign in again.
          </p>
          <a
            href="/login"
            className="mt-4 inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
          >
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15">
          <svg
            className="h-7 w-7 text-brand-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-50 sm:text-3xl">
          Two-factor authentication
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          {useBackup
            ? "Enter one of your backup codes to sign in."
            : "Enter the 6-digit code sent to your email."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <div className="relative">
            <label
              htmlFor="code"
              className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-300"
            >
              {useBackup ? "Backup code" : "Verification code"}
            </label>
            <input
              id="code"
              type="text"
              inputMode={useBackup ? "text" : "numeric"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={useBackup ? "XXXXXXXX" : "000000"}
              autoComplete="one-time-code"
              required
              maxLength={64}
              className="w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 pb-2 pt-6 text-center text-xl font-mono text-ink-50 outline-none tracking-widest transition-all duration-200 hover:border-white/20 focus:border-brand-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]"
            />
          </div>

          {!useBackup && expiresAt > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-ink-400">
              {expired ? (
                <span className="text-red-300">Code expired</span>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" d="M12 6v6l4 2" />
                  </svg>
                  Code expires in{" "}
                  <span className="font-mono font-semibold text-ink-100 tabular-nums">
                    {formatTime(remaining)}
                  </span>
                </>
              )}
            </div>
          )}

          <AnimatePresence>
            {error ? (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <button
            type="submit"
            disabled={submitting || !code.trim() || (!useBackup && expired)}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink-950" />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-ink-950"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-ink-950"
                  style={{ animationDelay: "240ms" }}
                />
                <span className="ml-1.5">Verifying…</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                Verify
                <svg
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            )}
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              aria-hidden
            />
          </button>

          {!useBackup && expired && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-brand-500/40 bg-transparent px-4 py-3 text-sm font-semibold text-brand-400 transition hover:border-brand-500/60 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resending ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400" />
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
                      style={{ animationDelay: "120ms" }}
                    />
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
                      style={{ animationDelay: "240ms" }}
                    />
                    <span className="ml-1.5">Sending…</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Resend code
                  </span>
                )}
              </button>
            </motion.div>
          )}

          <button
            type="button"
            onClick={() => {
              setUseBackup(!useBackup)
              setCode("")
              setError(null)
            }}
            className="w-full text-center text-xs text-ink-500 underline decoration-ink-700 underline-offset-2 transition hover:text-ink-300"
          >
            {useBackup
              ? "Use email verification code instead"
              : "Use a backup code instead"}
          </button>

          <p className="text-center text-xs text-ink-500">
            <a
              href="/login"
              className="underline decoration-ink-700 underline-offset-2 transition hover:text-ink-300"
            >
              Sign in as a different user
            </a>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
