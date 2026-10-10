"use client"

import { useState } from "react"
import { StaticFrame } from "@/components/playbook/editor"
import { LineupStats } from "@/components/playbook/lineup-panel"
import type { Play } from "@/lib/playbook/types"
import { cn } from "@/components/ui/cn"

/** Read-only playback of a shared play: one frame at a time, with its note. */
export function SharedPlayViewer({ play, labels }: { play: Play; labels: { frame: string; prev: string; next: string } }) {
  const [i, setI] = useState(0)
  const frame = play.frames[i]
  const slugs = play.elements.flatMap((e) => (e.player?.slug ? [e.player.slug] : []))
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div>
        <div className="overflow-hidden rounded-2xl border border-hairline bg-court-900 [&_svg]:h-auto [&_svg]:w-full">
          <StaticFrame play={play} frameIdx={i} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-200 disabled:opacity-40"
          >
            ← {labels.prev}
          </button>
          <div className="flex items-center gap-1.5" aria-label={labels.frame}>
            {play.frames.map((f, idx) => (
              <button
                key={f.id}
                type="button"
                aria-label={`${labels.frame} ${idx + 1}`}
                aria-current={idx === i}
                onClick={() => setI(idx)}
                className={cn("h-2 rounded-full transition-all", idx === i ? "w-6 bg-brand-500" : "w-2 bg-white/20")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setI((v) => Math.min(play.frames.length - 1, v + 1))}
            disabled={i === play.frames.length - 1}
            className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-200 disabled:opacity-40"
          >
            {labels.next} →
          </button>
        </div>
        {frame?.note ? <p className="mt-3 text-sm leading-relaxed text-ink-200">{frame.note}</p> : null}
      </div>
      {slugs.length ? (
        <div className="gh-card h-fit p-4">
          <LineupStats slugs={slugs} />
        </div>
      ) : null}
    </div>
  )
}
