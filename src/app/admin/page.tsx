"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { TrafficPanel } from "@/components/admin/traffic-panel"

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
  // True when any sync_runs row is "running" in the DB — possibly a different or
  // dead process. Drives the Stop button so it is never stuck on a zombie row.
  dbRunning?: boolean
  dbRunningSources?: string[]
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
  overview: {
    total_views: number
    views_30d: number
    views_24h: number
    visitors_30d: number
    visitors_24h: number
  }
  dailyTrend: { day: string; views: number; visitors: number }[]
  topReferrers: { referrer: string; views: number }[]
  deviceBreakdown: { device: string; views: number }[]
  countryBreakdown: { country: string; views: number }[]
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

type TabId = "resumen" | "trafico" | "contenido" | "sync" | "editorial" | "config"

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "trafico", label: "Tráfico" },
  { id: "contenido", label: "Contenido" },
  { id: "sync", label: "Sincronización" },
  { id: "editorial", label: "Editorial" },
  { id: "config", label: "Configuración" },
]

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-ink-50">{title}</h2>
      {help && <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-ink-400">{help}</p>}
      {!help && <div className="mb-4" />}
      {children}
    </section>
  )
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.04] ${className}`} />
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-bold text-ink-50">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p>}
    </div>
  )
}

/** Horizontal bar list — a compact, readable ranking. */
function BarList({ items, empty, accent = "bg-brand-500/40" }: { items: { label: string; value: number; note?: string }[]; empty: string; accent?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (items.length === 0) return <p className="text-xs text-ink-500">{empty}</p>
  return (
    <div className="space-y-1">
      {items.map((it, idx) => (
        <div key={`${it.label}-${idx}`} className="flex items-center gap-3 rounded-md border border-white/[0.03] px-3 py-1.5 text-sm">
          <span className="flex-1 truncate text-ink-200" title={it.label}>{it.label}</span>
          {it.note && <span className="text-[11px] text-ink-500">{it.note}</span>}
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.05] sm:block">
            <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }} />
          </div>
          <span className="w-14 text-right font-mono text-xs text-ink-400">{it.value.toLocaleString("es-ES")}</span>
        </div>
      ))}
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
  return d.toLocaleString("es-ES")
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
  const [tab, setTab] = useState<TabId>("resumen")
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

  // While a sync runs (in this process OR anywhere per the DB), poll status +
  // history so the table updates live and the Stop button stays responsive.
  const syncActive = Boolean(syncStatus?.running || syncStatus?.dbRunning)
  useEffect(() => {
    if (!syncActive) return
    const id = setInterval(() => {
      fetchSyncStatus()
      fetchSyncHistory()
    }, 4000)
    return () => clearInterval(id)
  }, [syncActive, fetchSyncStatus, fetchSyncHistory])

  async function saveConfig(key: string, rawValue: string) {
    let parsed: unknown
    try {
      parsed = JSON.parse(rawValue)
    } catch {
      showToast("Valor JSON no válido", "error")
      return
    }
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: parsed }),
    })
    if (res.ok) {
      showToast(`Configuración "${key}" guardada`, "success")
      fetchConfig()
    } else {
      showToast("No se pudo guardar la configuración", "error")
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
            ? "Sincronización iniciada para todas las ligas"
            : `Sincronización iniciada para ${syncSource}`,
          "success",
        )
        await fetchSyncStatus()
        fetchSyncHistory()
      } else {
        const data = await res.json().catch(() => ({}))
        showToast(data.error ?? "No se pudo iniciar la sincronización", "error")
      }
    } finally {
      setSyncBusy(false)
    }
  }

  async function stopSync() {
    setSyncBusy(true)
    try {
      const res = await fetch("/api/admin/sync/stop", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const closed = typeof data.runsClosed === "number" ? data.runsClosed : 0
        showToast(
          closed > 0
            ? `Detenida — se cerraron ${closed} fila(s) en ejecución. La liga en curso termina, las pendientes se omiten.`
            : "Parada solicitada — terminando la liga actual…",
          "success",
        )
        // Refresh immediately so the table + buttons reflect the stop.
        fetchSyncStatus()
        fetchSyncHistory()
      } else {
        showToast(data.error ?? "Nada que detener", "error")
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
      showToast("Aviso creado", "success")
      fetchAnnouncements()
      ;(e.target as HTMLFormElement).reset()
    } else {
      showToast("No se pudo crear el aviso", "error")
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

  async function updateAnnouncement(
    id: string,
    data: { type: string; title: string; content: string; priority: number },
  ): Promise<boolean> {
    const res = await fetch("/api/admin/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        type: data.type,
        title: data.title,
        content: data.content.trim() === "" ? null : data.content,
        priority: data.priority,
      }),
    })
    if (res.ok) {
      showToast("Aviso actualizado", "success")
      fetchAnnouncements()
      return true
    }
    showToast("No se pudo actualizar el aviso", "error")
    return false
  }

  async function deleteAnnouncement(id: string) {
    await fetch(`/api/admin/announcements?id=${id}`, { method: "DELETE" })
    showToast("Aviso eliminado", "success")
    fetchAnnouncements()
  }

  function csvExport(type: string) {
    window.open(`/api/admin/analytics/export?type=${type}`, "_blank")
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const ov = analytics?.overview
  const dbTotal = stats ? Object.values(stats.rowCounts).reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />

      {/* Tab navigation */}
      <div className="sticky top-2 z-20 -mx-1 mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-ink-900/70 p-1 backdrop-blur-md">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-white/[0.08] text-ink-50"
                : "text-ink-400 hover:text-ink-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── RESUMEN ─────────────────────────────────────────────────────── */}
      {tab === "resumen" && (
        <div className="space-y-6">
          <Section
            title="Vista rápida"
            help="Un vistazo al estado general: cuántos datos hay en la base, cuánta gente ha visitado la web y si la sincronización está en marcha. Para el detalle, entra en cada pestaña."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Registros en la BD" value={dbTotal.toLocaleString("es-ES")} hint="filas totales" />
              <StatCard label="Vistas (30 días)" value={(ov?.views_30d ?? 0).toLocaleString("es-ES")} hint="páginas vistas" />
              <StatCard label="Visitantes (30 días)" value={(ov?.visitors_30d ?? 0).toLocaleString("es-ES")} hint="únicos aprox." />
              <StatCard label="Vistas (24 h)" value={(ov?.views_24h ?? 0).toLocaleString("es-ES")} />
              <StatCard label="Visitantes (24 h)" value={(ov?.visitors_24h ?? 0).toLocaleString("es-ES")} hint="únicos aprox." />
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-sm">
              {syncStatus?.running ? (
                <>
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                  </span>
                  <span className="text-amber-200">
                    Sincronización en curso ({syncStatus.trigger ?? "manual"}): {syncStatus.targets.join(", ")}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-positive" />
                  <span className="text-ink-300">Sincronización inactiva — los datos están al día.</span>
                </>
              )}
            </div>
          </Section>

          <Section
            title="Base de datos"
            help="Cuántas filas hay en cada tabla y el desglose por liga (jugadores, equipos, temporadas y filas de estadísticas). Útil para detectar de un vistazo si a una liga le faltan datos."
          >
            {stats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.entries(stats.rowCounts).map(([k, v]) => (
                    <StatCard key={k} label={k.replace(/_/g, " ")} value={v.toLocaleString("es-ES")} />
                  ))}
                </div>
                {stats.leaguesStats.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-ink-400">
                          <th className="pb-2 pr-4 font-medium">Liga</th>
                          <th className="pb-2 pr-4 font-medium">Jugadores</th>
                          <th className="pb-2 pr-4 font-medium">Equipos</th>
                          <th className="pb-2 pr-4 font-medium">Temporadas</th>
                          <th className="pb-2 font-medium">Filas de stats</th>
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
              <p className="text-sm text-ink-400">No se pudieron cargar las estadísticas.</p>
            )}
          </Section>
        </div>
      )}

      {/* ─── TRÁFICO (Cloudflare) ────────────────────────────────────────── */}
      {tab === "trafico" && (
        <Section
          title="Tráfico (Cloudflare)"
          help="Datos reales de tráfico que Cloudflare ve en tu web: peticiones, códigos de estado (200, 404, 403…), ancho de banda, amenazas bloqueadas, visitantes únicos y países. Es lo mismo que verías entrando en el panel de Cloudflare, pero aquí."
        >
          <TrafficPanel />
        </Section>
      )}

      {/* ─── CONTENIDO (analítica propia) ────────────────────────────────── */}
      {tab === "contenido" && (
        <Section
          title="Contenido y comportamiento"
          help="Analítica que registra tu propia web (sin Google Analytics, sin cookies de terceros): qué páginas y ligas se ven más, qué busca la gente, desde dónde llega, con qué dispositivo y cómo crece el registro de usuarios."
        >
          {analytics ? (
            <div className="space-y-8">
              {/* Behaviour KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Vistas totales" value={(analytics.overview?.total_views ?? 0).toLocaleString("es-ES")} hint="desde el inicio" />
                <StatCard label="Vistas (30 días)" value={(analytics.overview?.views_30d ?? 0).toLocaleString("es-ES")} />
                <StatCard label="Visitantes (30 días)" value={(analytics.overview?.visitors_30d ?? 0).toLocaleString("es-ES")} hint="únicos aprox." />
                <StatCard label="Vistas (24 h)" value={(analytics.overview?.views_24h ?? 0).toLocaleString("es-ES")} />
                <StatCard label="Visitantes (24 h)" value={(analytics.overview?.visitors_24h ?? 0).toLocaleString("es-ES")} hint="únicos aprox." />
              </div>

              {/* Daily trend */}
              {analytics.dailyTrend.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">Vistas por día (últimos 30 días)</h3>
                  <DailyTrend data={analytics.dailyTrend} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-500">Exportar a CSV:</span>
                <button type="button" onClick={() => csvExport("page-views")} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50">
                  Páginas vistas
                </button>
                <button type="button" onClick={() => csvExport("searches")} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50">
                  Búsquedas
                </button>
                <button type="button" onClick={() => csvExport("users")} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50">
                  Usuarios
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">Jugadores más vistos</h3>
                  <BarList
                    items={analytics.playersMostViewed.slice(0, 10).map((p) => ({ label: p.name ?? p.slug, value: p.views }))}
                    empty="Aún no hay datos."
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">Equipos más vistos</h3>
                  <BarList
                    items={analytics.teamsMostViewed.slice(0, 10).map((t) => ({ label: t.name ?? t.slug, value: t.views }))}
                    empty="Aún no hay datos."
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">Búsquedas más frecuentes</h3>
                  <BarList
                    items={analytics.topSearches.slice(0, 12).map((s) => ({ label: `"${s.query}"`, value: s.count }))}
                    empty="Aún no hay búsquedas."
                    accent="bg-positive/40"
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">Ligas más vistas</h3>
                  <BarList
                    items={analytics.leagueTrends.map((l) => ({ label: l.name ?? l.slug ?? "—", value: l.views }))}
                    empty="Aún no hay datos."
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">De dónde llegan</h3>
                  <BarList
                    items={analytics.topReferrers.map((r) => ({ label: r.referrer === "direct" ? "Directo / marcador" : r.referrer, value: r.views }))}
                    empty="Aún no hay datos de origen."
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">Dispositivos</h3>
                  <BarList
                    items={analytics.deviceBreakdown.map((d) => ({ label: deviceLabel(d.device), value: d.views }))}
                    empty="Aún no hay datos de dispositivo."
                    accent="bg-brand-500/40"
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink-300">Países (de tu tracking)</h3>
                  <BarList
                    items={analytics.countryBreakdown.map((c) => ({ label: `${countryFlag(c.country)} ${c.country}`, value: c.views }))}
                    empty="Aún no hay datos de país."
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-300">Crecimiento de usuarios (registros por mes)</h3>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
                  {analytics.userGrowth.map((m) => (
                    <div key={m.month} className="rounded-md border border-white/[0.03] px-2 py-1.5 text-center">
                      <p className="text-[10px] text-ink-400">{m.month.slice(5)}</p>
                      <p className="font-mono text-sm font-bold text-ink-50">{m.registrations}</p>
                    </div>
                  ))}
                  {analytics.userGrowth.length === 0 && <p className="text-xs text-ink-500">Aún no hay registros.</p>}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-400">Todavía no hay datos de analítica. Navega por la web para empezar a recogerlos.</p>
          )}
        </Section>
      )}

      {/* ─── SINCRONIZACIÓN ──────────────────────────────────────────────── */}
      {tab === "sync" && (
        <Section
          title="Sincronización de datos"
          help="Aquí lanzas o detienes la importación de datos desde las fuentes (NBA, EuroLeague, ACB, FEB…). Elige una liga o 'Todas', pulsa Ejecutar, y abajo verás el historial con filas escritas y errores. También corre sola por un cron programado."
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <select
              value={syncSource}
              onChange={(e) => setSyncSource(e.target.value)}
              disabled={syncActive || syncBusy}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 disabled:opacity-50"
            >
              {SYNC_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Todas las ligas" : s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={startSync}
              disabled={syncActive || syncBusy}
              className="gh-sheen rounded-lg border border-positive/30 bg-positive/15 px-4 py-1.5 text-sm font-medium text-positive transition hover:bg-positive/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ejecutar
            </button>
            <button
              type="button"
              onClick={stopSync}
              disabled={!syncActive || syncBusy}
              className="rounded-lg border border-ember-500/30 bg-ember-500/15 px-4 py-1.5 text-sm font-medium text-ember-300 transition hover:bg-ember-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Detener
            </button>
            <span className="ml-1 flex items-center gap-2 text-xs text-ink-400">
              {syncStatus?.running ? (
                <>
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                  </span>
                  {syncStatus.cancelRequested
                    ? "Deteniendo tras la liga actual…"
                    : `En ejecución (${syncStatus.trigger ?? "manual"}): ${syncStatus.targets.join(", ")}`}
                </>
              ) : (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-ink-600" />
                  Inactiva
                </>
              )}
            </span>
          </div>
          {syncHistory && syncHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-ink-400">
                    <th className="pb-2 pr-3 font-medium">Fuente</th>
                    <th className="pb-2 pr-3 font-medium">Estado</th>
                    <th className="pb-2 pr-3 font-medium">Filas</th>
                    <th className="pb-2 pr-3 font-medium">Inicio</th>
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
            <p className="text-sm text-ink-400">Sin historial de sincronización.</p>
          )}
          <button type="button" onClick={fetchSyncHistory} className="mt-3 text-xs text-ink-400 transition hover:text-ink-50">
            Actualizar historial
          </button>
        </Section>
      )}

      {/* ─── EDITORIAL ───────────────────────────────────────────────────── */}
      {tab === "editorial" && (
        <Section
          title="Contenido editorial"
          help="Crea avisos que verán los usuarios: banners bajo la barra de navegación, entradas de FAQ o de changelog. Un banner sin descripción aparece como barra; con descripción se abre como ventana centrada. Aparecen en directo (~60s) sin recargar."
        >
          <div className="space-y-6">
            <form onSubmit={createAnnouncement} className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold text-ink-300">Nueva entrada</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <select name="type" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200">
                  <option value="banner">Banner / Aviso</option>
                  <option value="faq">FAQ</option>
                  <option value="changelog">Changelog</option>
                </select>
                <input name="title" placeholder="Título" required className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 placeholder:text-ink-500" />
                <select name="priority" defaultValue={3} title="Mayor prioridad se muestra antes y arriba" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200">
                  <option value={1}>Prioridad 1 — Baja</option>
                  <option value={2}>Prioridad 2 — Normal</option>
                  <option value={3}>Prioridad 3 — Elevada</option>
                  <option value={4}>Prioridad 4 — Alta</option>
                  <option value={5}>Prioridad 5 — Crítica</option>
                </select>
              </div>
              <textarea name="content" rows={2} placeholder="Contenido / descripción (opcional) — si se rellena, el aviso se abre como ventana centrada" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 placeholder:text-ink-500" />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-300">
                  <input name="active" type="checkbox" defaultChecked className="rounded border-white/20 bg-white/[0.04]" />
                  Activo
                </label>
                <button type="submit" className="gh-sheen rounded-lg border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-medium text-ink-200 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-ink-50">
                  Crear
                </button>
              </div>
            </form>

            {announcements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-ink-400">
                      <th className="pb-2 pr-3 font-medium">Tipo</th>
                      <th className="pb-2 pr-3 font-medium">Título</th>
                      <th className="pb-2 pr-3 font-medium">Activo</th>
                      <th className="pb-2 pr-3 font-medium">Prioridad</th>
                      <th className="pb-2 pr-3 font-medium">Creado</th>
                      <th className="pb-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((a) => (
                      <EditableAnnouncementRow
                        key={a.id}
                        a={a}
                        onToggle={toggleAnnouncement}
                        onDelete={deleteAnnouncement}
                        onSave={updateAnnouncement}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-400">Aún no hay entradas editoriales.</p>
            )}
          </div>
        </Section>
      )}

      {/* ─── CONFIGURACIÓN ───────────────────────────────────────────────── */}
      {tab === "config" && (
        <Section
          title="Configuración"
          help="Valores de configuración de la app en formato JSON. Edítalos con cuidado: un valor mal formado se rechaza, y los cambios se aplican en la siguiente carga de página."
        >
          <div className="space-y-4">
            {config.map((row) => (
              <ConfigEditor key={row.key} row={row} onSave={saveConfig} />
            ))}
            {config.length === 0 && <p className="text-sm text-ink-400">No se encontraron valores de configuración.</p>}
          </div>
        </Section>
      )}
    </>
  )
}

function deviceLabel(device: string): string {
  const map: Record<string, string> = {
    mobile: "📱 Móvil",
    tablet: "📱 Tablet",
    desktop: "💻 Escritorio",
  }
  return map[device] ?? device
}

function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️"
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)),
  )
}

function DailyTrend({ data }: { data: { day: string; views: number; visitors: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.views))
  return (
    <div className="flex h-32 items-end gap-1 rounded-lg border border-white/5 bg-white/[0.01] p-3">
      {data.map((d) => {
        const h = Math.max(3, (d.views / max) * 100)
        return (
          <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end">
            <div className="w-full rounded-t bg-brand-500/40 transition group-hover:bg-brand-400/70" style={{ height: `${h}%` }} />
            <span className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-ink-100 shadow group-hover:block">
              {d.day.slice(5)} · {d.views.toLocaleString("es-ES")} vistas · {d.visitors} visit.
            </span>
          </div>
        )
      })}
    </div>
  )
}

function EditableAnnouncementRow({
  a,
  onToggle,
  onDelete,
  onSave,
}: {
  a: AnnouncementRow
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onSave: (id: string, data: { type: string; title: string; content: string; priority: number }) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState(a.type)
  const [title, setTitle] = useState(a.title)
  const [content, setContent] = useState(a.content ?? "")
  const [priority, setPriority] = useState(a.priority)

  function startEditing() {
    setType(a.type)
    setTitle(a.title)
    setContent(a.content ?? "")
    setPriority(a.priority)
    setEditing(true)
  }

  async function handleSave() {
    if (title.trim() === "") return
    setSaving(true)
    const ok = await onSave(a.id, { type, title: title.trim(), content, priority })
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <tr className="border-b border-white/[0.03]">
        <td colSpan={6} className="py-3">
          <div className="space-y-3 rounded-lg border border-brand-500/20 bg-white/[0.02] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200">
                <option value="banner">Banner / Aviso</option>
                <option value="faq">FAQ</option>
                <option value="changelog">Changelog</option>
              </select>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 placeholder:text-ink-500" />
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200">
                <option value={1}>Prioridad 1 — Baja</option>
                <option value={2}>Prioridad 2 — Normal</option>
                <option value={3}>Prioridad 3 — Elevada</option>
                <option value={4}>Prioridad 4 — Alta</option>
                <option value={5}>Prioridad 5 — Crítica</option>
              </select>
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="Contenido / descripción (opcional) — si se rellena, el aviso se abre como ventana centrada" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-ink-200 placeholder:text-ink-500" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""} className="gh-sheen rounded-lg border border-positive/30 bg-positive/15 px-4 py-1.5 text-sm font-medium text-positive transition hover:bg-positive/25 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm font-medium text-ink-300 transition hover:border-white/25 hover:text-ink-50">
                Cancelar
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-white/[0.03] text-ink-200">
      <td className="py-2 pr-3"><AnnouncementBadge type={a.type} /></td>
      <td className="py-2 pr-3 font-medium text-ink-50">{a.title}</td>
      <td className="py-2 pr-3">
        <button
          type="button"
          onClick={() => onToggle(a.id, !a.active)}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${a.active ? "bg-positive/15 text-positive border-positive/30" : "bg-ember-500/15 text-ember-300 border-ember-500/30"}`}
        >
          {a.active ? "ON" : "OFF"}
        </button>
      </td>
      <td className="py-2 pr-3 font-mono">{a.priority}</td>
      <td className="py-2 pr-3 text-xs">{formatDate(a.createdAt)}</td>
      <td className="py-2">
        <div className="flex items-center gap-3">
          <button type="button" onClick={startEditing} className="text-xs text-ink-400 transition hover:text-ink-50">
            Editar
          </button>
          <button type="button" onClick={() => onDelete(a.id)} className="text-xs text-ember-400 transition hover:text-ember-300">
            Eliminar
          </button>
        </div>
      </td>
    </tr>
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
            <button type="button" onClick={() => { setDraft(row.value); setEditing(false) }} className="text-xs text-ink-400 transition hover:text-ink-50">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="text-xs text-positive transition hover:text-positive/80 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-ink-400 transition hover:text-ink-50">
            Editar
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
