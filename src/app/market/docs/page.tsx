import Link from "next/link"
import { BackLink } from "@/components/ui/back-link"
import { FadeIn } from "@/components/animations/fade-in"
import { getLocale } from "@/lib/i18n/server"

export const metadata = {
  title: "Market valuation & Trade simulator — Global Hoop Stats",
  description:
    "How our market valuation engine and trade simulator work: algorithm, data sources, league ceilings and practical usage.",
}

// Numeric ceilings are language-agnostic, so the table data is shared. Only the
// human-readable labels (tier names, descriptions) differ per locale.
const LEAGUES = [
  { league: "NBA", strength: "1.0", tier: 1, value: "€60M", salary: "€50M" },
  { league: "EuroLeague", strength: "0.90", tier: 1, value: "€6,5M", salary: "€5M" },
  { league: "ACB", strength: "0.74", tier: 2, value: "€3,5M", salary: "€2,5M" },
  { league: "Primera FEB", strength: "0.52", tier: 3, value: "€120K", salary: "€70K" },
  { league: "Segunda FEB", strength: "0.40", tier: 4, value: "€50K", salary: "€30K" },
  { league: "Tercera FEB", strength: "0.28", tier: 5, value: "€20K", salary: "€12K" },
]

export default async function MarketDocsPage() {
  const locale = await getLocale()
  const es = locale === "es"

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <FadeIn>
        <BackLink
          fallbackHref="/market/trade"
          label={es ? "Volver al simulador" : "Back to simulator"}
          className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-300 transition hover:text-brand-300 sm:mb-6"
        />
      </FadeIn>

      <FadeIn>
        <p className="gh-eyebrow">{es ? "Documentación" : "Documentation"}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.03em] text-ink-50 sm:text-5xl">
          {es
            ? "Valoración de Mercado y Simulador de Traspasos"
            : "Market Valuation & Trade Simulator"}
        </h1>
        <p className="mt-3 text-sm text-ink-300">
          {es
            ? "Cómo funcionan el motor de valoración y el simulador de traspasos de Global Hoop Stats. Esta página explica los algoritmos, las fuentes de datos y cómo interpretar los resultados."
            : "How the Global Hoop Stats valuation engine and trade simulator work. This page explains the algorithms, data sources, and how to interpret the results."}
        </p>
      </FadeIn>

      {es ? <SpanishDocs /> : <EnglishDocs />}

      <FadeIn>
        <div className="mt-12 rounded-xl border border-hairline bg-white/[0.02] p-5 text-center text-sm text-ink-300">
          {es ? "¿Preguntas o sugerencias? " : "Questions or feedback? "}
          <Link href="/contact" className="font-semibold text-brand-300 underline">
            {es ? "Contáctanos" : "Contact us"}
          </Link>
        </div>
      </FadeIn>
    </div>
  )
}

