"use client"

import { useState } from "react"
import Link from "next/link"
import { AiAnalysisDisplay } from "@/components/market/ai-analysis-display"
import { useT } from "@/lib/i18n/provider"
import type { Play } from "@/lib/playbook/types"

/**
 * Deep tactical breakdown of the current play using the user's configured AI
 * engine (same per-user engine model as the advisor / compare features).
 */
export function AiPanel({ play }: { play: Play }) {
  const t = useT()
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [needsSetup, setNeedsSetup] = useState(false)

  const run = async () => {
    setLoading(true)
    setError("")
    setNeedsSetup(false)
    try {
      const res = await fetch("/api/playbooks/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ play, question: question || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t("playbook.ai.error"))
        return
      }
      if (!data.aiConfigured) {
        setNeedsSetup(true)
        return
      }
      setAnalysis(data.analysis)
    } catch {
      setError(t("playbook.ai.networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-ink-400">
        {t("playbook.ai.hint")}
      </p>
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t("playbook.ai.questionPlaceholder")}
        maxLength={500}
        className="gh-input w-full text-sm"
      />
      <button
        type="button"
        onClick={run}
        disabled={loading || play.frames.length < 2}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-brand-500/40 bg-brand-600 px-4 py-2.5 text-sm font-bold text-[#fff] shadow-lg shadow-brand-900/30 transition hover:bg-brand-500 disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        {loading ? t("playbook.ai.loading") : t("playbook.ai.analyze")}
        <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-300">
          Beta
        </span>
      </button>
      {play.frames.length < 2 ? (
        <p className="text-[11px] text-ink-500">{t("playbook.ai.needFrames")}</p>
      ) : null}

      {needsSetup ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-300">
          {t("playbook.ai.notConfigured")}{" "}
          <Link href="/ai-setup" className="font-semibold underline underline-offset-2">
            {t("playbook.ai.configure")}
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {analysis ? (
        <div className="rounded-xl border border-brand-500/30 bg-surface-0 p-4">
          <AiAnalysisDisplay text={analysis} />
        </div>
      ) : null}
    </div>
  )
}
