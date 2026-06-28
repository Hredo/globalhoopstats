"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const SYNC_SOURCES = [
  "all",
  "nba",
  "euroleague",
  "acb",
  "leb-oro",
  "leb-plata",
  "eba",
] as const

type SyncStatus = {
  running: boolean
  targets: string[]
  startedAt: string | null
  cancelRequested: boolean
  trigger: "admin" | "cron" | null
}

type RowCounts = Record<string, number>

type LeagueStat = {
  slug: string
  name: string
  players: number
  teams: number
  seasons: number
  stat_rows: number
}

type SyncRecord = {
  id: number
  source: string
  status: string
  rowsWritten: number
  startedAt: string
  finishedAt: string | null
  error: string | null
}

type Analytics = {
  playersMostViewed: { slug: string; name: string | null; views: number }[]
  teamsMostViewed: { slug: string; name: string | null; views: number }[]
  topSearches: { query: string; count: number }[]
  userGrowth: { month: string; registrations: number }[]
  leagueTrends: { slug: string | null; name: string | null; views: number }[]
}

type AnnouncementRow = {
  id: string
  type: string
  title: string
  content: string | null
  active: boolean
  priority: number
  startsAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

type ConfigRow = {
  key: string
  value: string
  description: string | null
}

type Toast = { message: string; type: "success" | "error" } | null

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h2 className="mb-4 font-display text-lg font-bold text-ink-50">{title}</h2>
      {children}
    </section>
  )
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.04] ${className}`} />
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-bold text-ink-50">{value}</p>
    </div>
  )
}

function Badge({ variant }: { variant: string }) {
  const styles: Record<string, string> = {
    ok: "bg-positive/15 text-positive border-positive/30",
    failed: "bg-ember-500/15 text-ember-300 border-ember-500/30",
    running: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  }
  const s = styles[variant] ?? styles.failed
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s}`}>
      {variant}
    </span>
  )
}

function AnnouncementBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    banner: "bg-brand-500/15 text-brand-300 border-brand-500/30",
    faq: "bg-white/[0.08] text-ink-300 border-white/20",
    changelog: "bg-positive/15 text-positive border-positive/30",
  }
  const s = styles[type] ?? styles.banner
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s}`}>
      {type}
    </span>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString()
}

function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null
  const bg = toast.type === "success" ? "bg-positive/20 border-positive/40 text-positive" : "bg-ember-500/20 border-ember-500/40 text-ember-300"
  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-xl backdrop-blur-md ${bg}`}>
      {toast.message}
    </div>
  )
}