function EnglishDocs() {
  const TIERS = [
    { tier: "78–100", label: "Franchise", desc: "Absolute star. Their production and efficiency are among the best in the competition. Maximum value." },
    { tier: "60–77", label: "Starter", desc: "Consistent player who performs at a starter level on any team in their league." },
    { tier: "42–59", label: "Rotation", desc: "Provides quality minutes off the bench. Can start on weaker teams." },
    { tier: "25–41", label: "Role", desc: "Specialist player with limited but useful contribution in specific contexts." },
    { tier: "0–24", label: "Fringe", desc: "Marginal minutes. No significant market impact." },
  ]

  // Tiers are league-relative. The rating is normalised by sqrt(leagueStrength)
  // before tier assignment, so thresholds are fixed. A player who dominates in
  // Tercera FEB gets a much higher normalised rating than their raw stats would suggest,
  // but the EUR value is still capped by the league's ceiling. A "Franchise" in
  // Tercera FEB is NOT comparable to a "Franchise" in the NBA.

  return (
    <>
      <section className="mt-10 space-y-6">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-50">
            Market Valuation
          </h2>
          <p className="text-sm text-ink-300">
            The valuation is a <strong>transparent heuristic</strong>, not an actual contract or
            buyout figure. There is no public salary database for European basketball, so the engine
            estimates a value based on <strong>statistical production, efficiency, age, league and
            position scarcity</strong>. Each component is shown in the breakdown so the number is
            auditable.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Step-by-step algorithm
          </h3>
          <div className="gh-card space-y-4 p-5 text-sm">
            <Step n={1} title="Production rating (0–70 base)">
              <p className="text-ink-300">
                A composite metric is calculated by weighing per-game statistics:
              </p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-ink-950/50 p-3 font-mono text-[11px] text-ink-200">
                production = PTS + 1.15×AST + 0.8×REB + 2.0×STL + 2.0×BLK
              </pre>
              <p className="text-ink-300">
                Steals and blocks get the highest weight because they are rare events with
                high defensive signal. The result is scaled to a maximum of 70.
              </p>
            </Step>

            <Step n={2} title="Efficiency adjustment">
              <p className="text-ink-300">
                Bonuses are added based on available advanced stats (TS%, PER, BPM,
                Win Shares). Each one is centered on a neutral baseline:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-ink-300">
                <li>TS%: (value - 0.55) × 55 (neutral = 55%)</li>
                <li>PER: (value - 15) × 0.7 (neutral = 15)</li>
                <li>BPM: value × 1.4</li>
                <li>Win Shares: value × 1.2</li>
              </ul>
              <p className="mt-2 text-ink-300">
                If a metric is not available (e.g. lower leagues), it contributes 0 — no
                penalty.
              </p>
            </Step>

            <Step n={3} title="League normalisation">
              <p className="text-ink-300">
                The raw rating is then normalised by the league&apos;s strength so that a
                player&apos;s standing within their own league is reflected on the 0–100
                scale:
              </p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-ink-950/50 p-3 font-mono text-[11px] text-ink-200">
                rating = rawRating / sqrt(leagueStrength)
              </pre>
              <p className="text-ink-300">
                For the NBA (strength 1.0) the rating stays unchanged. For weaker
                leagues the divisor is smaller, so the rating rises — a dominant
                player in Tercera FEB (strength 0.28) gets roughly 1.9× their raw rating.
                This means the best players in every league can reach 90–100 within
                their context, but their EUR value remains capped by the league&apos;s
                economic ceiling.
              </p>
            </Step>

            <Step n={4} title="Convex value curve">
              <p className="text-ink-300">
                Market value follows a convex curve — stars are
                disproportionately expensive:
              </p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-ink-950/50 p-3 font-mono text-[11px] text-ink-200">
                curve = (rating / 100)²¹
                rawValue = curve × leagueCeiling × ageFactor × scarcity
              </pre>
              <p className="text-ink-300">
                The 2.1 exponent means a player with an 80 rating is worth much more than double
                one with a 40 rating.
              </p>
            </Step>

            <Step n={5} title="Age factor">
              <p className="text-ink-300">
                Age adjusts value with a youth premium and veteran discount:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-ink-300">
                <li>≤19 years: ×1.12 (projection premium)</li>
                <li>20–23: linear decline 1.12 → 1.04</li>
                <li>24–28: ×1.0 (peak value)</li>
                <li>29–32: decline 1.0 → 0.72</li>
                <li>&gt;32: accelerated decline to 0.45</li>
              </ul>
            </Step>

            <Step n={6} title="Position scarcity">
              <p className="text-ink-300">
                Point guards and true centers get a premium for their scarcity:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-ink-300">
                <li>Center (C / 5): ×1.08</li>
                <li>Point guard (PG / 1 / G): ×1.06</li>
                <li>Others: ×1.0</li>
              </ul>
            </Step>

            <Step n={7} title="League ceiling">
              <p className="text-ink-300">
                Each league has a value and salary ceiling that limits the curve. A Segunda FEB
                player can never be worth as much as an ACB player because their league&apos;s ceiling
                is much lower. Ceilings are based on specialized press reports.
              </p>
            </Step>
          </div>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            League salary ceilings
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  <th className="pb-2 pr-4">League</th>
                  <th className="pb-2 pr-4">Strength</th>
                  <th className="pb-2 pr-4">Tier</th>
                  <th className="pb-2 pr-4">Value ceiling</th>
                  <th className="pb-2 pr-4">Salary ceiling</th>
                </tr>
              </thead>
              <tbody>
                {LEAGUES.map((l) => (
                  <tr
                    key={l.league}
                    className="border-b border-hairline/50 text-ink-200"
                  >
                    <td className="py-2 pr-4 font-semibold text-ink-100">
                      {l.league}
                    </td>
                    <td className="py-2 pr-4">{l.strength}</td>
                    <td className="py-2 pr-4">{l.tier}</td>
                    <td className="py-2 pr-4">{l.value}</td>
                    <td className="py-2 pr-4">{l.salary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Sources: BasketNews, Eurohoops, solobasket, hispanosnba, cronicaglobal (2024–26).
            The NBA is included as a reference but is isolated from the European market.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Categories (tiers)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  <th className="pb-2 pr-4">Rating</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Description</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr
                    key={t.tier}
                    className="border-b border-hairline/50 text-ink-200"
                  >
                    <td className="py-2 pr-4 font-mono text-ink-100">{t.tier}</td>
                    <td className="py-2 pr-4 font-semibold text-ink-100">
                      {t.label}
                    </td>
                    <td className="py-2 pr-4 text-ink-300">{t.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            <strong className="text-ink-200">League-relative scaling:</strong>{" "}
            The thresholds are fixed (78/60/42/25) because the rating is already
            normalised by <code className="text-ink-200">sqrt(leagueStrength)</code>.
            A dominant player in Tercera FEB gets a much higher normalised rating than
            their raw stats would suggest, so they can reach &quot;Franchise&quot;
            within their league context. A <strong>Franchise</strong> in Tercera FEB means
            world-beater <em>for that level</em>, not a Franchise-calibre player
            in the NBA. Each category badge shows the league name so there is no
            confusion across competitions.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Confidence
          </h3>
          <p className="text-sm text-ink-300">
            Confidence indicates how reliable the valuation is based on sample size:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-ink-300">
            <li><strong className="text-emerald-400">High</strong> — ≥15 games played</li>
            <li><strong className="text-amber-400">Medium</strong> — 8–14 games</li>
            <li><strong className="text-ink-400">Low</strong> — &lt;8 games (small sample)</li>
          </ul>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Data sources
          </h3>
          <p className="text-sm text-ink-300">
            The engine is fed exclusively from current season data stored in our PostgreSQL database.
            Statistics come from official sources for each league (NBA, EuroLeague, ACB, FEB). No
            external salary APIs are used — all figures are heuristic estimates based on the
            player&apos;s production and the economic ceilings defined per league.
          </p>
        </FadeIn>
      </section>

      <section className="mt-12 space-y-6">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-50">
            Trade Simulator
          </h2>
          <p className="text-sm text-ink-300">
            The simulator finds balanced trade scenarios for a given player.
            Given a player with estimated value V, it explores the market pool in adjacent
            leagues and builds packages of 1, 2 or 3 players whose combined value is
            close to V.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            How it works
          </h3>
          <div className="gh-card space-y-4 p-5 text-sm">
            <Step n={1} title="Find the player">
              Search for the player you want to trade. The simulator gets their current market
              valuation.
            </Step>
            <Step n={2} title="Explore the market">
              The system examines all players in adjacent leagues (same league, above and
              below within the same ecosystem). It filters pieces that:
              <ul className="ml-4 mt-1 list-disc space-y-1 text-ink-300">
                <li>Are on <strong>other teams</strong> (not the outgoing player&apos;s team)</li>
                <li>Have a value between <strong>15% and 110%</strong> of V</li>
                <li>Match the <strong>desired position</strong> (if specified)</li>
              </ul>
            </Step>
            <Step n={3} title="Generate combinations">
              The engine generates combinations of 1, 2 and 3 players whose combined value is
              within the balance window (80% – 125% of V).
            </Step>
            <Step n={4} title="Sort results">
              Scenarios are sorted by proximity to perfect balance (1.0). At equal
              distance, packages with fewer players are preferred.
            </Step>
          </div>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Balance window
          </h3>
          <p className="text-sm text-ink-300">
            The balance ratio is calculated as value received ÷ value given:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-ink-300">
            <li><strong className="text-emerald-400">0.95 – 1.08:</strong> Balanced trade</li>
            <li><strong className="text-amber-400">&lt; 0.95:</strong> You&apos;re short — ask for more</li>
            <li><strong className="text-amber-400">&gt; 1.08:</strong> You receive more value than you give</li>
          </ul>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Adjacent leagues
          </h3>
          <p className="text-sm text-ink-300">
            The simulator searches in leagues of the same tier or one step above/below. The NBA is
            isolated from the European market — an ACB team would not receive NBA player
            suggestions. This keeps results realistic for the Spanish and European basketball
            context.
          </p>
        </FadeIn>
      </section>

      <section className="mt-12 space-y-6">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-50">
            Limitations
          </h2>
          <ul className="ml-4 list-disc space-y-2 text-sm text-ink-300">
            <li>
              <strong>No real salary data.</strong> Figures are heuristic
              estimates, not actual contract clauses.
            </li>
            <li>
              <strong>Does not consider injuries.</strong> The highest-rated player may
              be injured — the system doesn&apos;t know.
            </li>
            <li>
              <strong>Does not consider player preferences.</strong> A player may not
              want to change teams or leagues.
            </li>
            <li>
              <strong>Current season only.</strong> The valuation uses current
              season data, not full career history.
            </li>
            <li>
              <strong>Does not consider team dynamics.</strong> Tactical fit, actual
              salary, locker-room impact, etc., are not modeled.
            </li>
          </ul>
        </FadeIn>
      </section>
    </>
  )
}

function SpanishDocs() {
  const TIERS = [
    { tier: "78–100", label: "Franquicia", desc: "Estrella absoluta. Su producción y eficiencia están entre las mejores de la competición. Valor máximo." },
    { tier: "60–77", label: "Titular", desc: "Jugador consistente que rinde a nivel de titular en cualquier equipo de su liga." },
    { tier: "42–59", label: "Rotación", desc: "Aporta minutos de calidad desde el banquillo. Puede ser titular en equipos más débiles." },
    { tier: "25–41", label: "Rol", desc: "Jugador especialista con una contribución limitada pero útil en contextos específicos." },
    { tier: "0–24", label: "Fondo de armario", desc: "Minutos marginales. Sin impacto significativo en el mercado." },
  ]

  return (
    <>
      <section className="mt-10 space-y-6">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-50">
            Valoración de mercado
          </h2>
          <p className="text-sm text-ink-300">
            La valoración es una <strong>heurística transparente</strong>, no una cifra real de
            contrato o cláusula de rescisión. No existe una base de datos pública de salarios para el
            baloncesto europeo, por lo que el motor estima un valor basándose en la{" "}
            <strong>producción estadística, la eficiencia, la edad, la liga y la escasez por
            posición</strong>. Cada componente se muestra en el desglose para que la cifra sea
            auditable.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Algoritmo paso a paso
          </h3>
          <div className="gh-card space-y-4 p-5 text-sm">
            <Step n={1} title="Valoración de producción (base 0–70)">
              <p className="text-ink-300">
                Se calcula una métrica compuesta ponderando las estadísticas por partido:
              </p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-ink-950/50 p-3 font-mono text-[11px] text-ink-200">
                producción = PTS + 1.15×AST + 0.8×REB + 2.0×ROB + 2.0×TAP
              </pre>
              <p className="text-ink-300">
                Los robos y tapones reciben el mayor peso porque son eventos poco frecuentes con
                alta señal defensiva. El resultado se escala a un máximo de 70.
              </p>
            </Step>

            <Step n={2} title="Ajuste por eficiencia">
              <p className="text-ink-300">
                Se añaden bonificaciones según las estadísticas avanzadas disponibles (TS%, PER,
                BPM, Win Shares). Cada una se centra en una línea base neutral:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-ink-300">
                <li>TS%: (valor - 0,55) × 55 (neutral = 55%)</li>
                <li>PER: (valor - 15) × 0,7 (neutral = 15)</li>
                <li>BPM: valor × 1,4</li>
                <li>Win Shares: valor × 1,2</li>
              </ul>
              <p className="mt-2 text-ink-300">
                Si una métrica no está disponible (p. ej. en ligas inferiores), aporta 0 — sin
                penalización.
              </p>
            </Step>

            <Step n={3} title="Normalización por liga">
              <p className="text-ink-300">
                La valoración cruda se normaliza por la fuerza de la liga para que
                el nivel del jugador dentro de su propia competición se refleje en
                la escala 0–100:
              </p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-ink-950/50 p-3 font-mono text-[11px] text-ink-200">
                valoración = valoraciónCruda / sqrt(fuerzaLiga)
              </pre>
              <p className="text-ink-300">
                En la NBA (fuerza 1,0) la valoración no cambia. En ligas más
                débiles el divisor es menor, por lo que la valoración sube — un
                jugador dominante en Tercera FEB (fuerza 0,28) recibe aproximadamente 1,9×
                su valoración cruda. Esto permite que los mejores de cada liga
                lleguen a 90–100 en su contexto, pero su valor en EUR sigue
                limitado por el techo económico de la liga.
              </p>
            </Step>

            <Step n={4} title="Curva de valor convexa">
              <p className="text-ink-300">
                El valor de mercado sigue una curva convexa — las estrellas son
                desproporcionadamente caras:
              </p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-ink-950/50 p-3 font-mono text-[11px] text-ink-200">
                curva = (valoración / 100)²¹
                valorBruto = curva × techoLiga × factorEdad × escasez
              </pre>
              <p className="text-ink-300">
                El exponente 2,1 significa que un jugador con una valoración de 80 vale mucho más del
                doble que uno con 40.
              </p>
            </Step>

            <Step n={5} title="Factor de edad">
              <p className="text-ink-300">
                La edad ajusta el valor con una prima por juventud y un descuento por veteranía:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-ink-300">
                <li>≤19 años: ×1,12 (prima por proyección)</li>
                <li>20–23: descenso lineal 1,12 → 1,04</li>
                <li>24–28: ×1,0 (valor máximo)</li>
                <li>29–32: descenso 1,0 → 0,72</li>
                <li>&gt;32: descenso acelerado hasta 0,45</li>
              </ul>
            </Step>

            <Step n={6} title="Escasez por posición">
              <p className="text-ink-300">
                Los bases y los pívots puros reciben una prima por su escasez:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-ink-300">
                <li>Pívot (C / 5): ×1,08</li>
                <li>Base (PG / 1 / G): ×1,06</li>
                <li>Otros: ×1,0</li>
              </ul>
            </Step>

            <Step n={7} title="Techo de liga">
              <p className="text-ink-300">
                Cada liga tiene un techo de valor y salario que limita la curva. Un jugador de LEB
                Plata nunca puede valer tanto como uno de ACB porque el techo de su liga es mucho
                más bajo. Los techos se basan en informes de prensa especializada.
              </p>
            </Step>
          </div>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Techos salariales por liga
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  <th className="pb-2 pr-4">Liga</th>
                  <th className="pb-2 pr-4">Fuerza</th>
                  <th className="pb-2 pr-4">Nivel</th>
                  <th className="pb-2 pr-4">Techo de valor</th>
                  <th className="pb-2 pr-4">Techo salarial</th>
                </tr>
              </thead>
              <tbody>
                {LEAGUES.map((l) => (
                  <tr
                    key={l.league}
                    className="border-b border-hairline/50 text-ink-200"
                  >
                    <td className="py-2 pr-4 font-semibold text-ink-100">
                      {l.league}
                    </td>
                    <td className="py-2 pr-4">{l.strength}</td>
                    <td className="py-2 pr-4">{l.tier}</td>
                    <td className="py-2 pr-4">{l.value}</td>
                    <td className="py-2 pr-4">{l.salary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Fuentes: BasketNews, Eurohoops, solobasket, hispanosnba, cronicaglobal (2024–26).
            La NBA se incluye como referencia pero está aislada del mercado europeo.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Categorías (niveles)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  <th className="pb-2 pr-4">Valoración</th>
                  <th className="pb-2 pr-4">Categoría</th>
                  <th className="pb-2 pr-4">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr
                    key={t.tier}
                    className="border-b border-hairline/50 text-ink-200"
                  >
                    <td className="py-2 pr-4 font-mono text-ink-100">{t.tier}</td>
                    <td className="py-2 pr-4 font-semibold text-ink-100">
                      {t.label}
                    </td>
                    <td className="py-2 pr-4 text-ink-300">{t.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            <strong className="text-ink-200">Escalado por liga:</strong>{" "}
            Los umbrales son fijos (78/60/42/25) porque la valoración ya viene
            normalizada por <code className="text-ink-200">sqrt(fuerzaLiga)</code>.
            Un jugador dominante en Tercera FEB recibe una valoración normalizada mucho
            mayor de lo que sugieren sus estadísticas brutas, por lo que puede
            alcanzar &quot;Franquicia&quot; dentro de su contexto. Un{" "}
            <strong>Franquicia</strong> en Tercera FEB significa que es el mejor
            <em>para ese nivel</em>, no que sea equiparable a un Franquicia de la
            NBA. Cada categoría muestra el nombre de la liga para evitar
            confusiones entre competiciones.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Confianza
          </h3>
          <p className="text-sm text-ink-300">
            La confianza indica cuán fiable es la valoración según el tamaño de la muestra:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-ink-300">
            <li><strong className="text-emerald-400">Alta</strong> — ≥15 partidos jugados</li>
            <li><strong className="text-amber-400">Media</strong> — 8–14 partidos</li>
            <li><strong className="text-ink-400">Baja</strong> — &lt;8 partidos (muestra pequeña)</li>
          </ul>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Fuentes de datos
          </h3>
          <p className="text-sm text-ink-300">
            El motor se alimenta exclusivamente de datos de la temporada actual almacenados en
            nuestra base de datos PostgreSQL. Las estadísticas provienen de fuentes oficiales de
            cada liga (NBA, EuroLeague, ACB, FEB). No se utilizan APIs externas de salarios — todas
            las cifras son estimaciones heurísticas basadas en la producción del jugador y los
            techos económicos definidos por liga.
          </p>
        </FadeIn>
      </section>

      <section className="mt-12 space-y-6">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-50">
            Simulador de traspasos
          </h2>
          <p className="text-sm text-ink-300">
            El simulador encuentra escenarios de traspaso equilibrados para un jugador determinado.
            Dado un jugador con valor estimado V, explora el conjunto de jugadores del mercado en
            ligas adyacentes y construye paquetes de 1, 2 o 3 jugadores cuyo valor combinado se
            acerque a V.
          </p>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Cómo funciona
          </h3>
          <div className="gh-card space-y-4 p-5 text-sm">
            <Step n={1} title="Encuentra al jugador">
              Busca al jugador que quieres traspasar. El simulador obtiene su valoración de mercado
              actual.
            </Step>
            <Step n={2} title="Explora el mercado">
              El sistema examina a todos los jugadores de ligas adyacentes (misma liga, superior e
              inferior dentro del mismo ecosistema). Filtra piezas que:
              <ul className="ml-4 mt-1 list-disc space-y-1 text-ink-300">
                <li>Están en <strong>otros equipos</strong> (no en el del jugador que sale)</li>
                <li>Tienen un valor entre el <strong>15% y el 110%</strong> de V</li>
                <li>Coinciden con la <strong>posición deseada</strong> (si se especifica)</li>
              </ul>
            </Step>
            <Step n={3} title="Genera combinaciones">
              El motor genera combinaciones de 1, 2 y 3 jugadores cuyo valor combinado esté dentro
              de la ventana de equilibrio (80% – 125% de V).
            </Step>
            <Step n={4} title="Ordena los resultados">
              Los escenarios se ordenan por cercanía al equilibrio perfecto (1,0). A igual
              distancia, se prefieren los paquetes con menos jugadores.
            </Step>
          </div>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Ventana de equilibrio
          </h3>
          <p className="text-sm text-ink-300">
            El ratio de equilibrio se calcula como valor recibido ÷ valor entregado:
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-ink-300">
            <li><strong className="text-emerald-400">0,95 – 1,08:</strong> Traspaso equilibrado</li>
            <li><strong className="text-amber-400">&lt; 0,95:</strong> Te quedas corto — pide más</li>
            <li><strong className="text-amber-400">&gt; 1,08:</strong> Recibes más valor del que entregas</li>
          </ul>
        </FadeIn>

        <FadeIn>
          <h3 className="font-display text-xl font-bold text-ink-100">
            Ligas adyacentes
          </h3>
          <p className="text-sm text-ink-300">
            El simulador busca en ligas del mismo nivel o un escalón por encima/por debajo. La NBA
            está aislada del mercado europeo — un equipo ACB no recibiría sugerencias de jugadores
            NBA. Esto mantiene los resultados realistas para el contexto del baloncesto español y
            europeo.
          </p>
        </FadeIn>
      </section>

      <section className="mt-12 space-y-6">
        <FadeIn>
          <h2 className="font-display text-2xl font-bold text-ink-50">
            Limitaciones
          </h2>
          <ul className="ml-4 list-disc space-y-2 text-sm text-ink-300">
            <li>
              <strong>Sin datos reales de salario.</strong> Las cifras son estimaciones
              heurísticas, no cláusulas contractuales reales.
            </li>
            <li>
              <strong>No considera lesiones.</strong> El jugador mejor valorado puede estar
              lesionado — el sistema no lo sabe.
            </li>
            <li>
              <strong>No considera las preferencias del jugador.</strong> Un jugador puede no
              querer cambiar de equipo o de liga.
            </li>
            <li>
              <strong>Solo temporada actual.</strong> La valoración usa datos de la temporada
              actual, no el historial completo de carrera.
            </li>
            <li>
              <strong>No considera la dinámica de equipo.</strong> El encaje táctico, el salario
              real, el impacto en el vestuario, etc., no se modelan.
            </li>
          </ul>
        </FadeIn>
      </section>
    </>
  )
}

function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 font-mono text-[10px] font-bold text-brand-300">
          {n}
        </span>
        <h4 className="font-semibold text-ink-100">{title}</h4>
      </div>
      <div className="text-ink-300">{children}</div>
    </div>
  )
}
