"use client"

import { useId, useState } from "react"
import { FadeIn } from "@/components/animations/fade-in"
import { SectionHeading } from "@/components/ui/section-heading"
import { Eyebrow } from "@/components/ui/eyebrow"
import { useLocale } from "@/lib/i18n/provider"
import { getDictionary } from "@/lib/i18n/dictionaries"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error" }

export function EmailSubscribe() {
  const locale = useLocale()
  const dict = getDictionary(locale)
  const t = (key: string) => {
    const keys = key.split(".")
    let val: unknown = dict
    for (const k of keys) {
      if (val && typeof val === "object" && k in (val as Record<string, unknown>))
        val = (val as Record<string, unknown>)[k]
    }
    return String(val ?? key)
  }
  const id = useId()
  const [email, setEmail] = useState("")
  const [hp, setHp] = useState("")
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const prefix = "home.emailSubscribe"

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.kind === "submitting") return
    setStatus({ kind: "submitting" })
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "landing", hp }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
      }
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error" })
        return
      }
      setStatus({ kind: "ok" })
      setEmail("")
    } catch {
      setStatus({ kind: "error" })
    }
  }

  return (
    <section className="relative hairline-t py-20 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-court-900/30 via-transparent to-surface-0"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="justify-center">
              {t(`${prefix}.eyebrow`)}
            </Eyebrow>
            <h2 className="mt-5 font-display text-3xl font-bold leading-[0.96] tracking-[-0.03em] text-balance sm:text-4xl md:text-[3.25rem]">
              {t(`${prefix}.title`)}
            </h2>
            <p className="mt-4 text-pretty text-base leading-relaxed text-ink-200 sm:text-lg">
              {t(`${prefix}.description`)}
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1} y={16}>
          {status.kind === "ok" ? (
            <div
              className="mx-auto mt-8 max-w-md rounded-xl border border-brand-500/30 bg-brand-500/10 p-5 text-center"
              role="status"
            >
              <p className="font-display text-base font-semibold text-brand-200">
                {t(`${prefix}.success`)}
              </p>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mx-auto mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row"
              noValidate
            >
              <label htmlFor={`${id}-email`} className="sr-only">
                Email
              </label>
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                placeholder={t(`${prefix}.placeholder`)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status.kind === "submitting"}
                className="w-full flex-1 rounded-md border border-white/10 bg-ink-900/80 px-4 py-3 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 sm:text-base"
              />
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
              <button
                type="submit"
                disabled={status.kind === "submitting" || email.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              >
                {status.kind === "submitting" ? "…" : t(`${prefix}.button`)}
              </button>
              {status.kind === "error" ? (
                <p role="alert" className="mt-2 text-center text-xs text-accent-magenta">
                  {t(`${prefix}.error`)}
                </p>
              ) : null}
            </form>
          )}
        </FadeIn>
      </div>
    </section>
  )
}
