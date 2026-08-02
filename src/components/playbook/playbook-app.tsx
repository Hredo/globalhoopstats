"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eyebrow } from "@/components/ui/eyebrow"
import { cn } from "@/components/ui/cn"
import { useLocale, useT } from "@/lib/i18n/provider"
import {
  createEmptyPlay,
  createSamplePlay,
  newId,
  parsePlay,
  parsePlaybookFile,
  PLAY_TEMPLATES,
  type Play,
  type PlaybookFile,
  type PlayTemplate,
} from "@/lib/playbook/types"
import { EXTRA_TEMPLATES } from "@/lib/playbook/templates.extra"
import { PlayEditor, Timeline } from "@/components/playbook/editor"
import { usePlayState } from "@/components/playbook/play-state"
import { RosterPanel } from "@/components/playbook/roster-panel"
import { AiPanel } from "@/components/playbook/ai-panel"
import { AiAnalysisDisplay } from "@/components/market/ai-analysis-display"

const ALL_TEMPLATES = [...PLAY_TEMPLATES, ...EXTRA_TEMPLATES]

const LOCAL_KEY = "ghs-playbook-v1"

/** Client-side ceiling for imported .json files — a legit export is ~KBs. */
const MAX_IMPORT_FILE_BYTES = 5_000_000
/** Skip absurdly large photos before even decoding them on a canvas. */
const MAX_PHOTO_FILE_BYTES = 25_000_000

type Notice = { text: string; kind: "ok" | "err" }

