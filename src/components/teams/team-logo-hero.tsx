import { SmartImage } from "@/components/ui/smart-image"

type Props = {
  src: string | null | undefined
  name: string
  shortName: string | null
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 3)
    .join("")
    .toUpperCase()
}

export function TeamLogoHero({ src, name, shortName }: Props) {
  const fallback = shortName?.slice(0, 3).toUpperCase() || getInitials(name)
  return (
    <div className="team-logo-hero relative isolate flex items-center justify-center">
      <div
        aria-hidden
        className="team-logo-hero__halo pointer-events-none absolute -inset-4 -z-10 rounded-[3rem] opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--team-glow), transparent 65%)",
        }}
      />
      <div className="team-logo-hero__plate relative flex aspect-square w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-8 shadow-[var(--shadow-court)]">
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <SmartImage
            src={src}
            alt={name}
            fit="contain"
            eager
            className="team-logo-hero__img drop-shadow-[0_0_12px_var(--team-glow)]"
            fallbackClassName="font-display text-5xl font-bold text-[var(--team-300)]"
            fallback={fallback}
          />
        </div>
      </div>
    </div>
  )
}
