"use client"

import { useState, type FormEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

function passwordStrength(pw: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (pw.length >= 12) score++
  const clamped = Math.min(3, score)
  const meta: Record<number, { label: string; color: string }> = {
    0: { label: "Too short", color: "bg-red-500" },
    1: { label: "Weak", color: "bg-red-500" },
    2: { label: "OK", color: "bg-amber-500" },
    3: { label: "Strong", color: "bg-emerald-500" },
  }
  return { score: clamped, ...meta[clamped] }
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const emailParam = searchParams.get("email") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const strength = passwordStrength(password)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: emailParam,
          password,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload.error ?? "Could not reset password. The link may have expired.")
        return
      }
      setDone(true)
    } catch {
      setError("We couldn't reach the server. Check your connection and retry.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!token || !emailParam) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center px-6 py-10">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-2xl font-bold text-ink-50">Invalid reset link</h1>
          <p className="mt-2 text-sm text-ink-300">
            This link is missing required data. Please request a new password reset.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
            <svg
              className="h-7 w-7 text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-50">
            Password reset complete
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400"
          >
            Sign in
          </Link>
        </motion.div>
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
        <h1 className="font-display text-3xl font-bold text-ink-50 sm:text-4xl">
          Set new password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          Choose a strong password for your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <div className="relative">
            <label
              htmlFor="password"
              className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-300"
            >
              New password
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={200}
              className="w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 pb-2 pt-6 text-base text-ink-50 outline-none transition-all duration-200 hover:border-white/20 focus:border-brand-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)] pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-white/10 hover:text-ink-200"
            >
              <AnimatePresence mode="wait">
                {showPassword ? (
                  <motion.span
                    key="off"
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="flex"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  </motion.span>
                ) : (
                  <motion.span
                    key="on"
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="flex"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      strength.score > i ? strength.color : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-500">
                {strength.label}
              </span>
            </div>
          </div>

          <div className="relative">
            <label
              htmlFor="confirm"
              className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-300"
            >
              Repeat password
            </label>
            <input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={200}
              className="w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 pb-2 pt-6 text-base text-ink-50 outline-none transition-all duration-200 hover:border-white/20 focus:border-brand-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)] pr-12"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((c) => !c)}
              tabIndex={-1}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-white/10 hover:text-ink-200"
            >
              <AnimatePresence mode="wait">
                {showConfirm ? (
                  <motion.span
                    key="off"
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="flex"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  </motion.span>
                ) : (
                  <motion.span
                    key="on"
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="flex"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

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
            disabled={submitting || !password || !confirm}
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
                <span className="ml-1.5">Resetting…</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                Reset password
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
        </form>
      </motion.div>
    </div>
  )
}
