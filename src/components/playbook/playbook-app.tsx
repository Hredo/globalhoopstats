"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { saveAs } from "file-saver"
import { Eyebrow } from "@/components/ui/eyebrow"
import { cn } from "@/components/ui/cn"
import { useT } from "@/lib/i18n/provider"
import {
  COURT_WIDTH_M,
  createEmptyPlay,
  createSamplePlay,
  newId,
  parsePlay,
  parsePlaybookFile,
  type Play,
  type PlaybookFile,
} from "@/lib/playbook/types"
import { SCALE, courtLength } from "@/lib/playbook/geometry"
import { PlayEditor } from "@/components/playbook/editor"
import { usePlayState } from "@/components/playbook/play-state"
import { RosterPanel } from "@/components/playbook/roster-panel"
import { AiPanel } from "@/components/playbook/ai-panel"

const LOCAL_KEY = "ghs-playbook-v1"

type LibraryEntry = {
  /** Server row id for cloud plays, the play id for local ones. */
  key: string
  rowId: string | null
  play: Play
}

type StorageMode = "loading" | "cloud" | "local"

function readLocal(): Play[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { plays?: unknown[] }
    return (parsed.plays ?? [])
      .map((p) => parsePlay(p))
      .filter((p): p is Play => !!p)
  } catch {
    return []
  }
}

function writeLocal(plays: Play[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ plays }))
  } catch {
    // Storage full / private mode - export still works.
  }
}

/** A fresh play with the standard 5-out alignment so nobody starts from zero. */
function createDefaultPlay(name: string): Play {
  const play = createEmptyPlay(name)
  const spots = [
    { x: 7.5, y: 11.8 },
    { x: 2.4, y: 9.6 },
    { x: 12.6, y: 9.6 },
    { x: 1.2, y: 1.6 },
    { x: 13.8, y: 1.6 },
  ]
  const frame = play.frames[0]
  spots.forEach((at, i) => {
    const id = newId()
    play.elements.push({ id, kind: "attacker", label: String(i + 1) })
    frame.positions[id] = at
  })
  const ballId = newId()
  play.elements.push({ id: ballId, kind: "ball", label: "" })
  frame.positions[ballId] = { x: 7.92, y: 11.7 }
  return play
}

