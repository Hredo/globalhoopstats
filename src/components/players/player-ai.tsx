"use client"

import { useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useT } from "@/lib/i18n/provider"
import { AiAnalysisDisplay } from "@/components/market/ai-analysis-display"

type Props = {
  slug: string
  name: string
}

export function PlayerAi({ slug, name }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const t = useT()

  const fetchAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/players/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(
          payload?.error ?? t("playerAi.errorStatus", { status: res.status }),
        )
      }
      setAnalysis(
        typeof payload.analysis === "string" ? payload.analysis : null,
      )
      setAiProvider(
        typeof payload.aiProvider === "string" ? payload.aiProvider : null,
      )
      setHasRun(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("playerAi.failed"))
    } finally {
      setLoading(false)
    }
  }, [slug, t])

  return (
    <section id="player-ai" className="rounded-2xl border border-white/5 bg-gradient-to-br from-brand-500/5 via-white/[0.02] to-accent-cyan/5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 ring-1 ring-brand-500/30">
            <svg
              className="h-5 w-5 text-brand-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink-50 sm:text-xl">
                {t("playerAi.title")}
              </h2>
              <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                Beta
              </span>
            </div>
            <p className="text-xs text-ink-300 sm:text-sm">
              {t("playerAi.description")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAnalysis}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-950" />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-950"
                style={{ animationDelay: "120ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-950"
                style={{ animationDelay: "240ms" }}
              />
              <span className="ml-1">{t("playerAi.scouting")}</span>
            </span>
          ) : hasRun ? (
            t("playerAi.rerun")
          ) : (
            t("playerAi.scout")
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </motion.div>
        ) : null}

        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-3"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-white/[0.03]"
                style={{ width: `${70 + i * 10}%` }}
              />
            ))}
          </motion.div>
        ) : null}

        {hasRun && !loading ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-5 space-y-4"
          >
            {analysis ? (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-brand-300">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.8 15.9L9 18.8l-.8-2.9a4.5 4.5 0 00-3.1-3.1L2.3 12l2.8-.8a4.5 4.5 0 003.1-3.1L9 5.3l.8 2.8a4.5 4.5 0 003.1 3.1l2.8.8-2.8.8a4.5 4.5 0 00-3.1 3.1z"
                    />
                  </svg>
                  {name} · {aiProvider ?? t("playerAi.aiFallback")}
                </p>
                <div className="rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/[0.07] to-transparent px-4 py-3.5">
                  <AiAnalysisDisplay text={analysis} />
                </div>
              </div>
            ) : (
              <AiNudge />
            )}
          </motion.div>
        ) : null}

        {!hasRun && !loading && !error ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-sm text-ink-400"
          >
            {t("playerAi.hintPre")}{" "}
            <span className="text-brand-300">{t("playerAi.scout")}</span>{" "}
            {t("playerAi.hintPost")}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function AiNudge() {
  const t = useT()
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z"
        />
      </svg>
      <p className="text-[13px] leading-relaxed text-amber-100/90">
        {t("playerAi.nudgeText")}{" "}
        <Link
          href="/account/ai-keys"
          className="font-semibold underline underline-offset-2"
        >
          {t("playerAi.addProvider")}
        </Link>{" "}
        ·{" "}
        <Link
          href="/ai-setup"
          className="font-semibold underline underline-offset-2"
        >
          {t("playerAi.seeGuide")}
        </Link>
      </p>
    </div>
  )
}
