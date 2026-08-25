import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { asksForInput } from "@/lib/ai/degeneration"
import { isDataDump } from "@/lib/ai/grounding"

/**
 * Every string in this file is real output that reached a real user, pasted
 * back by the owner. They are the specification: whatever else changes, these
 * must never be shown again.
 */

/** The shot-zone table copied out, translated, then copied out a second time. */
const ZONE_TRANSCRIPTION = `Hola Sr. Entrenador,
Llevo en cuenta los datos del jugador Darius Garland, jugador de la temporada
2021-2022, jugando para el Cleveland Cavaliers.
En la pista:

* Pintura: 53.7% (158 goles de 294)
* Lateral izquierdo (2PT): 62,5% (10 goles de 16)
* Lateral derecho (2PT): 27,3% (3 goles de 11)
* Lateral superior (2PT): 38,1% (8 goles de 21)
* Lateral izquierdo (3PT): 25,0% (3 goles de 12)
* Lateral superior (3PT): 37,5% (36 goles de 96)

Donde se ronda:

* Pintura: 53,7% (158 goles de 294)
* Lateral izquierdo (2PT): 62,5% (10 goles de 16)`

/** The frame headings copied across; the coach's question never answered. */
const FRAME_TRANSCRIPTION = `Frame 1 - 2-player Pick & Roll
En esta primera fotografia, hay dos jugadores colocados en el area de golpeo.
Los atacantes estan en la parte superior derecha y la defensa en la parte
inferior izquierda. La distancia entre atacantes es de 3 metros.

Frame 2 - 3-player Pick & Roll
En esta segunda fotografia, los jugadores atacantes (3 jugadores) estan en la
parte superior. Los defensas (3 defensas) estan en la parte inferior. La
distancia entre atacantes es de 3 metros.

Frame 3 - 4-player Pick & Roll
En esta tercera fotografia, los jugadores atacantes (4 jugadores) estan en la
parte superior, y los defensas (4 defensas) estan en la parte inferior.`

/** Compare, handed two players the database had filed under the same name. */
const ASKS_WHICH_AARON = `Entiendo que estas buscando sugerencias sobre cual de
los dos Aaron podria ser la eleccion mas adecuada para un equipo especifico.
Estoy listo para comparar y proporcionar informacion relevante para su
decision. Por favor, proporciona el nombre de cada Aaron para que pueda
ayudarte y no confundir a los jugadores.`

/** The advisor, asked for an interior defender, asking where to find one. */
const INTERROGATES = `Hola, estoy encantado de comunicarte y ayudarte en tu
formacion. Para empezar, ¿donde encuentro un defensor interior de calidad con
un precio razonable para un equipo de la NBA? ¿No encuentras algo que tenga un
nivel de calidad pero no sea sobrepasar el presupuesto? ¡Gracias!`

/** What the same surface is supposed to produce. */
const REAL_SCOUTING_NOTE = `**En la pista.** Garland lleva la puntera del ataque
de Cleveland y lo hace desde el bote: combina volumen de anotacion con un
reparto real, y en el pick and roll castiga tanto al que le pasa por debajo
como al que le salta. Su tiro desde el arco superior obliga al ayudante a
salir, lo que abre el corte del cinco.

**Donde flojea.** No defiende. Le cuesta pelear el bloqueo y en el rebote no
aporta nada, asi que a su lado necesitas un exterior grande que tape ese
agujero. Contra bases fisicos pierde la posicion antes de recibir.

**Cuanto vale.** Para la produccion que da, el precio estimado es caro pero
defendible si el equipo esta en ventana de ganar. Lo firmaria como segundo
generador, no como franquicia.`

/** A comparison that uses the one table the house style allows. */
const REAL_COMPARISON = `Me quedo con Doncic si el equipo necesita a alguien que
cree ventaja desde el primer pase. La diferencia la marca su lectura de la
ayuda: cuando el rival dobla, encuentra al hombre libre antes de que llegue la
rotacion.

| Jugador | PTS | REB | AST |
| --- | --- | --- | --- |
| Doncic | 32.4 | 8.6 | 9.1 |
| Tatum | 26.9 | 8.1 | 4.9 |

Tatum es la mejor eleccion si ya tienes un base titular y lo que te falta es un
alero que defienda las cuatro posiciones exteriores.`

