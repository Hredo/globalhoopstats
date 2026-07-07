"use client"

import { useState, type CSSProperties } from "react"
import { FadeIn } from "@/components/animations/fade-in"
import { Eyebrow } from "@/components/ui/eyebrow"
import { useLocale } from "@/lib/i18n/provider"
import { getDictionary } from "@/lib/i18n/dictionaries"

type Platform = "ios" | "android"

const STEPS_IOS = [
  { icon: SafariIcon, titleKey: "step1Title", descKey: "step1Desc" },
  { icon: ShareIcon, titleKey: "step2Title", descKey: "step2Desc" },
  { icon: PlusIcon, titleKey: "step3Title", descKey: "step3Desc" },
  { icon: CheckIcon, titleKey: "step4Title", descKey: "step4Desc" },
]

const STEPS_ANDROID = [
  { icon: ChromeIcon, titleKey: "step1Title", descKey: "step1Desc" },
  { icon: DotsIcon, titleKey: "step2Title", descKey: "step2Desc" },
  { icon: PlusIcon, titleKey: "step3Title", descKey: "step3Desc" },
  { icon: CheckIcon, titleKey: "step4Title", descKey: "step4Desc" },
]

export function MobileInstall() {
  const locale = useLocale()
  const t = (key: string) => {
    const dict = getDictionary(locale)
    const keys = key.split(".")
    let val: unknown = dict
    for (const k of keys) {
      if (val && typeof val === "object" && k in (val as Record<string, unknown>))
        val = (val as Record<string, unknown>)[k]
    }
    return String(val ?? key)
  }
  const [platform, setPlatform] = useState<Platform>("ios")
  const steps = platform === "ios" ? STEPS_IOS : STEPS_ANDROID
  const prefix = "home.mobileInstall"

  return (
    <section className="full-bleed relative py-20 sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-surface-0 via-transparent to-surface-0"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow className="justify-center">
              {t(`${prefix}.eyebrow`)}
            </Eyebrow>
            <h2 className="text-display mt-5 text-balance text-3xl text-ink-50 sm:text-4xl md:text-[3.1rem]">
              {t(`${prefix}.titleA`)}{" "}
              <span className="text-gradient-brand">
                {t(`${prefix}.titleB`)}
              </span>
            </h2>
            <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-200 sm:text-lg [&:not(:last-child)]:mx-auto">
              {t(`${prefix}.description`)}
            </p>
          </div>
        </FadeIn>

        <div className="mt-14 grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <FadeIn delay={0.1}>
            <div
              className="relative mx-auto max-w-[280px] md:max-w-none"
              style={{ perspective: 1600 }}
            >
              {/* 3D flip: the phone spins on its Y axis to reveal the other
                  platform's screen on its back face. Both faces are always
                  mounted (backface-hidden), so switching truly animates —
                  unlike a keyed remount, which would snap with no transition. */}
              <div
                className="preserve-3d relative transition-transform duration-[750ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none"
                style={{
                  transform:
                    platform === "android" ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                <div className="backface-hidden">
                  <PhoneFrame platform="ios" />
                </div>
                <div
                  className="backface-hidden absolute inset-0"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <PhoneFrame platform="android" />
                </div>
              </div>
              <div
                aria-hidden
                className="absolute inset-x-8 bottom-2 -z-10 h-10 rounded-[50%] bg-black/40 blur-2xl"
              />
            </div>
          </FadeIn>

          <div>
            <FadeIn delay={0.15} y={20}>
              <div className="mb-8 flex gap-1.5 rounded-md border border-hairline bg-white/[0.03] p-1.5">
                <button
                  type="button"
                  onClick={() => setPlatform("ios")}
                  className={`text-condensed flex flex-1 items-center justify-center gap-2 rounded-[5px] px-4 py-2.5 text-[11px] tracking-[0.14em] transition-all ${
                    platform === "ios"
                      ? "bg-brand-500/15 text-brand-300"
                      : "text-ink-400 hover:text-ink-200"
                  }`}
                >
                  <AppleIcon />
                  {t(`${prefix}.ios`)}
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform("android")}
                  className={`text-condensed flex flex-1 items-center justify-center gap-2 rounded-[5px] px-4 py-2.5 text-[11px] tracking-[0.14em] transition-all ${
                    platform === "android"
                      ? "bg-brand-500/15 text-brand-300"
                      : "text-ink-400 hover:text-ink-200"
                  }`}
                >
                  <AndroidIcon />
                  {t(`${prefix}.android`)}
                </button>
              </div>
            </FadeIn>

            <ol key={platform} className="space-y-4 sm:space-y-5">
              {steps.map((step, i) => (
                <FadeIn key={step.titleKey} delay={0.08 * (i + 3)} y={16}>
                  <li className="group flex items-start gap-4 rounded-md border border-hairline bg-white/[0.02] p-4 transition hover:border-hairline-strong hover:bg-white/[0.04] sm:p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-400 transition group-hover:bg-brand-500/20">
                      <step.icon />
                    </span>
                    <div className="min-w-0">
                      <span className="text-condensed text-[10px] tracking-[0.16em] text-ink-500">
                        Step {i + 1}
                      </span>
                      <h3 className="mt-0.5 font-display text-sm font-semibold text-ink-50 sm:text-base">
                        {t(`${prefix}.${step.titleKey}`)}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-400">
                        {t(`${prefix}.${step.descKey}`)}
                      </p>
                    </div>
                  </li>
                </FadeIn>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

function PhoneFrame({ platform }: { platform: Platform }) {
  return (
    <div className="relative mx-auto w-fit">
      <svg
        viewBox="0 0 240 480"
        className="h-[420px] w-[210px] sm:h-[480px] sm:w-[240px]"
        role="img"
        aria-label="Phone mockup showing the install screen"
      >
        <defs>
          <linearGradient id="phone-bg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#241d15" />
            <stop offset="50%" stopColor="#171209" />
            <stop offset="100%" stopColor="#0f0b06" />
          </linearGradient>
          <linearGradient id="screen-glow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.6 0.2 50 / 0.15)" />
            <stop offset="100%" stopColor="oklch(0.5 0.2 25 / 0.05)" />
          </linearGradient>
          <clipPath id="screen-clip">
            <rect x="12" y="40" width="216" height="404" rx="16" />
          </clipPath>
        </defs>

        <rect
          x="2" y="2" width="236" height="476" rx="36"
          fill="oklch(0.25 0.02 30)"
          stroke="oklch(0.4 0.03 30)"
          strokeWidth="2"
        />

        <rect
          x="10" y="38" width="220" height="408" rx="18"
          fill="url(#phone-bg)"
        />

        <rect
          x="10" y="38" width="220" height="408" rx="18"
          fill="url(#screen-glow)"
        />

        {platform === "ios" ? <IOSScreenContent /> : <AndroidScreenContent />}

        <rect x="90" y="4" width="60" height="6" rx="3" fill="oklch(0.35 0.02 30)" />

        <rect
          x="12" y="40" width="216" height="404" rx="16"
          fill="none"
          stroke="oklch(0.35 0.02 30 / 0.6)"
          strokeWidth="0.5"
        />
      </svg>

      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[3rem] bg-brand-500/[0.03] blur-3xl"
      />
    </div>
  )
}

function IOSScreenContent() {
  return (
    <g clipPath="url(#screen-clip)">
      <rect x="0" y="0" width="240" height="480" fill="oklch(0.12 0.01 30)" />

      <rect x="16" y="8" width="208" height="44" rx="12" fill="oklch(0.18 0.01 30)" />

      <text x="36" y="20" fontSize="7" fill="oklch(0.6 0 0)" fontFamily="monospace">9:41</text>

      <rect x="36" y="28" width="60" height="10" rx="5" fill="oklch(0.5 0.15 150 / 0.3)" />

      <g transform="translate(16 60)">
        <text x="100" y="10" textAnchor="middle" fontSize="9" fill="oklch(0.8 0 0)" fontFamily="system-ui" fontWeight="600">
          globalhoopstats.es
        </text>

        <rect x="0" y="24" width="208" height="200" rx="10" fill="oklch(0.15 0.01 30)" stroke="oklch(0.25 0.01 30)" strokeWidth="0.5" />

        <rect x="12" y="36" width="120" height="12" rx="4" fill="oklch(0.6 0.2 50 / 0.5)" />
        <rect x="12" y="52" width="80" height="8" rx="3" fill="oklch(0.3 0 0)" />
        <rect x="12" y="66" width="100" height="8" rx="3" fill="oklch(0.25 0 0)" />

        <rect x="12" y="88" width="184" height="120" rx="8" fill="oklch(0.12 0.01 30)" />

        <rect x="20" y="96" width="168" height="6" rx="3" fill="oklch(0.35 0.02 30)" />
        <rect x="20" y="108" width="120" height="6" rx="3" fill="oklch(0.3 0.02 30)" />

        <rect x="20" y="126" width="168" height="6" rx="3" fill="oklch(0.35 0.02 30)" />
        <rect x="20" y="138" width="140" height="6" rx="3" fill="oklch(0.3 0.02 30)" />

        <rect x="20" y="156" width="168" height="6" rx="3" fill="oklch(0.35 0.02 30)" />
        <rect x="20" y="168" width="100" height="6" rx="3" fill="oklch(0.3 0.02 30)" />

        <rect x="20" y="186" width="168" height="6" rx="3" fill="oklch(0.25 0.01 30)" />
      </g>

      <g transform="translate(16 280)">
        <rect x="0" y="0" width="208" height="36" rx="10" fill="oklch(0.22 0.01 30)" />

        <rect x="12" y="8" width="20" height="20" rx="6" fill="oklch(0.5 0.2 50 / 0.4)" />
        <text x="40" y="22" fontSize="9" fill="oklch(0.7 0 0)" fontFamily="system-ui" fontWeight="500">
          globalhoopstats
        </text>
        <text x="196" y="22" textAnchor="end" fontSize="10" fill="oklch(0.5 0.2 50)" fontFamily="system-ui" fontWeight="600">
          Add
        </text>
      </g>

      <text x="16" y="340" fontSize="8" fill="oklch(0.4 0 0)" fontFamily="system-ui" fontWeight="500">
        Add to Home Screen
      </text>

      <text x="16" y="358" fontSize="7" fill="oklch(0.35 0 0)" fontFamily="system-ui">
        Install this web app on your device. The app will
      </text>
      <text x="16" y="370" fontSize="7" fill="oklch(0.35 0 0)" fontFamily="system-ui">
        appear on your home screen and in the app drawer.
      </text>

      <g transform="translate(16 388)">
        <rect x="0" y="0" width="208" height="1" fill="oklch(0.25 0.01 30)" />
      </g>
      <g transform="translate(16 396)">
        <rect x="0" y="0" width="208" height="14" rx="7" fill="oklch(0.18 0.01 30)" />
        <text x="104" y="10" textAnchor="middle" fontSize="8" fill="oklch(0.5 0 0)" fontFamily="system-ui">
          Cancel
        </text>
      </g>
    </g>
  )
}

function AndroidScreenContent() {
  return (
    <g clipPath="url(#screen-clip)">
      <rect x="0" y="0" width="240" height="480" fill="oklch(0.12 0.01 30)" />

      <g transform="translate(0 4)">
        <g transform="translate(8 0)">
          <text x="36" y="10" fontSize="6" fill="oklch(0.5 0 0)" fontFamily="monospace">9:41</text>
          <rect x="88" y="2" width="16" height="8" rx="3" fill="oklch(0.5 0.2 150 / 0.3)" />
          <rect x="110" y="3" width="40" height="6" rx="2" fill="oklch(0.35 0 0)" />
        </g>
      </g>

      <g transform="translate(16 24)">
        <rect x="0" y="0" width="208" height="36" rx="10" fill="oklch(0.18 0.01 30)" />

        <text x="104" y="14" textAnchor="middle" fontSize="8" fill="oklch(0.6 0 0)" fontFamily="system-ui">
          globalhoopstats.es
        </text>

        <g transform="translate(180 8)">
          <circle cx="8" cy="8" r="8" fill="oklch(0.35 0 0)" />
          <circle cx="8" cy="8" r="2" fill="oklch(0.25 0 0)" />
        </g>

        <rect x="0" y="36" width="208" height="200" rx="10" fill="oklch(0.15 0.01 30)" stroke="oklch(0.25 0.01 30)" strokeWidth="0.5" />

        <rect x="12" y="48" width="120" height="12" rx="4" fill="oklch(0.6 0.2 50 / 0.5)" />
        <rect x="12" y="64" width="80" height="8" rx="3" fill="oklch(0.3 0 0)" />
        <rect x="12" y="78" width="100" height="8" rx="3" fill="oklch(0.25 0 0)" />

        <rect x="12" y="100" width="184" height="120" rx="8" fill="oklch(0.12 0.01 30)" />

        <rect x="20" y="108" width="168" height="6" rx="3" fill="oklch(0.35 0.02 30)" />
        <rect x="20" y="120" width="120" height="6" rx="3" fill="oklch(0.3 0.02 30)" />
        <rect x="20" y="138" width="168" height="6" rx="3" fill="oklch(0.35 0.02 30)" />
        <rect x="20" y="150" width="140" height="6" rx="3" fill="oklch(0.3 0.02 30)" />
        <rect x="20" y="168" width="168" height="6" rx="3" fill="oklch(0.35 0.02 30)" />
        <rect x="20" y="180" width="100" height="6" rx="3" fill="oklch(0.3 0.02 30)" />
        <rect x="20" y="198" width="168" height="6" rx="3" fill="oklch(0.25 0.01 30)" />
      </g>

      <g transform="translate(16 282)">
        <rect x="0" y="0" width="208" height="1" fill="oklch(0.25 0.01 30)" />
      </g>

      <g transform="translate(16 296)">
        <rect x="0" y="0" width="208" height="120" rx="12" fill="oklch(0.18 0.01 30)" />

        <text x="104" y="16" textAnchor="middle" fontSize="9" fill="oklch(0.7 0 0)" fontFamily="system-ui" fontWeight="600">
          Add to Home screen
        </text>

        <text x="104" y="34" textAnchor="middle" fontSize="7" fill="oklch(0.4 0 0)" fontFamily="system-ui">
          Install as a standalone app for
        </text>
        <text x="104" y="46" textAnchor="middle" fontSize="7" fill="oklch(0.4 0 0)" fontFamily="system-ui">
          a faster, full-screen experience.
        </text>

        <rect x="16" y="90" width="80" height="14" rx="7" fill="oklch(0.25 0.01 30)" />
        <text x="56" y="100" textAnchor="middle" fontSize="8" fill="oklch(0.5 0 0)" fontFamily="system-ui">Cancel</text>

        <rect x="112" y="90" width="80" height="14" rx="7" fill="oklch(0.6 0.2 50 / 0.4)" />
        <text x="152" y="100" textAnchor="middle" fontSize="8" fill="oklch(0.9 0 0)" fontFamily="system-ui" fontWeight="600">Install</text>
      </g>
    </g>
  )
}

function SafariIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
    </svg>
  )
}

function ChromeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a9 9 0 0 0-7.8 4.5" />
      <path d="M12 2a9 9 0 0 1 7.8 4.5" />
      <path d="M4.2 6.5 12 12" />
      <path d="M19.8 6.5 12 12" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M17.523 14.082a.94.94 0 0 1-.942-.942V9.58a.942.942 0 0 1 1.884 0v3.56a.94.94 0 0 1-.942.942zM6.477 14.082a.94.94 0 0 1-.942-.942V9.58a.942.942 0 0 1 1.884 0v3.56a.94.94 0 0 1-.942.942zM7.228 16.24v3.556a.94.94 0 0 0 .942.942h.942a.94.94 0 0 0 .942-.942V16.24h2.828v3.556a.94.94 0 0 0 .942.942h.942a.94.94 0 0 0 .942-.942V16.24h.942a.94.94 0 0 0 .942-.942v-5.18H5.344v5.18a.94.94 0 0 0 .942.942h.942zM7.228 4.937l-1.82-1.82a.3.3 0 0 1 0-.426.3.3 0 0 1 .426 0l1.984 1.984a5.98 5.98 0 0 1 6.364 0l1.984-1.984a.3.3 0 0 1 .426 0 .3.3 0 0 1 0 .426l-1.82 1.82A5.97 5.97 0 0 1 18.402 9.3H5.598a5.97 5.97 0 0 1 1.63-4.363zm-.86 3.052c.48 0 .87-.39.87-.87s-.39-.87-.87-.87-.87.39-.87.87.39.87.87.87zm11.264 0c.48 0 .87-.39.87-.87s-.39-.87-.87-.87-.87.39-.87.87.39.87.87.87z" />
    </svg>
  )
}
