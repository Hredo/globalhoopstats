import { sql } from "drizzle-orm"
import { getDb } from "@/lib/db/client"

type Announcement = {
  id: string
  type: string
  title: string
  content: string | null
  priority: number
}

const TYPE_STYLES: Record<string, string> = {
  info: "bg-brand-500/10 border-brand-500/30 text-brand-300",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  error: "bg-ember-500/10 border-ember-500/30 text-ember-300",
  maintenance: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  changelog: "bg-positive/10 border-positive/30 text-positive",
  faq: "bg-white/[0.04] border-white/10 text-ink-300",
}

async function getActiveBanners(): Promise<Announcement[]> {
  const db = getDb()
  const now = new Date().toISOString()
  const rows = await db.execute(
    sql.raw(`
      SELECT id, type, title, content, priority
      FROM announcements
      WHERE active = true
        AND type = 'banner'
        AND (starts_at IS NULL OR starts_at <= '${now}'::timestamp)
        AND (expires_at IS NULL OR expires_at > '${now}'::timestamp)
      ORDER BY priority DESC, created_at DESC
      LIMIT 3
    `),
  )
  return rows as unknown as Announcement[]
}

export async function AnnouncementBanner() {
  const banners = await getActiveBanners()
  if (banners.length === 0) return null

  return (
    <>
      {banners.map((b) => (
        <div
          key={b.id}
          className={`border-b px-4 py-2 text-center text-sm font-medium ${TYPE_STYLES[b.type] ?? TYPE_STYLES.info}`}
        >
          {b.title}
          {b.content && <span className="ml-2 opacity-80">{b.content}</span>}
        </div>
      ))}
    </>
  )
}
