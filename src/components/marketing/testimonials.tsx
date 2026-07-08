import { FadeIn } from "@/components/animations/fade-in"
import { SectionHeading } from "@/components/ui/section-heading"
import { getT } from "@/lib/i18n/server"

const QUOTES = [
  {
    quote:
      "I used to open three browser tabs to compare a EuroLeague guard with an NBA prospect. Now it's one click. The normalization is the real deal.",
    name: "Álvaro Martínez",
  },
  {
    quote:
      "We brought GlobalHoopStats into our pre-draft process. The AI advisor cut our film room debates in half — the numbers don't lie.",
    name: "Mike Torres",
  },
  {
    quote:
      "Finally — a tool that treats Primera FEB and the NBA like they're the same sport. Our international scouting pipeline lives here now.",
    name: "David Clemente",
  },
]

export async function Testimonials() {
  const { t } = await getT()
  return (
    <section className="full-bleed relative py-14 sm:py-20">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-surface-0 via-transparent to-surface-0"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <FadeIn>
          <SectionHeading
            align="center"
            eyebrow={t("home.testimonials.eyebrow")}
            title={
              <>
                {t("home.testimonials.titleA")}{" "}
                <span className="text-gradient-brand">
                  {t("home.testimonials.titleB")}
                </span>
              </>
            }
          />
        </FadeIn>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <FadeIn key={q.name} delay={0.08 * (i + 1)} y={20}>
              <article className="gh-card relative flex h-full flex-col p-6 sm:p-7">
                <svg
                  aria-hidden
                  className="mb-3 h-6 w-6 text-brand-400/40"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="flex-1 text-pretty text-sm leading-relaxed text-ink-200 sm:text-[15px]">
                  &ldquo;{q.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-300">
                    {q.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-50">{q.name}</p>
                  </div>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
