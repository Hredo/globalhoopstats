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
  return content.trim()
}

function formatUserMessage(content: string): string {
  return content.trim()
}

function buildMarkdown(team: TeamContext, messages: ChatMessage[]): string {
  const lines: string[] = []

  // ============== HEADER ==============
  lines.push(`# 🏀 Signing Advisor`)
  lines.push(``)
  lines.push(`*Reporte generado por Global Hoop Stats*`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // ============== TEAM INFO ==============
  lines.push(`## 📋 Información del equipo`)
  lines.push(``)
  lines.push(`| Campo | Valor |`)
  lines.push(`|-------|-------|`)
  lines.push(`| **Equipo** | ${formatTeam(team)} |`)
  lines.push(`| **Generado** | ${new Date().toLocaleString("es-ES", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} |`)
  lines.push(`| **Mensajes** | ${messages.length} |`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // ============== SUMMARY SECTION ==============
  // Collect all recommendations and data from AI messages
  const aiMessages = messages.filter(m => m.type === "ai" && m.data)
  const lastAi = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1].data : null
  const allRecs = messages
    .filter(m => m.type === "ai" && m.data?.recommendations)
    .flatMap(m => m.data!.recommendations)

  if (lastAi) {
    lines.push(`## 🎯 Diagnóstico del equipo`)
    lines.push(``)
    lines.push(`### ${lastAi.intentEmoji ?? ""} ${lastAi.intentLabel}`)
    lines.push(``)
    lines.push(lastAi.analysis.trim())
    lines.push(``)
    lines.push(`> **Carencia detectada:** ${lastAi.gap}`)
    lines.push(``)

    if (lastAi.team.topPlayers.length > 0) {
      lines.push(`**Jugadores actuales:** ${lastAi.team.topPlayers.join(" · ")}`)
      lines.push(``)
    }

    if (lastAi.considerations.length > 0) {
      lines.push(`### ⚠️ Antes de negociar`)
      lines.push(``)
      for (const c of lastAi.considerations) {
        lines.push(`- ${c}`)
      }
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)
  }

  // ============== RECOMMENDED CANDIDATES ==============
  if (allRecs.length > 0) {
    lines.push(`## 👥 Candidatos recomendados`)
    lines.push(``)
    lines.push(`| # | Jugador | Pos. | Liga | Edad | Contrato | Prioridad | Mercado |`)
    lines.push(`|---|---------|------|------|------|----------|-----------|---------|`)
    allRecs.forEach((r, i) => {
      lines.push(
        `| ${i + 1} | **${escapeMd(r.name)}** | ${escapeMd(r.position)} | ${r.league} | ${r.age} | ${escapeMd(r.contractValue)} | ${escapeMd(r.priority)} | ${escapeMd(r.market)} |`,
      )
    })
    lines.push(``)

    // Player detail cards
    for (const [i, r] of allRecs.entries()) {
      lines.push(`### Jugador ${i + 1}: ${r.name}`)
      lines.push(``)
      lines.push(`- **Posición:** ${r.position}`)
      lines.push(`- **Liga:** ${r.league}`)
      lines.push(`- **Edad:** ${r.age} años`)
      lines.push(`- **Contrato estimado:** ${r.contractValue}`)
      lines.push(`- **Prioridad:** ${r.priority}`)
      lines.push(`- **Mercado:** ${r.market}`)
      lines.push(`- **Ajuste:** ${r.fit}`)
      if (r.strengths.length > 0) {
        lines.push(`- **Fortalezas:**`)
        for (const s of r.strengths) {
          lines.push(`  - ${s}`)
        }
      }
      lines.push(``)
    }

    lines.push(`---`)
    lines.push(``)
  }

  // ============== FULL CONVERSATION ==============
  lines.push(`## 💬 Conversación completa`)
  lines.push(``)

  if (messages.length === 0) {
    lines.push(`*No hay mensajes en esta conversación.*`)
    lines.push(``)
  } else {
    messages.forEach((m, i) => {
      const isUser = m.type === "user"
      const emoji = isUser ? "🙋" : "🤖"
      const label = isUser ? "Tú" : "Advisor"

      lines.push(`### ${emoji} ${label} · Mensaje ${i + 1}`)
      lines.push(``)

      const content = m.type === "user"
        ? formatUserMessage(m.content)
        : formatAiMessage(m.content)

      if (content) {
        lines.push(content)
        lines.push(``)
      }
    })
  }

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
