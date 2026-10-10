import { authed, isUuid, notFound } from "@/lib/workspace/http"
import { shortlistAccess, shortlistDetail } from "@/lib/workspace/shortlists"
import { csvResponse } from "@/lib/workspace/export"
import { csvRow, UTF8_BOM } from "@/lib/security/csv"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** GET ?excel=1 → the shortlist as CSV (status, note and current line). */
export async function GET(request: Request, { params }: Ctx) {
  const a = await authed(request, "export", 6, 0.05)
  if ("response" in a) return a.response
  const { id } = await params
  if (!isUuid(id) || !(await shortlistAccess(a.user.id, id))) return notFound()
  const detail = await shortlistDetail(id)
  if (!detail) return notFound()
  const sep = new URL(request.url).searchParams.get("excel") === "1" ? ";" : ","
  const dec = (v: number | null) => (v == null ? null : sep === ";" ? String(v).replace(".", ",") : String(v))
  let out =
    UTF8_BOM +
    csvRow(
      ["player", "slug", "status", "note", "position", "nationality", "height_cm", "league", "team", "season", "gp", "pts", "reb", "ast", "per", "added_by"],
      sep,
    )
  for (const i of detail.items) {
    out += csvRow(
      [
        i.player.fullName, i.player.slug, i.status, i.note, i.player.position, i.player.nationality,
        i.player.heightCm, i.line?.league, i.line?.team, i.line?.season, i.line?.gamesPlayed,
        dec(i.line?.ppg ?? null), dec(i.line?.rpg ?? null), dec(i.line?.apg ?? null), dec(i.line?.per ?? null),
        i.addedBy,
      ],
      sep,
    )
  }
  return csvResponse(out, `shortlist-${detail.name}.csv`)
}
