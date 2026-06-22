"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useT } from "@/lib/i18n/provider"
import type { ChatMessage, TeamContext } from "@/lib/ai/export"
import { exportToMarkdown } from "@/lib/ai/export-markdown"

type Format = "pdf" | "markdown"

type Props = {
  team: TeamContext | null
  messages: ChatMessage[]
  disabled?: boolean
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function FormatIcon({ id }: { id: Format }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
      <text
        x={id === "pdf" ? "8" : "7.5"}
        y="17"
        fontSize="6"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        {id === "pdf" ? "PDF" : "MD"}
      </text>
    </svg>
  )
}

type Option = {
  id: Format
  label: string
  hint: string
  run: (payload: {
    team: TeamContext
    messages: ChatMessage[]
  }) => void | Promise<void>
}

export function DownloadMenu({ team, messages, disabled = false }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<Format | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const isEmpty = messages.length === 0
  const isDisabled = disabled || isEmpty || !team || busy !== null

  const options: Option[] = [
    {
      id: "markdown",
      label: t("aiAdvisor.markdownLabel"),
      hint: t("aiAdvisor.markdownHint"),
      run: ({ team, messages }) => exportToMarkdown({ team, messages }),
    },
    {
      id: "pdf",
      label: t("aiAdvisor.pdfLabel"),
      hint: t("aiAdvisor.pdfHint"),
      // jspdf weighs several MB, so the export module only loads
      // when a download is actually requested.
      run: async ({ team, messages }) => {
        const { exportToPdf } = await import("@/lib/ai/export")
        return exportToPdf({ team, messages })
      },
    },
  ]

  async function handleSelect(opt: Option) {
    if (!team || isEmpty) return
    setBusy(opt.id)
    setOpen(false)
    try {
      await opt.run({ team, messages })
    } catch (err) {
      console.error("Download failed:", err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Download conversation"
        data-tour="export"
        title={
          isEmpty
            ? t("aiAdvisor.startToDownload")
            : t("aiAdvisor.downloadConversation")
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-0 px-3.5 py-2 text-sm font-semibold text-ink-200 transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Spinner /> : <DownloadIcon />}
        <span className="hidden sm:inline">{t("aiAdvisor.download")}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute right-0 top-full z-40 mt-2 w-[min(16rem,calc(100vw-2.5rem))] origin-top-right overflow-hidden rounded-xl border border-hairline bg-surface-1 p-1.5 shadow-2xl shadow-black/50"
          >
            <div className="px-2.5 pb-1.5 pt-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                {t("aiAdvisor.downloadFormat")}
              </p>
            </div>
            <div className="space-y-0.5">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(opt)}
                  disabled={busy !== null}
                  className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition hover:bg-surface-2 disabled:opacity-40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-0 text-ink-300 group-hover:text-brand-300">
                    <FormatIcon id={opt.id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-100 group-hover:text-ink-50">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">
                      {opt.hint}
                    </span>
                  </span>
                  {busy === opt.id && <Spinner />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
