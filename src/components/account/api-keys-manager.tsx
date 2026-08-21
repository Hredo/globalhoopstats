"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AccountSection,
  Field,
  Select,
  StatusNote,
  TextInput,
} from "@/components/account/primitives"
import {
  AI_PROVIDERS,
  getProvider,
  providersForFeature,
  resolveModel,
  type AiFeature,
  type AiModel,
  type AiProvider,
} from "@/lib/ai/providers"
import { useLocale, useT } from "@/lib/i18n/provider"
import { providerCopy } from "@/lib/ai/provider-copy"

const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"

type KeyStatus = {
  provider: string
  last4: string
  label: string | null
  updatedAt: string
}

type Settings = {
  advisorProvider: string | null
  advisorModel: string | null
  compareProvider: string | null
  compareModel: string | null
}

type OllamaStatus = "checking" | "available" | "unavailable"

/** Where the model dropdown's options came from. */
type LiveState = "idle" | "loading" | "live" | "failed"

/** Stable empty reference so memos downstream do not invalidate every render. */
const EMPTY_MODELS: AiModel[] = []

type Note = { type: "success" | "error" | "info"; msg: string }

export function ApiKeysManager() {
  const t = useT()
  const [keys, setKeys] = useState<Record<string, KeyStatus>>({})
  const [settings, setSettings] = useState<Settings>({
    advisorProvider: null,
    advisorModel: null,
    compareProvider: null,
    compareModel: null,
  })
  const [loading, setLoading] = useState(true)
  const [ollama, setOllama] = useState<OllamaStatus>("checking")
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/api-keys", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { keys: KeyStatus[]; settings: Settings }
      const map: Record<string, KeyStatus> = {}
      for (const k of data.keys) map[k.provider] = k
      setKeys(map)
      setSettings(data.settings)
    } finally {
      setLoading(false)
    }
  }, [])

  const checkOllama = useCallback(async () => {
    setOllama("checking")
    try {
      const r = await fetch(OLLAMA_TAGS_URL, { mode: "cors" })
      if (!r.ok) throw new Error("bad")
      const data = (await r.json()) as { models?: Array<{ name: string }> }
      setOllamaModels((data.models ?? []).map((m) => m.name))
      setOllama("available")
    } catch {
      setOllamaModels([])
      setOllama("unavailable")
    }
  }, [])

  useEffect(() => {
    void load()
    void checkOllama() // eslint-disable-line react-hooks/set-state-in-effect
  }, [load, checkOllama])

  const readiness = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const p of AI_PROVIDERS) {
      map[p.id] = p.needsKey ? Boolean(keys[p.id]) : ollama === "available"
    }
    return map
  }, [keys, ollama])

  return (
    <>
      <AccountSection
        title={t("account.aiKeys.byoTitle")}
        description={t("account.aiKeys.byoDescription")}
        action={
          <Link
            href="/ai-setup"
            className="inline-flex h-9 items-center rounded-full border border-brand-500/40 bg-brand-500/10 px-4 text-[13px] font-semibold text-brand-200 transition hover:bg-brand-500/20"
          >
            {t("account.aiKeys.setupGuide")}
          </Link>
        }
      >
        <EngineSelectors
          settings={settings}
          readiness={readiness}
          installedLocalModels={ollamaModels}
          onSaved={(s) => setSettings(s)}
        />
      </AccountSection>

      <AccountSection
        title={t("account.aiKeys.providersTitle")}
        description={t("account.aiKeys.providersDescription")}
      >
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl bg-white/[0.04]"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {AI_PROVIDERS.map((p) =>
              p.needsKey ? (
                <KeyProviderCard
                  key={p.id}
                  provider={p}
                  status={keys[p.id] ?? null}
                  onChanged={load}
                />
              ) : (
                <LocalProviderCard
                  key={p.id}
                  provider={p}
                  status={ollama}
                  models={ollamaModels}
                  onRetry={checkOllama}
                />
              ),
            )}
          </div>
        )}
      </AccountSection>
    </>
  )
}