describe("isDataDump", () => {
  it("rejects the shot-zone table read back to the coach", () => {
    expect(isDataDump(ZONE_TRANSCRIPTION)).toBe(true)
  })

  it("rejects a frame-by-frame restatement of the drawing", () => {
    expect(isDataDump(FRAME_TRANSCRIPTION)).toBe(true)
  })

  it("accepts a note that quotes a few figures inside sentences", () => {
    expect(isDataDump(REAL_SCOUTING_NOTE)).toBe(false)
  })

  it("accepts the comparison table the house style explicitly allows", () => {
    // Dense by design. Judging density on it would reject the good case with
    // the bad one, so table rows are excluded from the measurement.
    expect(isDataDump(REAL_COMPARISON)).toBe(false)
  })

  it("does not fire on a short answer that happens to carry two numbers", () => {
    expect(
      isDataDump("Si, entra en tu presupuesto: unos 1,2 millones al año."),
    ).toBe(false)
  })
})

describe("asksForInput", () => {
  it("rejects an answer that asks the coach which player he meant", () => {
    expect(asksForInput(ASKS_WHICH_AARON)).toBe(true)
  })

  it("rejects an answer made mostly of questions back to the reader", () => {
    expect(asksForInput(INTERROGATES)).toBe(true)
  })

  it("rejects the English forms of the same failure", () => {
    expect(asksForInput("Please provide the full name of each player.")).toBe(
      true,
    )
    expect(
      asksForInput("I need more information about his contract to judge this."),
    ).toBe(true)
  })

  it("accepts an answer that just answers", () => {
    expect(asksForInput(REAL_SCOUTING_NOTE)).toBe(false)
    expect(asksForInput(REAL_COMPARISON)).toBe(false)
  })

  it("allows one rhetorical question inside a real answer", () => {
    expect(
      asksForInput(
        "¿Merece la pena a ese precio? Si, siempre que juegue de segundo " +
          "generador. Su tiro obliga a salir al ayudante y eso abre el aro.",
      ),
    ).toBe(false)
  })
})

/**
 * Structural: the checks have to be wired into the one pipeline, not merely
 * exist. Every AI surface goes through `generateGroundedAnswer`.
 */
describe("the answer pipeline enforces them", () => {
  const src = readFileSync(
    join(process.cwd(), "src", "lib", "ai", "answer.ts"),
    "utf8",
  )

  it("verifies both new failure modes", () => {
    expect(src).toContain("asksForInput(text)")
    expect(src).toContain("isDataDump(text)")
    expect(src).toContain('"asks-for-input"')
    expect(src).toContain('"data-dump"')
  })

  it("tells the model what it did wrong, in both languages", () => {
    // A retry told only "try again" reproduces its answer.
    expect(src).toMatch(/copiar los datos que te pasaron/)
    expect(src).toMatch(/copied the data back instead of interpreting it/)
    expect(src).toMatch(/le pediste informaci[oó]n al lector/)
    expect(src).toMatch(/asked the reader for information/)
  })

  it("caps the whole answer, retry included, under the proxy timeout", () => {
    // Two 120s calls is four minutes; nginx gives up first and the browser
    // gets a 502 with an HTML body. /api/market/trade/ai was returning that.
    const budget = src.match(/const ANSWER_BUDGET_MS = (\d[\d_]*)/)
    expect(budget, "ANSWER_BUDGET_MS must be declared").not.toBeNull()
    expect(Number(budget![1].replace(/_/g, ""))).toBeLessThanOrEqual(60_000)
    // And the per-call ceiling has to be handed to the provider, not assumed.
    expect(src).toContain("timeoutMs: Math.max(1_000, remaining())")
    // A retry that cannot finish is worse than no retry.
    expect(src).toContain("remaining() < MIN_ATTEMPT_MS")
  })

  it("translates provider errors instead of pasting their JSON", () => {
    // What reached the screen: `Groq 429: {"error":{"message":"Rate limit
    // reached for model allam-2-7b in organization org_01k…`
    expect(src).toContain("describeProviderError")
    expect(src).toMatch(/l[ií]mite de uso de tu proveedor/)
  })
})

/**
 * The compare screen called every player by their first name only, so two
 * players called Aaron came out as "Aaron vs Aaron" — which is what the model
 * was asking about above. Every other query in the app builds the full name.
 */
describe("compare uses whole names", () => {
  it("selects first AND last name like every other query", () => {
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "data", "compare.ts"),
      "utf8",
    )
    expect(src).not.toMatch(/fullName:\s*players\.firstName/)
    expect(src).toContain("concat(${players.firstName}, ' ', ${players.lastName})")
  })
})
