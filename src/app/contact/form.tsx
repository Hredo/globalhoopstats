"use client"

import { useState, type FormEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useT } from "@/lib/i18n/provider"

const FOCUS =
  "w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 pb-2 pt-6 text-base text-ink-50 outline-none transition-all duration-200 hover:border-white/20 focus:border-brand-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]"

const LABEL =
  "pointer-events-none absolute left-4 top-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-300"

export function ContactForm() {
  const t = useT()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [hp, setHp] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          hp,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? t("contact.genericError"))
        return
      }
      setSent(true)
    } catch {
      setError(t("contact.networkError"))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
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
            {t("contact.sentTitle")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">
            {t("contact.sentBody")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-brand-400 transition hover:text-brand-300"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t("contact.backHome")}
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
          {t("contact.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          {t("contact.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          {/* Honeypot — must stay empty. */}
          <input
            type="text"
            name="hp"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            className="hidden"
            aria-hidden
          />

          <div className="relative">
            <label htmlFor="name" className={LABEL}>
              {t("contact.name")}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("contact.namePlaceholder")}
              autoComplete="name"
              required
              maxLength={100}
              className={FOCUS}
            />
          </div>

          <div className="relative">
            <label htmlFor="email" className={LABEL}>
              {t("contact.email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("contact.emailPlaceholder")}
              autoComplete="email"
              required
              maxLength={254}
              className={FOCUS}
            />
          </div>

          <div className="relative">
            <label htmlFor="subject" className={LABEL}>
              {t("contact.subject")}
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("contact.subjectPlaceholder")}
              required
              maxLength={200}
              className={FOCUS}
            />
          </div>

          <div className="relative">
            <label htmlFor="message" className={LABEL}>
              {t("contact.message")}
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("contact.messagePlaceholder")}
              required
              maxLength={5000}
              rows={5}
              className={`${FOCUS} resize-y`}
            />
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
            disabled={
              submitting ||
              !name.trim() ||
              !email.trim() ||
              !subject.trim() ||
              !message.trim()
            }
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
                <span className="ml-1.5">{t("contact.sending")}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                {t("contact.send")}
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
