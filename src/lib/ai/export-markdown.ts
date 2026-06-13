import { saveAs } from "file-saver"
import type { ChatMessage, TeamContext } from "./export"

const FILE_BASE = "signing-advisor"

function escapeMd(input: string): string {
  return input.replace(/([|\\])/g, "\\$1")
}

function formatTeam(team: TeamContext): string {
  const league = team.leagueName ? ` (${team.leagueName})` : ""
  return `**${team.name}**${league}`
}

function formatAiMessage(content: string): string {
  const trimmed = content.trim()
  return trimmed
}

function formatUserMessage(content: string): string {
  const trimmed = content.trim()
  return trimmed
}

function buildMarkdown(team: TeamContext, messages: ChatMessage[]): string {
  const lines: string[] = []
  lines.push(`# Signing Advisor`)
  lines.push(``)
  lines.push(`**Team:** ${formatTeam(team)}`)
  lines.push(`**Generated:** ${new Date().toLocaleString("en-US")}`)
  lines.push(`**Messages:** ${messages.length}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Conversation`)
  lines.push(``)

  messages.forEach((m, i) => {
    const label = m.type === "user" ? `🙋 **You**` : `🤖 **Advisor**`
    lines.push(`### ${label} · message ${i + 1}`)
    lines.push(``)
    const content = m.type === "user"
      ? formatUserMessage(m.content)
      : formatAiMessage(m.content)
    if (content) {
      lines.push(content)
      lines.push(``)
    }
    if (m.data?.recommendations?.length) {
      lines.push(`**Candidates:**`)
      lines.push(``)
      lines.push(`| # | Player | Pos. | League | Age | Contract | Priority |`)
      lines.push(`|---|---------|------|------|------|----------|-----------|`)
      m.data.recommendations.forEach((r, j) => {
        lines.push(
          `| ${j + 1} | ${escapeMd(r.name)} | ${escapeMd(r.position)} | ${r.league} | ${r.age} | ${escapeMd(r.contractValue)} | ${escapeMd(r.priority)} |`,
        )
      })
      lines.push(``)
    }
    if (m.data?.considerations?.length) {
      lines.push(`**Considerations:**`)
      m.data.considerations.forEach((c) => {
        lines.push(`- ${c}`)
      })
      lines.push(``)
    }
  })

  return lines.join("\n")
}

export function exportToMarkdown(payload: {
  team: TeamContext
  messages: ChatMessage[]
}): void {
  const md = buildMarkdown(payload.team, payload.messages)
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const safeName = payload.team.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "team"
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  saveAs(blob, `${FILE_BASE}-${safeName}-${date}.md`)
}