function EngineSelectors({
  settings,
  readiness,
  installedLocalModels,
  onSaved,
}: {
  settings: Settings
  readiness: Record<string, boolean>
  /** Model tags actually pulled onto this machine, from Ollama's /api/tags. */
  installedLocalModels: string[]
  onSaved: (s: Settings) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<Note | null>(null)

  useEffect(() => setDraft(settings), [settings]) // eslint-disable-line react-hooks/set-state-in-effect

  const dirty =
    draft.advisorProvider !== settings.advisorProvider ||
    draft.advisorModel !== settings.advisorModel ||
    draft.compareProvider !== settings.compareProvider ||
    draft.compareModel !== settings.compareModel

  const save = async () => {
    setSaving(true)
    setNote(null)
    try {
      const res = await fetch("/api/account/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advisorProvider: draft.advisorProvider,
          advisorModel: draft.advisorModel,
          compareProvider: draft.compareProvider,
          compareModel: draft.compareModel,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNote({
          type: "error",
          msg: data.error ?? t("account.aiKeys.couldNotSave"),
        })
        return
      }
      onSaved(data.settings)
      setNote({ type: "success", msg: t("account.aiKeys.enginesUpdated") })
    } catch {
      setNote({ type: "error", msg: t("account.aiKeys.networkError") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FeaturePicker
          feature="advisor"
          label={t("account.aiKeys.advisorEngine")}
          provider={draft.advisorProvider}
          model={draft.advisorModel}
          readiness={readiness}
          installedLocalModels={installedLocalModels}
          onChange={(provider, model) =>
            setDraft((d) => ({ ...d, advisorProvider: provider, advisorModel: model }))
          }
        />
        <FeaturePicker
          feature="compare"
          label={t("account.aiKeys.compareEngine")}
          provider={draft.compareProvider}
          model={draft.compareModel}
          readiness={readiness}
          installedLocalModels={installedLocalModels}
          onChange={(provider, model) =>
            setDraft((d) => ({ ...d, compareProvider: provider, compareModel: model }))
          }
        />
      </div>

      {note ? <StatusNote type={note.type}>{note.msg}</StatusNote> : null}

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="inline-flex h-10 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400 disabled:opacity-50"
      >
        {saving
          ? t("account.aiKeys.savingEngines")
          : t("account.aiKeys.saveEngines")}
      </button>
    </div>
  )
}

function FeaturePicker({
  feature,
  label,
  provider,
  model,
  readiness,
  installedLocalModels,
  onChange,
}: {
  feature: AiFeature
  label: string
  provider: string | null
  model: string | null
  readiness: Record<string, boolean>
  installedLocalModels: string[]
  onChange: (provider: string | null, model: string | null) => void
}) {
  const t = useT()
  const options = providersForFeature(feature)
  const selected = provider ? getProvider(provider) : null
  const ready = provider ? readiness[provider] : true

  // Models the provider itself says it will serve for this key. The static
  // catalogue is hand-written and goes stale — a retired id 404s at answer
  // time — so ask upstream whenever we can.
  //
  // The fetched provider id is stored alongside the result so switching
  // provider discards the previous answer by derivation rather than by an
  // extra reset render, which also stops a slow response for provider A from
  // ever being shown under provider B.
  const [live, setLive] = useState<{
    provider: string
    models: AiModel[]
    state: Exclude<LiveState, "idle" | "loading">
  } | null>(null)

  const providerId = selected?.id ?? null
  const isLocal = Boolean(selected?.allowCustomModels)
  const hasKey = providerId ? Boolean(readiness[providerId]) : false
  // Local engines are discovered in the browser (see checkOllama); the server
  // cannot reach the user's localhost.
  const shouldQuery = Boolean(providerId) && !isLocal && hasKey

  const matched = live !== null && live.provider === providerId
  // Memoised so the empty case is a stable reference; a fresh [] each render
  // would re-run the modelOptions memo below on every render.
  const liveModels = useMemo(
    () => (matched && live ? live.models : EMPTY_MODELS),
    [matched, live],
  )
  const liveState: LiveState = !shouldQuery
    ? "idle"
    : matched
      ? live.state
      : "loading"

  useEffect(() => {
    if (!shouldQuery || !providerId) return
    let cancelled = false
    void (async () => {
      let next: { models: AiModel[]; state: "live" | "failed" }
      try {
        const res = await fetch(
          `/api/account/models?provider=${encodeURIComponent(providerId)}`,
          { cache: "no-store" },
        )
        const data = (await res.json()) as { ok?: boolean; models?: AiModel[] }
        next =
          data.ok && data.models && data.models.length > 0
            ? { models: data.models, state: "live" }
            : { models: [], state: "failed" }
      } catch {
        next = { models: [], state: "failed" }
      }
      if (!cancelled) setLive({ provider: providerId, ...next })
    })()
    return () => {
      cancelled = true
    }
  }, [providerId, shouldQuery])

  const modelOptions = useMemo(() => {
    if (!selected) return []
    if (isLocal && installedLocalModels.length > 0) {
      const labels = new Map(selected.models.map((m) => [m.id, m.label]))
      return installedLocalModels.map((id) => ({
        id,
        label: labels.get(id) ?? id,
      }))
    }
    if (liveModels.length > 0) return liveModels
    return selected.models
  }, [selected, isLocal, installedLocalModels, liveModels])

  // Never show a model the engine cannot serve: if the saved pick is gone,
  // fall back to the first one that is actually available.
  const currentModel = selected
    ? modelOptions.some((m) => m.id === model)
      ? (model as string)
      : (modelOptions[0]?.id ?? resolveModel(selected, model))
    : ""

  // Discovery is async: the saved model may only turn out to be missing once
  // the provider answers. Write the corrected pick back into the draft so
  // saving persists the model the user can actually see selected.
  useEffect(() => {
    if (selected && currentModel && currentModel !== model) {
      onChange(selected.id, currentModel)
    }
  }, [selected, currentModel, model, onChange])

  const modelHint = isLocal
    ? installedLocalModels.length > 0
      ? t("account.aiKeys.installedOnMachine")
      : undefined
    : liveState === "live"
      ? t("account.aiKeys.fromProvider")
      : liveState === "loading"
        ? t("account.aiKeys.loadingModels")
        : liveState === "failed"
          ? t("account.aiKeys.catalogueFallback")
          : undefined

  return (
    <div className="rounded-xl border border-hairline bg-ink-900/40 p-3.5">
      <Field label={label}>
        <Select
          value={provider ?? ""}
          onChange={(e) => {
            const id = e.target.value || null
            const p = id ? getProvider(id) : null
            if (!p) {
              onChange(null, null)
              return
            }
            const first =
              p.allowCustomModels && installedLocalModels.length > 0
                ? installedLocalModels[0]
                : p.defaultModel
            onChange(id, first)
          }}
        >
          <option value="">{t("account.aiKeys.noneBasic")}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.needsKey ? "" : ` — ${t("account.aiKeys.localSuffix")}`}
              {readiness[p.id] ? "" : ` (${t("account.aiKeys.notReady")})`}
            </option>
          ))}
        </Select>
      </Field>

      {selected ? (
        <div className="mt-3">
          <Field label={t("account.aiKeys.model")} hint={modelHint}>
            <Select
              value={currentModel}
              onChange={(e) => onChange(selected.id, e.target.value)}
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {selected && !ready ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/90">
          {selected.needsKey
            ? t("account.aiKeys.addKeyHint")
            : t("account.aiKeys.startOllamaHint")}
        </p>
      ) : null}
    </div>
  )
}

function StatusPill({
  tone,
  children,
}: {
  tone: "on" | "off"
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
        tone === "on"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-hairline bg-white/[0.03] text-ink-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tone === "on" ? "bg-emerald-400" : "bg-ink-600"
        }`}
      />
      {children}
    </span>
  )
}

function ProviderHeader({
  provider,
  pill,
  apiKeyLabel,
  localNoKeyLabel,
}: {
  provider: AiProvider
  pill: React.ReactNode
  apiKeyLabel: string
  localNoKeyLabel: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-ink-950"
          style={{ backgroundColor: provider.accent }}
        >
          {provider.name.slice(0, 1)}
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-50">{provider.name}</p>
          <p className="text-[11px] text-ink-500">
            {provider.needsKey ? apiKeyLabel : localNoKeyLabel}
          </p>
        </div>
      </div>
      {pill}
    </div>
  )
}

function KeyProviderCard({
  provider,
  status,
  onChanged,
}: {
  provider: AiProvider
  status: KeyStatus | null
  onChanged: () => void | Promise<void>
}) {
  const t = useT()
  const locale = useLocale()
  const [value, setValue] = useState("")
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null)
  const [note, setNote] = useState<Note | null>(null)

  const save = async () => {
    if (!value.trim()) return
    setBusy("save")
    setNote(null)
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, key: value.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNote({
          type: "error",
          msg: data.error ?? t("account.aiKeys.keySaveError"),
        })
        return
      }
      setValue("")
      setNote({ type: "success", msg: t("account.aiKeys.keySaved") })
      await onChanged()
    } catch {
      setNote({ type: "error", msg: t("account.aiKeys.networkError") })
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    setBusy("test")
    setNote(null)
    try {
      const res = await fetch("/api/account/api-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.id,
          key: value.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setNote({ type: "success", msg: t("account.aiKeys.testOk") })
      } else {
        setNote({
          type: "error",
          msg: data.error ?? t("account.aiKeys.testFailed"),
        })
      }
    } catch {
      setNote({ type: "error", msg: t("account.aiKeys.networkError") })
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy("remove")
    setNote(null)
    try {
      const res = await fetch(
        `/api/account/api-keys?provider=${encodeURIComponent(provider.id)}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        setNote({ type: "error", msg: t("account.aiKeys.removeError") })
        return
      }
      await onChanged()
    } catch {
      setNote({ type: "error", msg: t("account.aiKeys.networkError") })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-hairline bg-ink-900/40 p-4">
      <ProviderHeader
        provider={provider}
        apiKeyLabel={t("account.aiKeys.apiKeyLabel")}
        localNoKeyLabel={t("account.aiKeys.localNoKey")}
        pill={
          status ? (
            <StatusPill tone="on">····{status.last4}</StatusPill>
          ) : (
            <StatusPill tone="off">{t("account.aiKeys.notSet")}</StatusPill>
          )
        }
      />
      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-400">
        {providerCopy(provider.id, locale).blurb}
      </p>

      <div className="mt-3 space-y-2">
        <div className="relative">
          <TextInput
            type={reveal ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              status
                ? t("account.aiKeys.pasteNewKey")
                : t("account.aiKeys.pasteKey", { provider: provider.name })
            }
            autoComplete="off"
            spellCheck={false}
            className="pr-10 font-mono text-[13px]"
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={
              reveal ? t("account.aiKeys.hideKey") : t("account.aiKeys.showKey")
            }
            className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:text-ink-200"
          >
            {reveal ? "🙈" : "👁"}
          </button>
        </div>

        {note ? <StatusNote type={note.type}>{note.msg}</StatusNote> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy !== null || !value.trim()}
            className="inline-flex h-8 items-center rounded-full bg-brand-500 px-3.5 text-[13px] font-semibold text-ink-950 transition hover:bg-brand-400 disabled:opacity-50"
          >
            {busy === "save"
              ? t("account.aiKeys.saving")
              : t("account.aiKeys.save")}
          </button>
          <button
            type="button"
            onClick={test}
            disabled={busy !== null || (!value.trim() && !status)}
            className="inline-flex h-8 items-center rounded-full border border-hairline bg-white/[0.04] px-3.5 text-[13px] font-medium text-ink-100 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {busy === "test"
              ? t("account.aiKeys.testing")
              : t("account.aiKeys.test")}
          </button>
          {status ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-red-300/80 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
            >
              {busy === "remove"
                ? t("account.aiKeys.removing")
                : t("account.aiKeys.remove")}
            </button>
          ) : null}
          {provider.keyUrl ? (
            <a
              href={provider.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[12px] font-medium text-brand-300 hover:underline"
            >
              {t("account.aiKeys.getKey")}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function LocalProviderCard({
  provider,
  status,
  models,
  onRetry,
}: {
  provider: AiProvider
  status: OllamaStatus
  models: string[]
  onRetry: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const available = status === "available"
  return (
    <div className="flex flex-col rounded-xl border border-hairline bg-ink-900/40 p-4">
      <ProviderHeader
        provider={provider}
        apiKeyLabel={t("account.aiKeys.apiKeyLabel")}
        localNoKeyLabel={t("account.aiKeys.localNoKey")}
        pill={
          status === "checking" ? (
            <StatusPill tone="off">{t("account.aiKeys.checking")}</StatusPill>
          ) : available ? (
            <StatusPill tone="on">{t("account.aiKeys.detected")}</StatusPill>
          ) : (
            <StatusPill tone="off">{t("account.aiKeys.offline")}</StatusPill>
          )
        }
      />
      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-400">
        {providerCopy(provider.id, locale).blurb}
      </p>

      {available ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
            {t(
              models.length === 1
                ? "account.aiKeys.modelsReadyOne"
                : "account.aiKeys.modelsReadyOther",
              { count: models.length },
            )}
          </p>
          {models.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {models.slice(0, 4).map((m) => (
                <li
                  key={m}
                  className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-ink-300"
                >
                  {m}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] leading-relaxed text-ink-400">
            {t("account.aiKeys.notDetected")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-8 items-center rounded-full border border-hairline bg-white/[0.04] px-3.5 text-[13px] font-medium text-ink-100 transition hover:bg-white/[0.08]"
            >
              {t("account.aiKeys.retryDetection")}
            </button>
            <Link
              href="/ai-setup#ollama"
              className="text-[12px] font-medium text-brand-300 hover:underline"
            >
              {t("account.aiKeys.howToSetUp")}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