export default function AdminPage() {
  const [stats, setStats] = useState<{ rowCounts: RowCounts; leaguesStats: LeagueStat[] } | null>(null)
  const [syncHistory, setSyncHistory] = useState<SyncRecord[] | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncSource, setSyncSource] = useState<string>("all")
  const [syncBusy, setSyncBusy] = useState(false)

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type })
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats({ rowCounts: data.rowCounts, leaguesStats: data.leaguesStats })
      }
    } catch { /* ignore */ }
  }, [])

  const fetchSyncHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync")
      if (res.ok) setSyncHistory(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/status")
      if (res.ok) setSyncStatus(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics")
      if (res.ok) setAnalytics(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/announcements")
      if (res.ok) setAnnouncements(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config")
      if (res.ok) setConfig(await res.json())
    } catch { /* ignore */ }
  }, [])

  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    Promise.all([
      fetchStats(),
      fetchSyncHistory(),
      fetchSyncStatus(),
      fetchAnalytics(),
      fetchAnnouncements(),
      fetchConfig(),
    ]).finally(() => setLoading(false))
  }, [fetchStats, fetchSyncHistory, fetchSyncStatus, fetchAnalytics, fetchAnnouncements, fetchConfig])

  // While a sync runs, poll status + history so the table updates live.
  useEffect(() => {
    if (!syncStatus?.running) return
    const id = setInterval(() => {
      fetchSyncStatus()
      fetchSyncHistory()
    }, 4000)
    return () => clearInterval(id)
  }, [syncStatus?.running, fetchSyncStatus, fetchSyncHistory])

  async function saveConfig(key: string, rawValue: string) {
    let parsed: unknown
    try {
      parsed = JSON.parse(rawValue)
    } catch {
      showToast("Invalid JSON value", "error")
      return
    }
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: parsed }),
    })
    if (res.ok) {
      showToast(`Config "${key}" saved`, "success")
      fetchConfig()
    } else {
      showToast("Failed to save config", "error")
    }
  }

  async function startSync() {
    setSyncBusy(true)
    try {
      const res = await fetch("/api/admin/sync/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: syncSource }),
      })
      if (res.ok) {
        showToast(
          syncSource === "all"
            ? "Sync started for all leagues"
            : `Sync started for ${syncSource}`,
          "success",
        )
        await fetchSyncStatus()
        fetchSyncHistory()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error ?? "Failed to start sync", "error")
      }
    } finally {
      setSyncBusy(false)
    }
  }

  async function stopSync() {
    setSyncBusy(true)
    try {
      const res = await fetch("/api/admin/sync/stop", { method: "POST" })
      if (res.ok) {
        showToast("Stop requested — finishing the current league…", "success")
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error ?? "Nothing to stop", "error")
      }
      await fetchSyncStatus()
    } finally {
      setSyncBusy(false)
    }
  }

  async function createAnnouncement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body = {
      type: form.get("type") as string,
      title: form.get("title") as string,
      content: (form.get("content") as string) || undefined,
      active: form.get("active") === "on",
      priority: parseInt(form.get("priority") as string) || 3,
    }
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      showToast("Announcement created", "success")
      fetchAnnouncements()
      ;(e.target as HTMLFormElement).reset()
    } else {
      showToast("Failed to create announcement", "error")
    }
  }

  async function toggleAnnouncement(id: string, active: boolean) {
    await fetch("/api/admin/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    })
    fetchAnnouncements()
  }

  async function deleteAnnouncement(id: string) {
    await fetch(`/api/admin/announcements?id=${id}`, { method: "DELETE" })
    showToast("Announcement deleted", "success")
    fetchAnnouncements()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  function csvExport(type: string) {
    window.open(`/api/admin/analytics/export?type=${type}`, "_blank")
  }

  return (
    <>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />

      {/* Database Overview */}
      <Section title="Database Overview" id="stats">
        {stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(stats.rowCounts).map(([k, v]) => (
                <StatCard key={k} label={k.replace(/_/g, " ")} value={v.toLocaleString()} />
              ))}
            </div>
            {stats.leaguesStats.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-ink-400">
                      <th className="pb-2 pr-4 font-medium">League</th>
                      <th className="pb-2 pr-4 font-medium">Players</th>
                      <th className="pb-2 pr-4 font-medium">Teams</th>
                      <th className="pb-2 pr-4 font-medium">Seasons</th>
                      <th className="pb-2 font-medium">Stat Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.leaguesStats.map((l) => (
                      <tr key={l.slug} className="border-b border-white/[0.03] text-ink-200">
                        <td className="py-2 pr-4 font-medium text-ink-50">{l.name}</td>
                        <td className="py-2 pr-4 font-mono">{l.players}</td>
                        <td className="py-2 pr-4 font-mono">{l.teams}</td>
                        <td className="py-2 pr-4 font-mono">{l.seasons}</td>
                        <td className="py-2 font-mono">{l.stat_rows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-400">Failed to load stats.</p>
        )}
      </Section>

      {/* Content Analytics */}
      <Section title="Content Analytics" id="analytics">
        {analytics ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => csvExport("page-views")} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50">
                Export page views (CSV)
              </button>
              <button type="button" onClick={() => csvExport("searches")} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50">
                Export searches (CSV)
              </button>
              <button type="button" onClick={() => csvExport("users")} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50">
                Export users (CSV)
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-300">Most Viewed Players</h3>
                <div className="space-y-1">
                  {analytics.playersMostViewed.slice(0, 10).map((p) => (
                    <div key={p.slug} className="flex items-center justify-between rounded-md border border-white/[0.03] px-3 py-1.5 text-sm">
                      <span className="text-ink-200">{p.name ?? p.slug}</span>
                      <span className="font-mono text-xs text-ink-400">{p.views} views</span>
                    </div>
                  ))}
                  {analytics.playersMostViewed.length === 0 && <p className="text-xs text-ink-500">No data yet.</p>}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-300">Most Viewed Teams</h3>
                <div className="space-y-1">
                  {analytics.teamsMostViewed.slice(0, 10).map((t) => (
                    <div key={t.slug} className="flex items-center justify-between rounded-md border border-white/[0.03] px-3 py-1.5 text-sm">
                      <span className="text-ink-200">{t.name ?? t.slug}</span>
                      <span className="font-mono text-xs text-ink-400">{t.views} views</span>
                    </div>
                  ))}
                  {analytics.teamsMostViewed.length === 0 && <p className="text-xs text-ink-500">No data yet.</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-300">Top Searches</h3>
                <div className="space-y-1">
                  {analytics.topSearches.slice(0, 15).map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-white/[0.03] px-3 py-1.5 text-sm">
                      <span className="text-ink-200">&quot;{s.query}&quot;</span>
                      <span className="font-mono text-xs text-ink-400">{s.count}</span>
                    </div>
                  ))}
                  {analytics.topSearches.length === 0 && <p className="text-xs text-ink-500">No searches yet.</p>}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-300">League Trends</h3>
                <div className="space-y-1">
                  {analytics.leagueTrends.map((l) => (
                    <div key={l.slug ?? "unknown"} className="flex items-center justify-between rounded-md border border-white/[0.03] px-3 py-1.5 text-sm">
                      <span className="text-ink-200">{l.name ?? l.slug}</span>
                      <span className="font-mono text-xs text-ink-400">{l.views} views</span>
                    </div>
                  ))}
                  {analytics.leagueTrends.length === 0 && <p className="text-xs text-ink-500">No data yet.</p>}
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-300">User Growth</h3>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
                {analytics.userGrowth.map((m) => (
                  <div key={m.month} className="rounded-md border border-white/[0.03] px-2 py-1.5 text-center">
                    <p className="text-[10px] text-ink-400">{m.month.slice(5)}</p>
                    <p className="font-mono text-sm font-bold text-ink-50">{m.registrations}</p>
                  </div>
                ))}
                {analytics.userGrowth.length === 0 && <p className="text-xs text-ink-500">No registrations yet.</p>}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-400">No analytics data yet. Start browsing the site to collect data.</p>
        )}
      </Section>

      {/* Announcements / Editorial */}
      <Section title="Editorial Content" id="editorial">
        <div className="space-y-6">
          <form onSubmit={createAnnouncement} className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-ink-300">New Entry</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <select name="type" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200">
                <option value="banner">Banner / Notice</option>
                <option value="faq">FAQ</option>
                <option value="changelog">Changelog</option>
              </select>
              <input name="title" placeholder="Title" required className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 placeholder:text-ink-500" />
              <select name="priority" defaultValue={3} title="Higher priority shows first and on top" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200">
                <option value={1}>Priority 1 — Low</option>
                <option value={2}>Priority 2 — Normal</option>
                <option value={3}>Priority 3 — Elevated</option>
                <option value={4}>Priority 4 — High</option>
                <option value={5}>Priority 5 — Critical</option>
              </select>
            </div>
            <textarea name="content" rows={2} placeholder="Content / description (optional) — if filled, the notice opens as a centered modal" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 placeholder:text-ink-500" />
            <p className="text-[11px] leading-relaxed text-ink-500">
              For <strong>Banner / Notice</strong> entries: with no content it shows as a dismissible top banner below the navbar; with a description it opens as a centered modal. Notices appear live (within ~60s) without a page refresh and stay dismissed once closed.
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input name="active" type="checkbox" defaultChecked className="rounded border-white/20 bg-white/[0.04]" />
                Active
              </label>
              <button type="submit" className="gh-sheen rounded-lg border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-medium text-ink-200 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-ink-50">
                Create
              </button>
            </div>
          </form>

          {announcements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-ink-400">
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Title</th>
                    <th className="pb-2 pr-3 font-medium">Active</th>
                    <th className="pb-2 pr-3 font-medium">Priority</th>
                    <th className="pb-2 pr-3 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => (
                    <tr key={a.id} className="border-b border-white/[0.03] text-ink-200">
                      <td className="py-2 pr-3"><AnnouncementBadge type={a.type} /></td>
                      <td className="py-2 pr-3 font-medium text-ink-50">{a.title}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => toggleAnnouncement(a.id, !a.active)}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${a.active ? "bg-positive/15 text-positive border-positive/30" : "bg-ember-500/15 text-ember-300 border-ember-500/30"}`}
                        >
                          {a.active ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td className="py-2 pr-3 font-mono">{a.priority}</td>
                      <td className="py-2 pr-3 text-xs">{formatDate(a.createdAt)}</td>
                      <td className="py-2">
                        <button type="button" onClick={() => deleteAnnouncement(a.id)} className="text-xs text-ember-400 hover:text-ember-300 transition">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-400">No editorial entries yet.</p>
          )}
        </div>
      </Section>

      {/* Configuration */}
      <Section title="Configuration" id="config">
        <p className="mb-4 text-xs text-ink-500">
          Edit app configuration values as JSON. Changes take effect on next page load.
        </p>
        <div className="space-y-4">
          {config.map((row) => (
            <ConfigEditor
              key={row.key}
              row={row}
              onSave={saveConfig}
            />
          ))}
          {config.length === 0 && <p className="text-sm text-ink-400">No config entries found.</p>}
        </div>
      </Section>

      {/* Sync History + manual controls */}
      <Section title="Sync History" id="sync">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <select
            value={syncSource}
            onChange={(e) => setSyncSource(e.target.value)}
            disabled={syncStatus?.running || syncBusy}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 disabled:opacity-50"
          >
            {SYNC_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All leagues" : s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startSync}
            disabled={syncStatus?.running || syncBusy}
            className="gh-sheen rounded-lg border border-positive/30 bg-positive/15 px-4 py-1.5 text-sm font-medium text-positive transition hover:bg-positive/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run sync
          </button>
          <button
            type="button"
            onClick={stopSync}
            disabled={!syncStatus?.running || syncStatus?.cancelRequested || syncBusy}
            className="rounded-lg border border-ember-500/30 bg-ember-500/15 px-4 py-1.5 text-sm font-medium text-ember-300 transition hover:bg-ember-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Stop
          </button>
          <span className="ml-1 flex items-center gap-2 text-xs text-ink-400">
            {syncStatus?.running ? (
              <>
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                </span>
                {syncStatus.cancelRequested
                  ? "Stopping after current league…"
                  : `Running (${syncStatus.trigger ?? "manual"}): ${syncStatus.targets.join(", ")}`}
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-ink-600" />
                Idle
              </>
            )}
          </span>
        </div>
        {syncHistory && syncHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-ink-400">
                  <th className="pb-2 pr-3 font-medium">Source</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Rows</th>
                  <th className="pb-2 pr-3 font-medium">Started</th>
                  <th className="pb-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.03] text-ink-200">
                    <td className="py-1.5 pr-3 font-medium text-ink-50">{r.source}</td>
                    <td className="py-1.5 pr-3"><Badge variant={r.status} /></td>
                    <td className="py-1.5 pr-3 font-mono">{r.rowsWritten}</td>
                    <td className="py-1.5 pr-3 text-xs">{formatDate(r.startedAt)}</td>
                    <td className="max-w-[200px] truncate py-1.5 text-xs text-ember-400">{r.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-400">No sync history.</p>
        )}
        <button type="button" onClick={fetchSyncHistory} className="mt-3 text-xs text-ink-400 hover:text-ink-50 transition">
          Refresh history
        </button>
      </Section>
    </>
  )
}

function ConfigEditor({ row, onSave }: { row: ConfigRow; onSave: (key: string, value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.value)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(row.key, draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-1 flex items-center justify-between">
        <code className="text-sm font-semibold text-brand-300">{row.key}</code>
        {editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setDraft(row.value); setEditing(false) }} className="text-xs text-ink-400 hover:text-ink-50 transition">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="text-xs text-positive hover:text-positive/80 transition disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-ink-400 hover:text-ink-50 transition">
            Edit
          </button>
        )}
      </div>
      {row.description && <p className="mb-2 text-xs text-ink-500">{row.description}</p>}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-ink-200"
        />
      ) : (
        <pre className="overflow-x-auto rounded bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-ink-300">{row.value}</pre>
      )}
    </div>
  )
}