export function PlaybookApp() {
  const t = useT()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [mode, setMode] = useState<StorageMode>("loading")
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [tab, setTab] = useState<"roster" | "ai" | "details">("roster")

  const { state, dispatch } = usePlayState(useMemo(() => createSamplePlay(), []))
  // The `dirty` counter value at the moment of the last successful save;
  // anything newer means there are unsaved edits.
  const [savedDirty, setSavedDirty] = useState(0)
  const unsaved = state.dirty !== savedDirty

  const openPlay = useCallback(
    (entry: LibraryEntry) => {
      dispatch({ type: "replace-play", play: entry.play })
      setCurrentKey(entry.key)
      setSavedDirty(0)
    },
    [dispatch],
  )

  // Load the library: cloud when logged in (the API 401s for guests, then we
  // fall back to localStorage).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/playbooks", { cache: "no-store" })
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as {
            plays: { id: string; data: unknown }[]
          }
          const entries: LibraryEntry[] = data.plays.flatMap((row) => {
            const play = parsePlay(row.data)
            return play ? [{ key: row.id, rowId: row.id, play }] : []
          })
          setMode("cloud")
          setLibrary(entries)
          if (entries[0]) openPlay(entries[0])
          return
        }
      } catch {
        // network error: fall through to local mode
      }
      if (cancelled) return
      const plays = readLocal()
      setMode("local")
      setLibrary(plays.map((p) => ({ key: p.id, rowId: null, play: p })))
      if (plays[0]) {
        openPlay({ key: plays[0].id, rowId: null, play: plays[0] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openPlay])

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!unsaved) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [unsaved])

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(""), 2600)
  }

  // ---- Save / library ops --------------------------------------------------

  const save = async () => {
    const play = state.play
    if (mode === "local") {
      const rest = library.filter((e) => e.key !== currentKey)
      const entry: LibraryEntry = { key: play.id, rowId: null, play }
      const next = [entry, ...rest]
      setLibrary(next)
      setCurrentKey(play.id)
      writeLocal(next.map((e) => e.play))
      setSavedDirty(state.dirty)
      flash(t("playbook.library.savedLocal"))
      return
    }
    if (mode !== "cloud") return
    setSaving(true)
    try {
      const existing = library.find((e) => e.key === currentKey)
      const res = existing?.rowId
        ? await fetch(`/api/playbooks/${existing.rowId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ play }),
          })
        : await fetch("/api/playbooks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ play }),
          })
      const data = await res.json()
      if (!res.ok) {
        flash(data.error ?? t("playbook.library.saveError"))
        return
      }
      const rowId: string = data.id
      const entry: LibraryEntry = { key: rowId, rowId, play }
      setLibrary((lib) => [
        entry,
        ...lib.filter((e) => e.key !== currentKey && e.key !== rowId),
      ])
      setCurrentKey(rowId)
      setSavedDirty(state.dirty)
      flash(t("playbook.library.savedCloud"))
    } catch {
      flash(t("playbook.library.saveError"))
    } finally {
      setSaving(false)
    }
  }

  const confirmDiscard = (): boolean =>
    !unsaved || window.confirm(t("playbook.library.discardConfirm"))

  const newPlay = () => {
    if (!confirmDiscard()) return
    const play = createDefaultPlay(t("playbook.library.untitled"))
    dispatch({ type: "replace-play", play })
    setCurrentKey(null)
    setSavedDirty(0)
  }

  const duplicatePlay = () => {
    const copy: Play = {
      ...state.play,
      id: newId(),
      name: `${state.play.name} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    dispatch({ type: "replace-play", play: copy })
    setCurrentKey(null)
    setSavedDirty(-1) // force the unsaved dot on
  }

  const deleteEntry = async (entry: LibraryEntry) => {
    if (
      !window.confirm(
        t("playbook.library.deleteConfirm", { name: entry.play.name }),
      )
    ) {
      return
    }
    if (entry.rowId) {
      try {
        await fetch(`/api/playbooks/${entry.rowId}`, { method: "DELETE" })
      } catch {
        flash(t("playbook.library.saveError"))
        return
      }
    }
    const next = library.filter((e) => e.key !== entry.key)
    setLibrary(next)
    if (mode === "local") writeLocal(next.map((e) => e.play))
    if (entry.key === currentKey) setCurrentKey(null)
  }

  // ---- Export / import -----------------------------------------------------

  const buildFile = (plays: Play[]): PlaybookFile => ({
    format: "ghs-playbook",
    version: 1,
    exportedAt: new Date().toISOString(),
    plays,
  })

  const exportCurrent = () => {
    const file = buildFile([state.play])
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    })
    saveAs(blob, `${slugify(state.play.name)}.ghplay.json`)
  }

  const exportAll = () => {
    const plays = [
      state.play,
      ...library.filter((e) => e.key !== currentKey).map((e) => e.play),
    ]
    const blob = new Blob([JSON.stringify(buildFile(plays), null, 2)], {
      type: "application/json",
    })
    saveAs(blob, "playbook.ghplay.json")
  }

  const exportPng = () => {
    const svg = svgRef.current
    if (!svg) return
    const play = state.play
    const w = COURT_WIDTH_M * SCALE
    const h = courtLength(play.courtType) * SCALE
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    clone.setAttribute("width", String(w))
    clone.setAttribute("height", String(h))
    const xml = new XMLSerializer().serializeToString(clone)
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement("canvas")
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `${slugify(play.name)}.png`)
        URL.revokeObjectURL(url)
      }, "image/png")
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  const importFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result))
        const doc = parsePlaybookFile(json)
        const plays = doc
          ? doc.plays
          : ([parsePlay(json)].filter(Boolean) as Play[])
        if (plays.length === 0) {
          flash(t("playbook.library.importError"))
          return
        }
        // Re-key imports so they never collide with existing plays.
        const rekeyed = plays.map((p) => ({ ...p, id: newId() }))
        const entries: LibraryEntry[] = rekeyed.map((p) => ({
          key: p.id,
          rowId: null,
          play: p,
        }))
        setLibrary((lib) => {
          const next = [...entries, ...lib]
          if (mode === "local") writeLocal(next.map((e) => e.play))
          return next
        })
        if (confirmDiscard()) openPlay(entries[0])
        flash(t("playbook.library.imported", { n: rekeyed.length }))
      } catch {
        flash(t("playbook.library.importError"))
      }
    }
    reader.readAsText(file)
  }

  // ---- Render ----------------------------------------------------------------

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>{t("playbook.page.eyebrow")}</Eyebrow>
          <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            Beta
          </span>
        </div>
        <div className="gh-title-rule mt-4">
          <h1 className="font-display text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.012em] text-balance text-ink-50 sm:text-5xl">
            {t("playbook.page.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-ink-300 sm:text-base">
            {t("playbook.page.description")}
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface-1 p-2">
        <input
          type="text"
          value={state.play.name}
          onChange={(e) => dispatch({ type: "set-name", name: e.target.value })}
          maxLength={120}
          aria-label={t("playbook.library.playName")}
          className="gh-input min-w-0 flex-1 text-sm font-semibold sm:max-w-xs"
        />
        {unsaved ? (
          <span
            title={t("playbook.library.unsaved")}
            className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
          />
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={saving || mode === "loading"}
          className="gh-btn-primary px-4 py-2 text-sm"
        >
          {saving ? "…" : t("playbook.library.save")}
        </button>
        <ActionButton onClick={newPlay}>{t("playbook.library.new")}</ActionButton>
        <ActionButton onClick={duplicatePlay}>
          {t("playbook.library.duplicate")}
        </ActionButton>
        <span className="mx-1 hidden h-6 w-px bg-hairline sm:block" aria-hidden />
        <ActionButton onClick={exportCurrent}>
          {t("playbook.library.exportPlay")}
        </ActionButton>
        <ActionButton onClick={exportAll}>
          {t("playbook.library.exportAll")}
        </ActionButton>
        <ActionButton onClick={exportPng}>PNG</ActionButton>
        <ActionButton onClick={() => fileRef.current?.click()}>
          {t("playbook.library.import")}
        </ActionButton>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importFile(f)
            e.target.value = ""
          }}
        />
        {mode === "local" ? (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
            {t("playbook.library.localMode")}
          </span>
        ) : null}
        {notice ? (
          <span className="ml-auto text-xs font-semibold text-emerald-400">
            {notice}
          </span>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* Library */}
        <aside className="order-2 lg:order-1">
          <div className="rounded-xl border border-hairline bg-surface-1 p-3">
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
              {t("playbook.library.title")} ({library.length})
            </p>
            {mode === "loading" ? (
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : library.length === 0 ? (
              <p className="py-4 text-center text-xs text-ink-500">
                {t("playbook.library.empty")}
              </p>
            ) : (
              <ul className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
                {library.map((entry) => (
                  <li key={entry.key} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (entry.key === currentKey) return
                        if (!confirmDiscard()) return
                        openPlay(entry)
                      }}
                      className={cn(
                        "w-full rounded-lg border p-2.5 text-left transition",
                        entry.key === currentKey
                          ? "border-brand-500/40 bg-brand-500/10"
                          : "border-transparent hover:border-hairline hover:bg-white/[0.04]",
                      )}
                    >
                      <p className="truncate pr-5 text-[13px] font-semibold text-ink-100">
                        {entry.play.name}
                      </p>
                      <p className="font-mono text-[10px] text-ink-500">
                        {t("playbook.library.frames", {
                          n: entry.play.frames.length,
                        })}
                        {entry.play.team ? ` · ${entry.play.team.name}` : ""}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={t("playbook.library.delete")}
                      onClick={() => deleteEntry(entry)}
                      className="absolute right-1.5 top-1.5 rounded p-1 text-ink-500 opacity-0 transition hover:bg-red-500/15 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Board */}
        <div className="order-1 min-w-0 lg:order-2">
          <PlayEditor state={state} dispatch={dispatch} svgRef={svgRef} />
        </div>

        {/* Side panels */}
        <aside className="order-3">
          <div className="rounded-xl border border-hairline bg-surface-1 p-3">
            <div className="mb-3 flex gap-1 rounded-lg border border-hairline bg-surface-0 p-0.5">
              {(
                [
                  ["roster", t("playbook.tabs.roster")],
                  ["ai", t("playbook.tabs.ai")],
                  ["details", t("playbook.tabs.details")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition",
                    tab === id
                      ? "bg-brand-600 text-[#fff]"
                      : "text-ink-400 hover:text-ink-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "roster" ? (
              <RosterPanel state={state} dispatch={dispatch} />
            ) : tab === "ai" ? (
              <AiPanel play={state.play} />
            ) : (
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                    {t("playbook.details.description")}
                  </span>
                  <textarea
                    value={state.play.description ?? ""}
                    onChange={(e) =>
                      dispatch({
                        type: "set-description",
                        description: e.target.value,
                      })
                    }
                    maxLength={2000}
                    rows={5}
                    placeholder={t("playbook.details.descriptionPlaceholder")}
                    className="gh-input w-full resize-y text-sm"
                  />
                </label>
                <Legend />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-hairline bg-surface-0 px-3 py-2 text-xs font-semibold text-ink-200 transition hover:bg-surface-2"
    >
      {children}
    </button>
  )
}

/** The universal diagram notation, so new coaches read plays instantly. */
function Legend() {
  const t = useT()
  const rows: { key: string; sample: React.ReactNode }[] = [
    {
      key: "cut",
      sample: (
        <svg width="44" height="12" viewBox="0 0 44 12">
          <path d="M2 6h34" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M36 6l-6-4M36 6l-6 4"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      ),
    },
    {
      key: "pass",
      sample: (
        <svg width="44" height="12" viewBox="0 0 44 12">
          <path
            d="M2 6h34"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
          <path
            d="M36 6l-6-4M36 6l-6 4"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      ),
    },
    {
      key: "dribble",
      sample: (
        <svg width="44" height="12" viewBox="0 0 44 12">
          <path
            d="M2 6c3-5 6 5 9 0s6 5 9 0 6 5 9 0"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
          <path
            d="M36 6l-6-4M36 6l-6 4"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
      ),
    },
    {
      key: "screen",
      sample: (
        <svg width="44" height="12" viewBox="0 0 44 12">
          <path d="M2 6h34" stroke="currentColor" strokeWidth="1.6" />
          <path d="M36 1v10" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      key: "handoff",
      sample: (
        <svg width="44" height="12" viewBox="0 0 44 12">
          <path
            d="M2 6h34"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
          <path d="M30 1v10M35 1v10" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
  ]
  return (
    <div className="rounded-lg border border-hairline bg-surface-0 p-3">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
        {t("playbook.legend.title")}
      </p>
      <ul className="space-y-1.5 text-ink-300">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 text-xs">
            <span className="text-ink-400">{r.sample}</span>
            {t(`playbook.legend.${r.key}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "play"
  )
}
