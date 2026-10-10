"use client"

import { useCallback, useEffect, useState } from "react"

type Client = {
  id: string
  name: string
  keyPrefix: string
  dailyQuota: number
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  ownerEmail: string
}

const field =
  "w-full rounded-lg border border-hairline bg-white/[0.03] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500/60 focus:outline-none"

/** Claves de la API pública (/api/v1): emitir, ajustar cuota y revocar. */
export function ApiClientsPanel() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [owner, setOwner] = useState("")
  const [name, setName] = useState("")
  const [quota, setQuota] = useState("1000")
  const [issued, setIssued] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/api-clients", { cache: "no-store" })
    if (r.ok) setClients(((await r.json()) as { clients: Client[] }).clients)
  }, [])

  useEffect(() => {
    void load() // eslint-disable-line react-hooks/set-state-in-effect
  }, [load])

  async function issue(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const r = await fetch("/api/admin/api-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerEmail: owner, name, dailyQuota: Number(quota) }),
    })
    const d = (await r.json()) as { key?: string; error?: string }
    if (!r.ok || !d.key) {
      setError(d.error ?? "No se ha podido emitir la clave.")
      return
    }
    setIssued(d.key)
    setName("")
    await load()
  }

  async function revoke(id: string) {
    if (!window.confirm("¿Revocar esta clave? Dejará de funcionar al momento.")) return
    await fetch(`/api/admin/api-clients?id=${id}`, { method: "DELETE" })
    await load()
  }

  async function changeQuota(id: string, current: number) {
    const v = window.prompt("Nueva cuota diaria", String(current))
    if (!v) return
    await fetch("/api/admin/api-clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, dailyQuota: Number(v) }),
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={issue} className="grid gap-3 sm:grid-cols-[1.2fr_1fr_140px_auto] sm:items-end">
        <label>
          <span className="mb-1 block text-xs text-ink-400">Email del titular (debe tener cuenta)</span>
          <input type="email" required value={owner} onChange={(e) => setOwner(e.target.value)} className={field} />
        </label>
        <label>
          <span className="mb-1 block text-xs text-ink-400">Nombre del cliente</span>
          <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Club, medio, app…" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-ink-400">Cuota diaria</span>
          <input inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value)} className={field} />
        </label>
        <button type="submit" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400">
          Emitir clave
        </button>
      </form>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {issued ? (
        <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-4">
          <p className="text-sm font-semibold text-ink-50">Copia la clave ahora: no se vuelve a mostrar.</p>
          <code className="mt-2 block break-all font-mono text-[13px] text-brand-100">{issued}</code>
          <button type="button" onClick={() => setIssued(null)} className="mt-3 text-xs text-ink-400 hover:text-ink-100">
            Ya la he guardado
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              <th className="pb-2">Cliente</th>
              <th className="pb-2">Titular</th>
              <th className="pb-2">Clave</th>
              <th className="pb-2 text-right">Cuota/día</th>
              <th className="pb-2">Último uso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clients === null ? (
              <tr><td colSpan={6} className="py-6 text-ink-500">Cargando…</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-ink-500">Aún no hay claves emitidas.</td></tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="border-t border-hairline">
                  <td className="py-2.5 text-ink-100">{c.name}</td>
                  <td className="py-2.5 text-ink-300">{c.ownerEmail}</td>
                  <td className="py-2.5 font-mono text-[12px] text-ink-400">{c.keyPrefix}…</td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-ink-200">
                    <button type="button" disabled={!!c.revokedAt} onClick={() => changeQuota(c.id, c.dailyQuota)} className="hover:text-brand-300">
                      {c.dailyQuota.toLocaleString("es-ES")}
                    </button>
                  </td>
                  <td className="py-2.5 text-ink-400">
                    {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString("es-ES") : "nunca"}
                  </td>
                  <td className="py-2.5 text-right">
                    {c.revokedAt ? (
                      <span className="text-xs text-ink-600">Revocada</span>
                    ) : (
                      <button type="button" onClick={() => revoke(c.id)} className="text-xs text-red-300 hover:text-red-200">
                        Revocar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
