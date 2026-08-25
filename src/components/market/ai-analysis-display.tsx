"use client"

import { AiMarkdown } from "@/components/ai/markdown"

/**
 * The AI analyses shown in side panels: trade reports, play breakdowns and
 * player scouting notes.
 *
 * This used to be a second, weaker markdown parser — no ordered lists, no
 * tables, no code, `##` rendered as a bold paragraph, and every line shaped
 * like `**Label** text` promoted into a bulleted label row whether the model
 * meant a list or not. So the same answer looked like one thing in the chat
 * and something else in a panel. It now renders through the shared renderer,
 * one size smaller; the only difference between the two surfaces is the body
 * text scale.
 */
export function AiAnalysisDisplay({ text }: { text: string }) {
  return <AiMarkdown text={text} size="panel" />
}
