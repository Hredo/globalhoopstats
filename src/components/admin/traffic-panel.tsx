"use client"

import { useCallback, useEffect, useState } from "react"
import type { TrafficRange, TrafficResult } from "@/lib/cloudflare/analytics"

const RANGES: { value: TrafficRange; label: string }[] = [
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
]

function fmtInt(n: number): string {
  return n.toLocaleString("es-ES")
}

function fmtBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

/** Country code → flag emoji (ES → 🇪🇸). Falls back to the raw code. */
function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️"
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)),
  )
}

function statusColor(status: number): string {
  if (status >= 500) return "bg-ember-500/15 text-ember-300 border-ember-500/30"
  if (status >= 400) return "bg-amber-500/15 text-amber-300 border-amber-500/30"
  if (status >= 300) return "bg-brand-500/15 text-brand-300 border-brand-500/30"
  return "bg-positive/15 text-positive border-positive/30"
}

function statusLabel(status: number): string {
  const map: Record<number, string> = {
    200: "OK",
    204: "Sin contenido",
    206: "Contenido parcial",
    301: "Movido permanente",
    302: "Redirección temporal",
    304: "No modificado (caché)",
    307: "Redirección temporal",
    308: "Redirección permanente",
    400: "Petición incorrecta",
    401: "No autorizado",
    403: "Prohibido",
    404: "No encontrado",
    429: "Demasiadas peticiones",
    500: "Error del servidor",
    502: "Bad gateway",
    503: "Servicio no disponible",
  }
  return map[status] ?? ""
}

function Kpi({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneCls =
    tone === "good" ? "text-positive"
    : tone === "warn" ? "text-amber-300"
    : tone === "bad" ? "text-ember-300"
    : "text-ink-50"
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={`mt-0.5 font-mono text-xl font-bold ${toneCls}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p>}
    </div>
  )
}

export function TrafficPanel() {
  const [range, setRange] = useState<TrafficRange>("7d")
  const [data, setData] = useState<TrafficResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: TrafficRange) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/traffic?range=${r}`)
      if (res.ok) setData(await res.json())
      else setData({ configured: false, reason: `Error ${res.status} al pedir los datos.` })
    } catch (e) {
      setData({ configured: false, reason: e instanceof Error ? e.message : "Error de red." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch on mount and whenever the range changes. load() toggles the loading
    // flag; that synchronous setState-in-effect is the intended fetch pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(range)
  }, [range, load])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                range === r.value
                  ? "bg-white/[0.08] text-ink-50"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => load(range)}
          className="text-xs text-ink-400 transition hover:text-ink-50"
        >
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="h-40 animate-pulse rounded-lg bg-white/[0.03]" />
      )}

      {!loading && data && !data.configured && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-5">
          <p className="text-sm font-semibold text-amber-200">Cloudflare no está conectado todavía</p>
          <p className="mt-1 text-sm text-ink-300">{data.reason}</p>
          <div className="mt-3 space-y-1.5 text-xs text-ink-400">
            <p className="font-medium text-ink-300">Para activarlo:</p>
            <p>1. Cloudflare → <em>Mi perfil → API Tokens → Crear Token</em> con el permiso <code className="text-brand-300">Analytics → Read</code> sobre la zona globalhoopstats.es.</p>
            <p>2. Copia el <code className="text-brand-300">Zone ID</code> desde la vista general del dominio.</p>
            <p>3. Añádelos al entorno como <code className="text-brand-300">CLOUDFLARE_API_TOKEN</code> y <code className="text-brand-300">CLOUDFLARE_ZONE_ID</code> y vuelve a desplegar.</p>
          </div>
        </div>
      )}

      {!loading && data && data.configured && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Peticiones" value={fmtInt(data.totals.requests)} />
            <Kpi label="Visitantes únicos" value={fmtInt(data.totals.uniques)} hint="aprox." />
            <Kpi label="Páginas vistas" value={fmtInt(data.totals.pageViews)} />
            <Kpi label="Ancho de banda" value={fmtBytes(data.totals.bytes)} />
            <Kpi
              label="% en caché"
              value={fmtPct(data.totals.cacheRatio)}
              tone={data.totals.cacheRatio >= 0.5 ? "good" : "default"}
              hint="servido por Cloudflare"
            />
            <Kpi
              label="Amenazas"
              value={fmtInt(data.totals.threats)}
              tone={data.totals.threats > 0 ? "warn" : "good"}
              hint="bloqueadas"
            />
          </div>

          {/* Requests over time */}
          {data.series.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-300">Peticiones en el tiempo</h3>
              <TrafficBars series={data.series} range={data.range} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status codes */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink-300">Códigos de estado</h3>
                <span className="text-[11px] text-ink-500">{fmtPct(data.totals.errorRatio)} errores (4xx/5xx)</span>
              </div>
              <div className="space-y-1">
                {data.statusCodes.map((s) => {
                  const share = data.totals.requests > 0 ? s.requests / data.totals.requests : 0
                  return (
                    <div key={s.status} className="flex items-center gap-3 rounded-md border border-white/[0.03] px-3 py-1.5">
                      <span className={`inline-flex w-14 justify-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusColor(s.status)}`}>
                        {s.status}
                      </span>
                      <span className="flex-1 truncate text-xs text-ink-400">{statusLabel(s.status)}</span>
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.05] sm:block">
                        <div className="h-full rounded-full bg-ink-400/50" style={{ width: `${Math.max(2, share * 100)}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono text-xs text-ink-200">{fmtInt(s.requests)}</span>
                    </div>
                  )
                })}
                {data.statusCodes.length === 0 && <p className="text-xs text-ink-500">Sin datos en este periodo.</p>}
              </div>
            </div>

            {/* Countries */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-300">Países</h3>
              <div className="space-y-1">
                {data.countries.map((c) => {
                  const share = data.countries[0] ? c.requests / data.countries[0].requests : 0
                  return (
                    <div key={c.country} className="flex items-center gap-3 rounded-md border border-white/[0.03] px-3 py-1.5">
                      <span className="text-base leading-none">{flag(c.country)}</span>
                      <span className="w-8 font-mono text-xs text-ink-300">{c.country}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full bg-brand-500/40" style={{ width: `${Math.max(2, share * 100)}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono text-xs text-ink-200">{fmtInt(c.requests)}</span>
                    </div>
                  )
                })}
                {data.countries.length === 0 && <p className="text-xs text-ink-500">Sin datos en este periodo.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrafficBars({ series, range }: { series: { label: string; requests: number; threats: number }[]; range: TrafficRange }) {
  const max = Math.max(1, ...series.map((p) => p.requests))
  return (
    <div className="flex h-32 items-end gap-1 rounded-lg border border-white/5 bg-white/[0.01] p-3">
      {series.map((p, i) => {
        const h = Math.max(3, (p.requests / max) * 100)
        const label = range === "24h" ? p.label.slice(11, 16) : p.label.slice(5)
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
            <div
              className={`w-full rounded-t ${p.threats > 0 ? "bg-amber-400/50" : "bg-brand-500/40"} transition group-hover:bg-brand-400/70`}
              style={{ height: `${h}%` }}
            />
            <span className="mt-1 hidden text-[9px] text-ink-500 sm:block">{label}</span>
            <span className="pointer-events-none absolute -top-6 z-10 hidden whitespace-nowrap rounded bg-ink-900 px-1.5 py-0.5 text-[10px] text-ink-100 shadow group-hover:block">
              {p.requests.toLocaleString("es-ES")} · {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
