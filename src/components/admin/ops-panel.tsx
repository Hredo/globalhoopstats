"use client"

import { useCallback, useEffect, useState } from "react"

type ErrorRow = {
  id: string
  kind: string
  route: string | null
  method: string | null
  message: string
  stack: string | null
  count: number
  firstSeenAt: string
  lastSeenAt: string
}
type Backup = {
  ok: boolean
  file: string | null
  bytes: number
  sha256: string | null
  tables: Record<string, number>
  finishedAt: string
  error?: string
} | null

/** Errores de servidor agrupados y estado de la copia de seguridad nocturna. */
export function OpsPanel() {
  const [errors, setErrors] = useState<ErrorRow[] | null>(null)
  const [backup, setBackup] = useState<Backup>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/errors", { cache: "no-store" })
    if (!r.ok) return
    const d = (await r.json()) as { errors: ErrorRow[]; backup: Backup }
    setErrors(d.errors)
    setBackup(d.backup)
  }, [])

  useEffect(() => {
    void load() // eslint-disable-line react-hooks/set-state-in-effect
  }, [load])

  async function resolve(id: string) {
    await fetch(`/api/admin/errors?id=${id}`, { method: "DELETE" })
    setErrors((e) => e?.filter((x) => x.id !== id) ?? e)
  }

  async function backupNow() {
    setRunning(true)
    try {
      await fetch("/api/cron/backup", { method: "POST" })
      await load()
    } finally {
      setRunning(false)
    }
  }

  const rows = backup ? Object.values(backup.tables).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-50">Copia de seguridad</h3>
          <button
            type="button"
            onClick={backupNow}
            disabled={running}
            className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-200 hover:text-ink-50 disabled:opacity-50"
          >
            {running ? "Haciendo copia…" : "Hacer copia ahora"}
          </button>
        </div>
        {backup ? (
          <div className="mt-3 rounded-xl border border-hairline p-4 text-sm">
            <p className={backup.ok ? "font-semibold text-positive" : "font-semibold text-red-300"}>
              {backup.ok ? "Verificada" : "Fallida"} · {new Date(backup.finishedAt).toLocaleString("es-ES")}
            </p>
            {backup.error ? <p className="mt-1 text-red-300">{backup.error}</p> : null}
            <p className="mt-1 text-ink-400">
              {backup.file ?? "—"} · {(backup.bytes / 1e6).toFixed(1)} MB · {rows.toLocaleString("es-ES")} filas ·{" "}
              <span className="font-mono text-[11px]">{backup.sha256?.slice(0, 16)}…</span>
            </p>
            <p className="mt-2 text-xs text-ink-500">
              Se hace sola tras la sincronización nocturna (como mucho una cada 20 h) y se guardan las 14 últimas fuera de
              la carpeta de la app. Restaurar: <code className="font-mono">pnpm db:restore &lt;fichero&gt;</code>.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-500">Aún no hay ninguna copia.</p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ink-50">Errores de servidor</h3>
        {errors === null ? (
          <p className="mt-3 text-sm text-ink-500">Cargando…</p>
        ) : errors.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Sin errores registrados.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-hairline">
            {errors.map((e) => (
              <li key={e.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-mono text-[12px] text-ink-400">
                      {e.kind} · {e.method ?? ""} {e.route ?? ""}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-100">{e.message}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="font-mono tabular-nums text-brand-300">{e.count}×</span>
                    <span className="text-ink-500">{new Date(e.lastSeenAt).toLocaleString("es-ES")}</span>
                    <button type="button" onClick={() => resolve(e.id)} className="text-ink-400 hover:text-positive">
                      Resolver
                    </button>
                  </div>
                </div>
                {open === e.id && e.stack ? (
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-ink-300">
                    {e.stack}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
