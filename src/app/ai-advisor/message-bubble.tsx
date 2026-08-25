"use client"

import { motion } from "framer-motion"
import { MessageActions } from "./message-actions"
import type { Reaction } from "./message-actions"
import { AiMarkdown } from "@/components/ai/markdown"

type Props = {
  type: "user" | "ai"
  content: string
  reaction: Reaction
  onCopy: () => void
  onLike: () => void
  onDislike: () => void
  onRedo: () => void
  canRedo: boolean
  /**
   * False when the caller renders its own action bar below — the advisor puts
   * one under the whole answer, cards included, not under the prose alone.
   */
  showActions?: boolean
}


export function MessageBubble({
  type,
  content,
  reaction,
  onCopy,
  onLike,
  onDislike,
  onRedo,
  canRedo,
  showActions = true,
}: Props) {
  const isUser = type === "user"

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.94, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-ink-950 shadow-lg whitespace-pre-wrap">
          {content}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
      className="flex justify-start"
    >
      <div className="w-full max-w-3xl">
        <div className="rounded-2xl border border-white/[0.06] bg-ink-800/30 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
          <AiMarkdown text={content} />
          {showActions && (
            <MessageActions
              content={content}
              reaction={reaction}
              onCopy={onCopy}
              onLike={onLike}
              onDislike={onDislike}
              onRedo={onRedo}
              canRedo={canRedo}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}
