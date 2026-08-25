import { describe, it, expect } from "vitest"
import {
  trimDegeneratedOutput,
  isUsableAnswer,
  isMostlyHeadings,
} from "@/lib/ai/degeneration"

/**
 * Both fixtures are trimmed copies of answers real models actually returned to
 * users: a hosted 8B looping inside a sentence on the player page, and a local
 * model emitting the same heading over and over in the advisor.
 */
const LOOPED_SENTENCE =
  "**En la pista.** Stephen Curry rinde de forma constante con sus 26.6 puntos por partido. " +
  "Además, tiene un porcentaje de tiro de tres puntos de tiro de tres puntos de tiro de tres " +
  "puntos de tiro de tiro de tres puntos de tiro de tiro de tres puntos de tiro de tiro de tiro " +
  "de tiro de tiro de tiro de tiro de tiro de tiro de tiro de tiro de tiro de t"

const LOOPED_HEADINGS = [
  "Hola, analizo solo la información disponible y fuentes fiables.",
  "",
  "## Alejandro Diez Valero",
  "Alero de 2,03 m con buen tiro exterior y experiencia en ACB.",
  "",
  "#### Alejandro Diez Valero",
  "",
  "##### Alejandro Diez Valero",
  "",
  "###### Alejandro Diez Valero",
  "",
  "## Alejandro Diez Valero",
].join("\n")

const CLEAN = [
  "**Mi recomendación.** Alejandro Díez encaja porque te da tiro exterior sin",
  "ocupar plaza de extracomunitario, en torno a 1,2 millones al año.",
  "",
  "## Qué te costaría",
  "Es un alero de rotación, no un titular: rebotea poco para su altura (3,1 por",
  "partido) y no crea para otros.",
].join("\n")

describe("trimDegeneratedOutput", () => {
  it("cuts a sentence at the point it starts stuttering", () => {
    const out = trimDegeneratedOutput(LOOPED_SENTENCE)
    expect(out.looped).toBe(true)
    expect(out.text).toContain("26.6 puntos por partido")
    expect(out.text.length).toBeLessThan(LOOPED_SENTENCE.length / 2)
    expect(out.text).not.toMatch(/tiro de tiro/)
  })

  it("cuts an answer that keeps re-emitting the same heading", () => {
    const out = trimDegeneratedOutput(LOOPED_HEADINGS)
    expect(out.looped).toBe(true)
    expect(out.text).toContain("buen tiro exterior")
    expect(out.text.match(/Alejandro Diez Valero/g)?.length ?? 0).toBeLessThan(3)
  })

  it("leaves a healthy answer alone", () => {
    const out = trimDegeneratedOutput(CLEAN)
    expect(out.looped).toBe(false)
    expect(out.text).toBe(CLEAN)
  })

  it("does not mistake a markdown table separator for a loop", () => {
    const table = [
      "| Jugador | Puntos | Rebotes |",
      "| --- | --- | --- |",
      "| Díez | 8,4 | 3,1 |",
      "| Sastre | 6,2 | 2,0 |",
    ].join("\n")
    expect(trimDegeneratedOutput(table).looped).toBe(false)
  })

  it("does not flag a name repeated across normal prose", () => {
    const prose =
      "Díez te da tiro exterior. En defensa, Díez sufre contra aleros físicos. " +
      "Por 1,2 millones, Díez es una apuesta razonable si buscas rotación."
    expect(trimDegeneratedOutput(prose).looped).toBe(false)
  })

  it("collapses runs of blank lines", () => {
    const out = trimDegeneratedOutput("Primera línea.\n\n\n\n\n\nSegunda línea.")
    expect(out.text).toBe("Primera línea.\n\nSegunda línea.")
  })
})

describe("isUsableAnswer", () => {
  it("rejects what is left when the loop started immediately", () => {
    expect(isUsableAnswer(trimDegeneratedOutput("Vale. " + "no ".repeat(40)).text)).toBe(false)
  })

  it("accepts a short but complete answer", () => {
    expect(isUsableAnswer(CLEAN)).toBe(true)
  })
})

/**
 * The trimmer is the net; the sampler is what stops the model looping in the
 * first place. Read from source because exercising it needs a live provider.
 */
describe("the sampler is configured against repetition", () => {
  it("sends repetition penalties on OpenAI-compatible calls", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync("src/lib/ai/chat.ts", "utf8")
    expect(src).toContain("frequency_penalty")
    expect(src).toContain("repetitionControls(input.provider)")
  })

  it("tells every AI surface not to repeat itself", async () => {
    // The rule sits in the format half of the house style, so assert on the
    // block that actually reaches the model rather than on one of its halves.
    const { houseStyle } = await import("@/lib/ai/prompt-copy")
    for (const locale of ["en", "es"] as const) {
      expect(houseStyle(locale)).toMatch(/repeat|repitas/i)
    }
  })
})

describe("isMostlyHeadings", () => {
  it("rejects an answer that is the question restated as an outline", () => {
    const outline = [
      "Hola, analizo solo información disponible.",
      "",
      "# ¿Qué jugador recomiendas para el presupuesto?",
      "",
      "## ¿Qué jugadores se pueden adquirir?",
      "",
      "### ¿Qué jugadores pueden ser adquiridos?",
      "",
      "##### Alejandro Diez Valero",
      "",
      "###### ¿Cuándo podría contratar a un jugador?",
    ].join("\n")
    expect(isMostlyHeadings(outline)).toBe(true)
  })

  it("accepts a normal sectioned answer", () => {
    expect(isMostlyHeadings(CLEAN)).toBe(false)
  })

  it("accepts prose with no headings at all", () => {
    expect(isMostlyHeadings("Sí, entra en tu presupuesto sin ocupar cupo.")).toBe(
      false,
    )
  })
})
