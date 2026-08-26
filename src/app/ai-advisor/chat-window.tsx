"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { MessageBubble } from "./message-bubble"
import type { Reaction } from "./message-actions"

type Msg = {
  id: number
  type: "user" | "ai"
  content: string
  /**
   * "llm" when a model wrote `content`; "error" when no model could be
   * reached and `content` is the notice saying so.
   */
  mode?: "llm" | "error"
}

type Props = {
  messages: Msg[]
  loading: boolean
  reactions: Record<number, Reaction>
  onCopy: (id: number) => void
  onLike: (id: number) => void
  onDislike: (id: number) => void
  onRedo: (id: number) => void
  lastMessageRef?: (el: HTMLDivElement | null) => void
}

export function ChatWindow({
  messages,
  loading,
  reactions,
  onCopy,
  onLike,
  onDislike,
  onRedo,
  lastMessageRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const internalLastRef = useRef<HTMLDivElement | null>(null)
  // Latest-callback ref, updated in an effect (not during render); read only
  // inside the deferred focus timeout below, which runs after effects.
  const focusLast = useRef<((el: HTMLDivElement | null) => void) | undefined>(
    lastMessageRef,
  )
  useEffect(() => {
    focusLast.current = lastMessageRef
  }, [lastMessageRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  // Move focus to the last AI message whenever a new one lands, so screen
  // readers announce the new response.
  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.type !== "ai") return
    const node = internalLastRef.current
    if (!node) return
    // Defer to allow the message to render.
    const t = window.setTimeout(() => {
      node.focus({ preventScroll: false })
      focusLast.current?.(node)
    }, 80)
    return () => window.clearTimeout(t)
  }, [messages])

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          className="text-center max-w-md"
        >
          {/* Animated icon ring */}
          <div className="relative mx-auto mb-6 h-20 w-20">
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/20 to-brand-400/10"
              animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="absolute inset-2 rounded-2xl bg-gradient-to-br from-brand-400/15 to-transparent"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <div className="h-full w-full rounded-2xl border border-brand-400/20" />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20"
              >
                <svg
                  className="h-6 w-6 text-brand-400"
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
              </motion.div>
            </div>
            {/* Orbital dots */}
            <motion.div
              aria-hidden
              className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400/40"
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
            <motion.div
              aria-hidden
              className="absolute right-0 top-1/3 h-1 w-1 -translate-y-1/2 rounded-full bg-brand-300/30"
              animate={{ opacity: [0, 0.6, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1 }}
            />
          </div>

          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-xl font-semibold text-ink-50"
          >
            Scouting Advisor
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-2 text-sm leading-relaxed text-ink-400"
          >
            Select a team above and ask which signings would strengthen the
            roster. The advisor analyses your lineup, detects gaps and
            suggests real players from the market.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="mt-6 flex items-center justify-center gap-3 text-[11px] text-ink-500"
          >
            <motion.span
              whileHover={{ scale: 1.05 }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-[11px] font-bold text-brand-300"
            >
              1
            </motion.span>
            Pick a team
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
              className="text-ink-600"
            >
              →
            </motion.span>
            <motion.span
              whileHover={{ scale: 1.05 }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-mono text-[11px] font-bold text-brand-300"
            >
              2
            </motion.span>
            Ask your question
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
      <div
          ref={containerRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Advisor conversation"
          className="flex-1 overflow-y-auto px-4 py-5 space-y-5 sm:px-6"
        >
      {messages.map((msg, idx) => {
        const isLastAi = msg.type === "ai" && idx === messages.length - 1
        const prev = idx > 0 ? messages[idx - 1] : null
        const canRedo = isLastAi && prev?.type === "user"

        return (
          <div
            key={msg.id}
            ref={isLastAi ? internalLastRef : undefined}
            tabIndex={isLastAi ? -1 : undefined}
            aria-label={isLastAi ? "Latest advisor response" : undefined}
            className="focus:outline-none"
          >
            <MessageBubble
              type={msg.type}
              content={msg.content}
              reaction={reactions[msg.id] ?? null}
              onCopy={() => onCopy(msg.id)}
              onLike={() => onLike(msg.id)}
              onDislike={() => onDislike(msg.id)}
              onRedo={() => onRedo(msg.id)}
              canRedo={canRedo}
            />
          </div>
        )
      })}

      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
          className="flex justify-start"
          role="status"
          aria-live="polite"
        >
          <div className="group relative overflow-hidden rounded-2xl rounded-bl-md border border-brand-500/25 bg-gradient-to-br from-ink-800/70 to-ink-900/70 px-5 py-3.5 backdrop-blur-sm shadow-[0_0_30px_-8px_rgba(251,146,60,0.08)]">
            {/* Sheen line */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(251,146,60,0.06) 45%, rgba(251,146,60,0.1) 50%, rgba(251,146,60,0.06) 55%, transparent 60%)",
                backgroundSize: "200% 100%",
                animation: "sheen 2.5s ease-in-out infinite",
              }}
            />
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden>
                <motion.span
                  className="h-2 w-2 rounded-full bg-brand-400"
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0, ease: "easeInOut" }}
                />
                <motion.span
                  className="h-2 w-2 rounded-full bg-brand-400"
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.2, ease: "easeInOut" }}
                />
                <motion.span
                  className="h-2 w-2 rounded-full bg-brand-400"
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.4, ease: "easeInOut" }}
                />
              </div>
              <motion.span
                className="text-xs text-ink-300"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                Analysing roster and market…
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
