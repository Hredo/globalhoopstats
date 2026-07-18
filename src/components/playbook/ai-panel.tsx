"use client"

import { useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/provider"
import type { Play } from "@/lib/playbook/types"

export function AiPanel({
  play,
  onAnalysis,
  disabled,
}: {
  play: Play
  onAnalysis: (text: string) => void
  disabled: boolean
}) {
  const t = useT()
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
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
      onAnalysis(data.analysis)
    } catch {
      setError(t("playbook.ai.networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-ink-300">
        {t("playbook.ai.hint")}
      </p>
      <div className="relative">
        <svg aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("playbook.ai.questionPlaceholder")}
          maxLength={500}
          className="gh-input w-full rounded-lg py-2 pl-9 pr-3 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={run}
        disabled={loading || disabled || play.frames.length < 2}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-ink-950 transition hover:bg-brand-400 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand-500"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-950 border-t-transparent" />
            {t("playbook.ai.loading")}
          </span>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2a4 4 0 014 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 014-4z" /><path d="M12 17v3" /><path d="M8 21h8" /></svg>
            {t("playbook.ai.analyze")}
            <span className="rounded border border-amber-400/40 bg-amber-400/15 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-200">
              Beta
            </span>
          </>
        )}
      </button>
      {play.frames.length < 2 ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-ink-500/10 px-3 py-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-400"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
          <p className="text-[11px] text-ink-300">{t("playbook.ai.needFrames")}</p>
        </div>
      ) : null}
      {needsSetup ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
            {t("playbook.ai.notConfigured")}
          </span>
          <Link href="/ai-setup" className="mt-1 inline-block font-semibold underline underline-offset-2">
            {t("playbook.ai.configure")}
          </Link>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  )
}
