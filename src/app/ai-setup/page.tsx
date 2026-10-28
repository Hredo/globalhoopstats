import type { Metadata } from "next"
import Link from "next/link"
import { AI_PROVIDERS, modelPageUrl } from "@/lib/ai/providers"
import { providerCopy } from "@/lib/ai/provider-copy"
import { getLiveCatalog, type LiveProvider } from "@/lib/ai/catalog-live"
import { getT } from "@/lib/i18n/server"
import { pageSeo } from "@/lib/seo/metadata"
import type { Locale } from "@/lib/i18n/config"
import type { ClientTranslator } from "@/lib/i18n/provider"

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT()
  return pageSeo({
    locale,
    path: "/ai-setup",
    title: t("aiSetup.metaTitle"),
    description: t("aiSetup.metaDescription"),
  })
}

export default async function AiSetupPage() {
  const { t, locale } = await getT()
  const local = AI_PROVIDERS.filter((p) => !p.needsKey)
  const cloud = AI_PROVIDERS.filter((p) => p.needsKey)
  // A cold cache must not hold the page: past the wait the guide renders with
  // the static fallback and the next visitor gets the live list.
  const live = await getLiveCatalog(3_000)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-2xl">
        <p className="gh-eyebrow text-brand-300">{t("aiSetup.eyebrow")}</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-4xl">
          {t("aiSetup.title")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-300">
          {t("aiSetup.introBefore")}{" "}
          <span className="text-ink-100">{t("aiSetup.introEmphasis")}</span>
          {t("aiSetup.introAfter")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/account/ai-keys"
            className="inline-flex h-11 items-center rounded-full bg-brand-500 px-6 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400"
          >
            {t("aiSetup.openSettings")}
          </Link>
          <Link
            href="/ai-advisor"
            className="inline-flex h-11 items-center rounded-full border border-hairline bg-white/[0.04] px-6 text-sm font-medium text-ink-100 transition hover:bg-white/[0.08]"
          >
            {t("aiSetup.tryAdvisor")}
          </Link>
        </div>
      </header>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <HowCard
          step={t("aiSetup.optionA")}
          title={t("aiSetup.localTitle")}
          body={t("aiSetup.localBody")}
        />
        <HowCard
          step={t("aiSetup.optionB")}
          title={t("aiSetup.cloudTitle")}
          body={t("aiSetup.cloudBody")}
        />
      </section>

      <section id="ollama" className="mt-14">
        <SectionTitle
          eyebrow={t("aiSetup.localEyebrow")}
          title={t("aiSetup.ollamaTitle")}
        />
        {local.map((p) => (
          <ProviderGuide
            key={p.id}
            provider={p}
            live={live?.providers[p.id]}
            locale={locale}
            t={t}
          />
        ))}
      </section>

      <section className="mt-14">
        <SectionTitle
          eyebrow={t("aiSetup.cloudEyebrow")}
          title={t("aiSetup.cloudProviders")}
        />
        <div className="space-y-4">
          {cloud.map((p) => (
            <ProviderGuide
              key={p.id}
              provider={p}
              live={live?.providers[p.id]}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-hairline bg-surface-1/60 p-6">
        <h2 className="font-display text-lg font-bold text-ink-50">
          {t("aiSetup.safetyTitle")}
        </h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-300">
          <li className="flex gap-2">
            <Dot /> {t("aiSetup.safety1")}
          </li>
          <li className="flex gap-2">
            <Dot /> {t("aiSetup.safety2")}
          </li>
          <li className="flex gap-2">
            <Dot /> {t("aiSetup.safety3Before")}{" "}
            <Link
              href="/account/ai-keys"
              className="text-brand-300 hover:underline"
            >
              {t("account.nav.aiKeys")}
            </Link>
            {t("aiSetup.safety3After")}
          </li>
        </ul>
      </section>

      <div className="mt-12 flex justify-center">
        <Link
          href="/account/ai-keys"
          className="inline-flex h-11 items-center rounded-full bg-brand-500 px-6 text-sm font-semibold text-ink-950 shadow-[var(--shadow-brand-glow)] transition hover:bg-brand-400"
        >
          {t("aiSetup.connectProvider")}
        </Link>
      </div>
    </div>
  )
}

function HowCard({
  step,
  title,
  body,
}: {
  step: string
  title: string
  body: string
}) {
  return (
    <div className="gh-card rounded-2xl border border-hairline bg-surface-1/60 p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-brand-300">
        {step}
      </p>
      <h3 className="mt-2 font-display text-lg font-bold text-ink-50">
        {title}
      </h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-400">{body}</p>
    </div>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold text-ink-50">
        {title}
      </h2>
    </div>
  )
}

function ProviderGuide({
  provider,
  live,
  locale,
  t,
}: {
  provider: (typeof AI_PROVIDERS)[number]
  live: LiveProvider | undefined
  locale: Locale
  t: ClientTranslator
}) {
  const copy = providerCopy(provider.id, locale)
  // Live newest models when models.dev answered; the hand-written fallback
  // list otherwise (local engines are never in models.dev).
  const latest = live?.latest.length
    ? live.latest.map((m) => ({ id: m.id, name: m.name }))
    : provider.models.map((m) => ({ id: m.id, name: m.label }))
  return (
    <div className="rounded-2xl border border-hairline bg-surface-1/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-ink-950"
            style={{ backgroundColor: provider.accent }}
          >
            {provider.name.slice(0, 1)}
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink-50">
              {provider.name}
            </h3>
            <p className="text-[13px] text-ink-400">{copy.blurb}</p>
          </div>
        </div>
        {provider.keyUrl ? (
          <a
            href={provider.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-full border border-brand-500/40 bg-brand-500/10 px-4 text-[13px] font-semibold text-brand-200 transition hover:bg-brand-500/20"
          >
            {provider.needsKey
              ? t("account.aiKeys.getKey")
              : t("aiSetup.download")}
          </a>
        ) : null}
      </div>

      <ol className="mt-4 space-y-2.5">
        {copy.guide.map((step, i) => (
          <li key={i} className="flex gap-3 text-[14px] text-ink-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-ink-300">
              {i + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      {latest.length > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-500">
          <span className="uppercase tracking-widest">
            {live?.latest.length ? t("aiSetup.latest") : t("aiSetup.models")}
          </span>
          {latest.map((m) => (
            <a
              key={m.id}
              href={modelPageUrl(provider, m.id)}
              target="_blank"
              rel="noopener noreferrer"
              title={m.id}
              className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-ink-300 transition hover:bg-white/[0.08] hover:text-ink-100"
            >
              {m.name}
            </a>
          ))}
        </p>
      ) : null}

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-400 hover:text-ink-200 hover:underline"
        >
          {t("account.aiKeys.docsLink")}
        </a>
        {provider.pricingUrl ? (
          <a
            href={provider.pricingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-400 hover:text-ink-200 hover:underline"
          >
            {t("account.aiKeys.pricingLink")}
          </a>
        ) : null}
      </p>
    </div>
  )
}

function Dot() {
  return (
    <span
      aria-hidden
      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
    />
  )
}