type LibraryEntry = {
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
  const locale = useLocale()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const photoRef = useRef<HTMLInputElement | null>(null)

  const [mode, setMode] = useState<StorageMode>("loading")
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [photoImporting, setPhotoImporting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [tab, setTab] = useState<"roster" | "ai" | "details">("roster")
  const [searchQ, setSearchQ] = useState("")
  const [templateOpen, setTemplateOpen] = useState(false)
  const [horizontal, setHorizontal] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)

  const { state, dispatch } = usePlayState(useMemo(() => createSamplePlay(), []))
  const playFramesLen = state.play.frames.length

  // ── Playback state (lifted for sidebar Timeline) ──────────────────────────
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [progress, setProgress] = useState(0)
  const animRef = useRef<number | null>(null)

  const startPlayback = useCallback(() => {
    if (playFramesLen < 2) return
    setProgress(0)
    setPlaying(true)
  }, [playFramesLen])

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const totalFrames = playFramesLen - 1
    const baseMs = 1200
    const totalMs = (baseMs * totalFrames) / speed

    function tick(now: number) {
      const elapsed = now - last
      last = now
      setProgress((p) => {
        const next = p + elapsed / totalMs
        if (next >= totalFrames) {
          if (loop) return next % totalFrames
          setPlaying(false)
          dispatch({ type: "set-frame-idx", frameIdx: playFramesLen - 1 })
          return totalFrames
        }
        return next
      })
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    }
  }, [playing, speed, loop, playFramesLen, dispatch])

  // Pausing lands the board on the closest frame instead of jumping to 0.
  const pausePlayback = useCallback(() => {
    setPlaying(false)
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    animRef.current = null
    setProgress((p) => {
      dispatch({ type: "set-frame-idx", frameIdx: Math.round(p) })
      return 0
    })
  }, [dispatch])

  // Space toggles playback, like every video editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " ") return
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return
      e.preventDefault()
      if (playing) pausePlayback()
      else startPlayback()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [playing, pausePlayback, startPlayback])

  const [savedDirty, setSavedDirty] = useState(0)
  const unsaved = state.dirty !== savedDirty

  const filteredLibrary = useMemo(
    () => library.filter((e) => e.play.name.toLowerCase().includes(searchQ.toLowerCase())),
    [library, searchQ],
  )

  const openPlay = useCallback(
    (entry: LibraryEntry) => {
      dispatch({ type: "replace-play", play: entry.play })
      setCurrentKey(entry.key)
      setSavedDirty(0)
    },
    [dispatch],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/playbooks", { cache: "no-store" })
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as { plays: { id: string; data: unknown }[] }
          const entries: LibraryEntry[] = data.plays.flatMap((row) => {
            const play = parsePlay(row.data)
            return play ? [{ key: row.id, rowId: row.id, play }] : []
          })
          setMode("cloud")
          setLibrary(entries)
          if (entries[0]) {
            openPlay(entries[0])
          } else {
            dispatch({ type: "replace-play", play: createDefaultPlay(t("playbook.library.untitled")) })
            setCurrentKey(null)
            setSavedDirty(0)
          }
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
      } else {
        dispatch({ type: "replace-play", play: createDefaultPlay(t("playbook.library.untitled")) })
        setCurrentKey(null)
        setSavedDirty(0)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPlay])

  useEffect(() => {
    if (!unsaved) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [unsaved])

  const flash = (msg: string, kind: Notice["kind"] = "ok") => {
    setNotice({ text: msg, kind })
    window.setTimeout(() => setNotice(null), kind === "err" ? 3600 : 2600)
  }

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
        flash(data.error ?? t("playbook.library.saveError"), "err")
        return
      }
      const rowId: string = data.id
      const entry: LibraryEntry = { key: rowId, rowId, play }
      setLibrary((lib) => [entry, ...lib.filter((e) => e.key !== currentKey && e.key !== rowId)])
      setCurrentKey(rowId)
      setSavedDirty(state.dirty)
      flash(t("playbook.library.savedCloud"))
    } catch {
      flash(t("playbook.library.saveError"), "err")
    } finally {
      setSaving(false)
    }
  }

  // Ctrl/Cmd+S saves, like every editor. No dep array on purpose: `save`
  // closes over fresh state each render and the listener swap is cheap.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return
      e.preventDefault()
      void saveRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const confirmDiscard = useCallback(
    (): boolean => !unsaved || window.confirm(t("playbook.library.discardConfirm")),
    [unsaved, t],
  )

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
    setSavedDirty(-1)
  }

  const deleteEntry = async (entry: LibraryEntry) => {
    if (!window.confirm(t("playbook.library.deleteConfirm", { name: entry.play.name }))) return
    if (entry.rowId) {
      try { await fetch(`/api/playbooks/${entry.rowId}`, { method: "DELETE" }) }
      catch { flash(t("playbook.library.saveError"), "err"); return }
    }
    const next = library.filter((e) => e.key !== entry.key)
    setLibrary(next)
    if (mode === "local") writeLocal(next.map((e) => e.play))
    if (entry.key === currentKey) setCurrentKey(null)
  }

  // Single export path: the branded PDF report (full play + AI analysis).
  const [exportingPdf, setExportingPdf] = useState(false)
  const exportPdf = async () => {
    if (exportingPdf) return
    setExportingPdf(true)
    try {
      const { exportPlayPdf } = await import("@/components/playbook/export-pdf")
      await exportPlayPdf({ play: state.play, analysis, locale })
    } catch {
      flash(t("playbook.library.exportPdfError"), "err")
    } finally {
      setExportingPdf(false)
    }
  }

  const downloadJson = useCallback((plays: Play[], base: string) => {
    const doc: PlaybookFile = {
      format: "ghs-playbook",
      version: 1,
      exportedAt: new Date().toISOString(),
      plays,
    }
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${base.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "playbook"}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [])

  const exportJson = () => downloadJson([state.play], state.play.name)
  const exportLibrary = () => {
    if (library.length > 0) downloadJson(library.map((e) => e.play), "playbook-library")
  }

  const importFile = (file: File) => {
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      flash(t("playbook.library.importTooLarge"), "err")
      return
    }
    if (!/\.json$/i.test(file.name) && !file.type.includes("json")) {
      flash(t("playbook.library.importError"), "err")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result))
        const doc = parsePlaybookFile(json)
        const plays = doc ? doc.plays : ([parsePlay(json)].filter(Boolean) as Play[])
        if (plays.length === 0) { flash(t("playbook.library.importError"), "err"); return }
        const rekeyed = plays.map((p) => ({ ...p, id: newId() }))
        const entries: LibraryEntry[] = rekeyed.map((p) => ({ key: p.id, rowId: null, play: p }))
        setLibrary((lib) => {
          const next = [...entries, ...lib]
          if (mode === "local") writeLocal(next.map((e) => e.play))
          return next
        })
        if (confirmDiscard()) openPlay(entries[0])
        flash(t("playbook.library.imported", { n: rekeyed.length }))
      } catch { flash(t("playbook.library.importError"), "err") }
    }
    reader.readAsText(file)
  }

  // Downscale to ≤1600px and re-encode as JPEG so phone photos stay under
  // the API payload limit (raw camera shots easily exceed it as base64).
  const readImageAsBase64 = (file: File): Promise<{ data: string; mediaType: string }> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX_DIM = 1600
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas unavailable"))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
        resolve({ data: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg" })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error("Failed to read image"))
      }
      img.src = url
    })

  const importPhoto = async (files: FileList | File[]) => {
    // Only real image files, and nothing so big the canvas decode would
    // freeze the tab; the server re-validates type and size anyway.
    const list = Array.from(files)
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_PHOTO_FILE_BYTES)
      .slice(0, 6)
    if (list.length === 0) {
      flash(t("playbook.library.importPhotoError"), "err")
      return
    }
    setPhotoImporting(true)
    flash(t("playbook.library.importingPhoto"))
    try {
      const images = await Promise.all(list.map(readImageAsBase64))
      const res = await fetch("/api/playbooks/photo-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          name: state.play.name !== t("playbook.library.untitled") ? state.play.name : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.aiConfigured === false) {
          flash(t("playbook.library.importPhotoNoAi"), "err")
        } else {
          flash(data.error ?? t("playbook.library.importPhotoError"), "err")
        }
        return
      }
      if (!data.play) {
        flash(t("playbook.library.importPhotoError"), "err")
        return
      }
      const play: Play = { ...data.play, id: newId() }
      const entry: LibraryEntry = { key: play.id, rowId: null, play }
      setLibrary((lib) => {
        const next = [entry, ...lib]
        if (mode === "local") writeLocal(next.map((e) => e.play))
        return next
      })
      if (confirmDiscard()) openPlay(entry)
      flash(t("playbook.library.imported", { n: 1 }))
    } catch {
      flash(t("playbook.library.importPhotoError"), "err")
    } finally {
      setPhotoImporting(false)
    }
  }

  // ── Drag & drop import (JSON exports or diagram photos) ──────────────────
  const [dropActive, setDropActive] = useState(false)
  const dragDepth = useRef(0)
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files")
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDropActive(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (hasFiles(e)) e.preventDefault()
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropActive(false)
  }
  const onDropFiles = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDropActive(false)
    const files = Array.from(e.dataTransfer.files)
    const json = files.find((f) => /\.json$/i.test(f.name) || f.type === "application/json")
    const images = files.filter((f) => f.type.startsWith("image/"))
    if (json) importFile(json)
    else if (images.length > 0) void importPhoto(images)
    else flash(t("playbook.library.importError"), "err")
  }

  const loadTemplate = useCallback(
    (template: PlayTemplate) => {
      if (!confirmDiscard()) return
      const play = template.create()
      dispatch({ type: "replace-play", play })
      setCurrentKey(null)
      setSavedDirty(0)
      setTemplateOpen(false)
    },
    [confirmDiscard, dispatch],
  )

  const sidebarContent = (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-hairline/30">
        {(["roster", "ai", "details"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={cn("relative px-3 pb-2 pt-1 text-xs font-semibold transition-all duration-200",
              tab === id ? "text-brand-400" : "text-ink-300 hover:text-ink-50")}>
            {t(`playbook.tabs.${id}`)}
            {tab === id ? (
              <motion.div layoutId="tab-underline" className="absolute -bottom-px left-0 right-0 h-0.5 bg-brand-400 rounded-full" />
            ) : null}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
          {tab === "roster" ? <RosterPanel state={state} dispatch={dispatch} /> :
           tab === "ai" ? <AiPanel play={state.play} onAnalysis={setAnalysis} disabled={false} /> :
           <div className="flex flex-col gap-4">
             <label className="block">
               <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                 {t("playbook.details.description")}
               </span>
               <textarea value={state.play.description ?? ""}
                 onChange={(e) => dispatch({ type: "set-description", description: e.target.value })}
                 maxLength={2000} rows={5}
                 placeholder={t("playbook.details.descriptionPlaceholder")}
                 className="gh-input w-full resize-y text-sm" />
               <span className="mt-1 block text-right font-mono text-[10px] text-ink-400">
                 {(state.play.description ?? "").length}/2000
               </span>
             </label>
             <Legend />
           </div>}
        </motion.div>
      </AnimatePresence>

      <div className="h-px bg-hairline/30" />

      <Timeline
        state={state} dispatch={dispatch}
        playing={playing} speed={speed} setSpeed={setSpeed}
        loop={loop} onToggleLoop={() => setLoop((l) => !l)}
        onPlay={startPlayback} onStop={pausePlayback} progress={progress}
      />

      {/* Frame note */}
      <input
        type="text"
        value={state.play.frames[state.frameIdx]?.note ?? ""}
        onChange={(e) => dispatch({ type: "set-frame-note", note: e.target.value })}
        placeholder={t("playbook.editor.notePlaceholder", { n: state.frameIdx + 1 })}
        maxLength={200}
        disabled={playing}
        className="gh-input w-full text-xs"
      />
    </div>
  )

  const librarySidebar = (
    <LibrarySidebar
      library={filteredLibrary}
      currentKey={currentKey}
      searchQ={searchQ}
      onSearch={setSearchQ}
      onOpen={(entry) => { if (entry.key !== currentKey && confirmDiscard()) openPlay(entry) }}
      onDelete={deleteEntry}
      onExportAll={exportLibrary}
      mode={mode}
      totalCount={library.length}
    />
  )

  return (
    <div
      className="playbook-root mx-auto flex w-full max-w-[1500px] flex-col px-4 sm:px-6"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDropFiles}
    >
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline/50 py-3">
        <div className="flex items-center gap-3">
          <Eyebrow>{t("playbook.page.eyebrow")}</Eyebrow>
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {notice ? (
              <motion.span
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                role="status"
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold",
                  notice.kind === "err"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-emerald-500/10 text-emerald-400",
                )}
              >
                {notice.text}
              </motion.span>
            ) : null}
          </AnimatePresence>
          {mode === "local" ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              {t("playbook.library.localMode")}
            </span>
          ) : null}
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface-1/95 px-3 py-2.5 shadow-sm">
        <input type="text" value={state.play.name}
          onChange={(e) => dispatch({ type: "set-name", name: e.target.value })}
          maxLength={120} aria-label={t("playbook.library.playName")}
          className="gh-input min-w-0 flex-1 text-sm font-semibold sm:max-w-[180px]" />
        {unsaved ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
            title={t("playbook.library.unsaved")}
          />
        ) : null}
        <ActionButton onClick={save} disabled={saving || mode === "loading"} className="gh-btn-primary px-3 py-1.5 text-xs">
          {saving ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving
            </span>
          ) : t("playbook.library.save")}
        </ActionButton>
        <ActionButton onClick={newPlay}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline sm:mr-1"><path d="M12 5v14M5 12h14" /></svg>
          <span className="hidden sm:inline">{t("playbook.library.new")}</span>
        </ActionButton>
        <ActionButton onClick={() => setTemplateOpen(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline sm:mr-1"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
          <span className="hidden sm:inline">{t("playbook.library.templates")}</span>
        </ActionButton>
        <span className="mx-1 hidden h-5 w-px bg-hairline/40 sm:block" aria-hidden />
        <div className="hidden sm:flex sm:items-center sm:gap-2">
          <ActionButton onClick={duplicatePlay}>{t("playbook.library.duplicate")}</ActionButton>
          <ActionButton onClick={exportPdf} disabled={exportingPdf} title={t("playbook.library.exportPdfHint")}>
            {exportingPdf ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                PDF
              </span>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline sm:mr-1"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M12 18v-6M9 15l3 3 3-3" /></svg>
                <span className="hidden sm:inline">{t("playbook.library.exportPdf")}</span>
              </>
            )}
          </ActionButton>
          <ActionButton onClick={exportJson} title={t("playbook.library.exportJsonHint")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline sm:mr-1"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            <span className="hidden sm:inline">{t("playbook.library.exportJson")}</span>
          </ActionButton>
          <ActionButton onClick={() => fileRef.current?.click()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline sm:mr-1"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
            <span className="hidden sm:inline">{t("playbook.library.import")}</span>
          </ActionButton>
          <ActionButton onClick={() => photoRef.current?.click()} disabled={photoImporting}
            title={t("playbook.library.importPhotoHint")}>
            {photoImporting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                AI
              </span>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline sm:mr-1"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                <span className="hidden sm:inline">{t("playbook.library.importPhoto")}</span>
              </>
            )}
          </ActionButton>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = "" }} />
        <input ref={photoRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { const files = e.target.files; if (files && files.length > 0) importPhoto(files); e.target.value = "" }} />

        {/* Mobile overflow menu */}
        <div className="sm:hidden ml-auto flex items-center gap-1">
          <MobileOverlayMenu
            duplicatePlay={duplicatePlay}
            exportPdf={exportPdf}
            exportingPdf={exportingPdf}
            exportJson={exportJson}
            importTrigger={() => fileRef.current?.click()}
            photoImport={() => photoRef.current?.click()}
            photoImporting={photoImporting}
          />
        </div>

        <button type="button" onClick={() => setSidebarOpen((o) => !o)}
          title="Toggle panels"
          className="ml-1 rounded-xl border border-hairline bg-surface-0 p-2 text-ink-400 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-surface-2 hover:text-ink-50 active:scale-95 lg:hidden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" />
          </svg>
        </button>
      </div>

      {/* Main area — 3-column grid: library | court | panels */}
      <div className="min-h-0 flex-1 gap-4 py-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:grid lg:grid-cols-[230px_minmax(0,1fr)_310px]">
        {/* Left column: library sidebar */}
        <aside className="hidden self-start rounded-xl border border-hairline bg-surface-1/95 p-3 shadow-sm lg:block">
          {librarySidebar}
        </aside>

        {/* Center column: court board */}
        <div className="min-w-0 flex flex-col">
          <PlayEditor
            state={state} dispatch={dispatch} svgRef={svgRef}
            playing={playing} progress={progress}
            horizontal={horizontal}
            onToggleOrientation={() => setHorizontal((h) => !h)}
          />
        </div>

        {/* Right column: panels */}
        <aside className="hidden self-start rounded-xl border border-hairline bg-surface-1/95 p-3 shadow-sm lg:block">
          {sidebarContent}
        </aside>
      </div>

      {/* AI analysis output below the board */}
      <AnimatePresence>
        {analysis ? (
          <motion.div
            initial={{ opacity: 0, y: 16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="mb-6 mt-4 overflow-hidden rounded-lg border border-brand-500/15 bg-surface-1/50 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-400">
                {t("playbook.ai.outputTitle")}
              </span>
              <button
                type="button"
                onClick={() => setAnalysis(null)}
                className="ml-auto rounded-md p-1 text-ink-400 transition hover:bg-white/[0.05] hover:text-ink-50"
                aria-label="Close analysis"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="prose prose-invert prose-sm max-w-none text-ink-200">
              <AiAnalysisDisplay text={analysis} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Mobile sidebar — bottom sheet */}
      <AnimatePresence>
        {sidebarOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 400 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-hairline/40 bg-surface-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline/30 bg-surface-2 px-5 py-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  {t("playbook.library.title")}
                </span>
                <button type="button" onClick={() => setSidebarOpen(false)}
                  className="rounded-md p-1.5 text-ink-400 transition hover:bg-white/[0.05] hover:text-ink-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex flex-col gap-4 p-4">
                {librarySidebar}
                {sidebarContent}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Template picker */}
      <AnimatePresence>
        {templateOpen ? (
          <TemplatePicker onSelect={loadTemplate} onClose={() => setTemplateOpen(false)} />
        ) : null}
      </AnimatePresence>

      {/* Drop-to-import overlay */}
      <AnimatePresence>
        {dropActive ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          >
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-brand-400/70 bg-surface-2/95 px-10 py-8 text-center shadow-2xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-400">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <p className="max-w-[260px] text-sm font-semibold text-ink-50">
                {t("playbook.library.dropToImport")}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionButton({ onClick, children, disabled, className, title }: {
  onClick: () => void; children: React.ReactNode; disabled?: boolean; className?: string; title?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={cn(
        "rounded-lg border border-hairline bg-surface-0 px-3 py-1.5 text-xs font-semibold text-ink-100 transition-all duration-200 hover:border-hairline-strong hover:bg-surface-1 hover:text-ink-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70",
        className)}>
      {children}
    </button>
  )
}

function MobileOverlayMenu({
  duplicatePlay, exportPdf, exportingPdf, exportJson, importTrigger, photoImport, photoImporting,
}: {
  duplicatePlay: () => void; exportPdf: () => void; exportingPdf: boolean
  exportJson: () => void
  importTrigger: () => void; photoImport: () => void; photoImporting: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onEsc)
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onEsc) }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline/50 bg-surface-0/80 text-ink-400 transition hover:bg-surface-1 hover:text-ink-50 active:scale-95">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            className="absolute right-0 top-full z-50 mt-1 w-44 origin-top-right rounded-lg border border-hairline/40 bg-surface-2 p-1 shadow-lg">
            <MenuItem onClick={() => { duplicatePlay(); setOpen(false) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
              {t("playbook.library.duplicate")}
            </MenuItem>
            <MenuItem onClick={() => { exportPdf(); setOpen(false) }} disabled={exportingPdf}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M12 18v-6M9 15l3 3 3-3" /></svg>
              {t("playbook.library.exportPdf")}
            </MenuItem>
            <MenuItem onClick={() => { exportJson(); setOpen(false) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              {t("playbook.library.exportJson")}
            </MenuItem>
            <div className="my-1 h-px bg-hairline/20" />
            <MenuItem onClick={() => { importTrigger(); setOpen(false) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              {t("playbook.library.import")}
            </MenuItem>
            <MenuItem onClick={() => { photoImport(); setOpen(false) }} disabled={photoImporting}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
              {t("playbook.library.importPhoto")}
            </MenuItem>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MenuItem({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink-200 transition hover:bg-white/[0.05] hover:text-ink-50 disabled:opacity-40">
      {children}
    </button>
  )
}

function LibrarySidebar({ library, currentKey, searchQ, onSearch, onOpen, onDelete, onExportAll, mode, totalCount }: {
  library: LibraryEntry[]; currentKey: string | null; searchQ: string
  onSearch: (q: string) => void; onOpen: (e: LibraryEntry) => void; onDelete: (e: LibraryEntry) => void
  onExportAll: () => void
  mode: StorageMode; totalCount: number
}) {
  const t = useT()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 border-b border-hairline/30 pb-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
          {t("playbook.library.title")}
        </p>
        <span className="font-mono text-[10px] text-ink-400">{totalCount}</span>
        {totalCount > 0 ? (
          <button type="button" onClick={onExportAll}
            title={t("playbook.library.exportAll")} aria-label={t("playbook.library.exportAll")}
            className="rounded-md p-1 text-ink-400 transition hover:bg-white/[0.05] hover:text-ink-50">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          </button>
        ) : null}
        <div className="relative ml-auto flex-1">
          <svg aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-400"
            fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M16.65 10.65a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
          </svg>
          <input type="text" value={searchQ} onChange={(e) => onSearch(e.target.value)}
            placeholder={t("playbook.library.searchPlh")}
            className="gh-input w-full rounded-lg py-1.5 pl-6 pr-2 text-[11px]" />
        </div>
      </div>
      {mode === "loading" ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : library.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-400">
              <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink-200">{t("playbook.library.empty")}</p>
          <p className="mt-1 px-4 text-xs text-ink-400">{t("playbook.library.templates")}</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {library.map((entry) => (
            <li key={entry.key} className="group relative">
              <button type="button"
                onClick={() => onOpen(entry)}
                className={cn(
                  "w-full rounded-lg border p-2.5 text-left transition-all duration-200",
                  entry.key === currentKey
                    ? "border-brand-500/40 bg-brand-500/10"
                    : "border-hairline bg-surface-0 hover:border-hairline-strong hover:bg-surface-1 active:scale-[0.99]",
                )}>
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold",
                    entry.key === currentKey ? "bg-brand-500/20 text-brand-300" : "bg-surface-2 text-ink-300"
                  )}>
                    {entry.play.elements.filter(e => e.kind === "attacker").length}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate pr-4 text-[13px] font-semibold text-ink-100">{entry.play.name}</p>
                    <p className="font-mono text-[10px] text-ink-400">
                      {t("playbook.library.frames", { n: entry.play.frames.length })}
                      {entry.play.team ? <span className="text-ink-500"> · </span> : ""}
                      {entry.play.team ? <span className="text-ink-400">{entry.play.team.name}</span> : ""}
                    </p>
                  </div>
                </div>
              </button>
              <button type="button" aria-label={t("playbook.library.delete")}
                onClick={() => onDelete(entry)}
                className="absolute right-2 top-2.5 rounded-md p-1 text-ink-400 opacity-60 transition hover:bg-red-500/15 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100 lg:opacity-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Legend() {
  const t = useT()
  const rows: { key: string; label: string; sample: React.ReactNode }[] = [
    { key: "cut", label: t("playbook.legend.cut"), sample: <svg width="28" height="8" viewBox="0 0 28 8"><path d="M2 4h20" stroke="currentColor" strokeWidth="1.4" /><path d="M22 4l-4-2.5M22 4l-4 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg> },
    { key: "pass", label: t("playbook.legend.pass"), sample: <svg width="28" height="8" viewBox="0 0 28 8"><path d="M2 4h20" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 2" /><path d="M22 4l-4-2.5M22 4l-4 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg> },
    { key: "dribble", label: t("playbook.legend.dribble"), sample: <svg width="28" height="8" viewBox="0 0 28 8"><path d="M2 4c2-3 4 3 6 0s4 3 6 0s4 3 6 0" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M22 4l-4-2.5M22 4l-4 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg> },
    { key: "screen", label: t("playbook.legend.screen"), sample: <svg width="28" height="8" viewBox="0 0 28 8"><path d="M2 4h20" stroke="currentColor" strokeWidth="1.4" /><path d="M22 1.5v5" stroke="currentColor" strokeWidth="1.6" /></svg> },
    { key: "handoff", label: t("playbook.legend.handoff"), sample: <svg width="28" height="8" viewBox="0 0 28 8"><path d="M2 4h20" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 2" /><path d="M18 1.5v5M21 1.5v5" stroke="currentColor" strokeWidth="1.4" /></svg> },
  ]
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
          {t("playbook.legend.title")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs text-ink-200">
            <span className="shrink-0 text-ink-300">{r.sample}</span>
            <span>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


// ── Template picker ──────────────────────────────────────────────────────────

function subGroup(t: PlayTemplate): string {
  const id = t.id
  if (t.category === "sideline") return "Sideline OOB"
  if (t.category === "baseline") return "Baseline OOB"
  if (t.category === "transition") return "Transition"
  if (t.category === "defense") {
    if (/^(zone|diamond|box|amoeba|pack|1-3-1|2-3|3-2)/i.test(id)) return "Zone"
    if (/^(press|trap|2-2-1|1-2-1-1)/i.test(id)) return "Press / Trap"
    return "Man / Hybrid"
  }
  if (t.category === "offense") {
    if (/^pnr/i.test(id)) return "Pick & Roll"
    if (/^horns/i.test(id)) return "Horns"
    if (/^(cut|backdoor|curl|shallow)/i.test(id)) return "Cuts"
    if (/^(screen|stagger|pin-down|cross|double)/i.test(id)) return "Screens"
    if (/^(motion|read-react|princeton|swing|dribble)/i.test(id)) return "Motion"
    if (/^post/i.test(id)) return "Post"
    if (/^(zoom|sts|handback)/i.test(id)) return "EuroLeague"
    if (/^(spain|chicago|zipper|iverson|floppy|hammer|ucla|five-out|flex|zone-off)/i.test(id)
      || /^(1-3-1|5-out)/i.test(t.name)) return "Classic Sets"
    return "Offense"
  }
  return "Other"
}

const GROUP_ORDER = [
  "Pick & Roll", "Horns", "Cuts", "Screens", "Motion", "Post", "EuroLeague",
  "Classic Sets", "Offense",
  "Zone", "Press / Trap", "Man / Hybrid",
  "Transition",
  "Sideline OOB",
  "Baseline OOB",
  "Other",
]

function TemplatePicker({ onSelect, onClose }: {
  onSelect: (t: PlayTemplate) => void; onClose: () => void
}) {
  const t = useT()
  const [cat, setCat] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState("")

  const filtered = useMemo(() => {
    const byCat = cat ? ALL_TEMPLATES.filter((pt) => pt.category === cat) : ALL_TEMPLATES
    if (!searchQ) return byCat
    const q = searchQ.toLowerCase()
    return byCat.filter((pt) =>
      pt.name.toLowerCase().includes(q) || pt.description.toLowerCase().includes(q)
    )
  }, [cat, searchQ])

  const grouped = useMemo(() => {
    const map = new Map<string, PlayTemplate[]>()
    for (const pt of filtered) {
      const sg = subGroup(pt)
      if (!map.has(sg)) map.set(sg, [])
      map.get(sg)!.push(pt)
    }
    const order = GROUP_ORDER.filter((g) => map.has(g))
    const extra = [...map.keys()].filter((g) => !GROUP_ORDER.includes(g))
    return [...order, ...extra].map((g) => ({ group: g, items: map.get(g)! }))
  }, [filtered])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", damping: 30, stiffness: 380 }}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-hairline/60 bg-surface-2 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-hairline/30 px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-ink-50">{t("playbook.library.templates")}</p>
            <p className="font-mono text-[10px] text-ink-400">{ALL_TEMPLATES.length} plays</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M16.65 10.65a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
              </svg>
              <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t("playbook.library.searchPlh")}
                className="gh-input w-44 rounded-lg py-1.5 pl-8 pr-3 text-[12px]" />
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/[0.05] hover:text-ink-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-hairline/30 px-5 py-2.5 overflow-x-auto">
          <button type="button" onClick={() => setCat(null)}
            className={cn("rounded-lg px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition shrink-0",
              !cat ? "bg-brand-500 text-ink-950" : "text-ink-300 hover:text-ink-50")}>
            {t("playbook.library.allCategories")}
            <span className="ml-1.5 rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px]">{ALL_TEMPLATES.length}</span>
          </button>
          {(["offense", "defense", "transition", "sideline", "baseline"] as const).map((c) => {
            const count = ALL_TEMPLATES.filter((pt) => pt.category === c).length
            return (
              <button key={c} type="button" onClick={() => setCat(c)}
                className={cn("rounded-lg px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition shrink-0",
                  cat === c ? "bg-brand-500 text-ink-950" : "text-ink-300 hover:text-ink-50")}>
                {t(`playbook.templateCats.${c}`)}
                <span className="ml-1.5 rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px]">{count}</span>
              </button>
            )
          })}
        </div>

        <motion.div layout className="max-h-[55vh] overflow-y-auto px-5 py-3 space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-500/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-500">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-ink-400">{t("playbook.library.empty")}</p>
            </div>
          ) : grouped.map(({ group, items }) => (
            <div key={group}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">
                  {group}
                </span>
                <span className="font-mono text-[10px] text-ink-400">{items.length}</span>
                <div className="flex-1 h-px bg-hairline/20" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {items.map((pt) => (
                  <motion.button
                    key={pt.id}
                    layout
                    type="button" onClick={() => onSelect(pt)}
                    className="group flex items-center gap-3 rounded-lg border border-hairline/30 bg-surface-0/60 p-2.5 text-left transition-all hover:border-brand-500/30 hover:bg-brand-500/[0.04] active:scale-[0.99]"
                  >
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-bold",
                      pt.category === "offense" ? "bg-emerald-500/15 text-emerald-300" :
                      pt.category === "defense" ? "bg-blue-500/15 text-blue-300" :
                      pt.category === "transition" ? "bg-violet-500/15 text-violet-300" :
                      pt.category === "sideline" ? "bg-amber-500/15 text-amber-300" :
                      "bg-rose-500/15 text-rose-300"
                    )}>
                      {pt.category === "offense" ? "O" : pt.category === "defense" ? "D" : pt.category === "transition" ? "T" : pt.category === "sideline" ? "S" : "B"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink-100 transition group-hover:text-ink-50">{pt.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400 line-clamp-1">{pt.description}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
