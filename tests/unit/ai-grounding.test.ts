import { describe, it, expect } from "vitest"
import {
  extractFigures,
  inventsFigures,
  unsupportedFigures,
} from "@/lib/ai/grounding"

/**
 * The check that catches a hallucination. Prose is hard to verify; numbers are
 * not — if a figure appears in the answer and nowhere in the data, in any
 * rounding, the model made it up.
 *
 * The fixtures are the real trade data block and the real answer a local model
 * returned for it: a Maxey/Curry proposal described as a €5.2M player who
 * grabs 7.6 rebounds and carries an "injury risk of 0.5".
 */
const TRADE_DATA = [
  "Propuesta de traspaso",
  "Jugadores que entregas",
  "  - Tyrese Maxey (G, Philadelphia 76ers, NBA)",
  "    Valor de mercado estimado: €57,0 M · Rating: 95/100",
  "    Estadísticas: 28.3 PPG · 4.1 RPG · 6.6 APG",
  "Jugadores que recibes",
  "  - Stephen Curry (G, Golden State Warriors, NBA)",
  "    Valor de mercado estimado: €54,1 M · Rating: 93/100",
  "    Estadísticas: 26.6 PPG · 3.6 RPG · 4.7 APG",
  "Los números",
  "Valor total entregado: €57,0 M (incluye €0 en efectivo)",
  "Valor total recibido: €54,1 M",
  "Balance: 0,95",
].join("\n")

describe("extractFigures", () => {
  it("reads the shapes a prompt and an answer actually use", () => {
    const figures = extractFigures("€900 K, 1,2 millones, 14,2 PPG, 38%, 900.000")
    expect(figures).toContain(900_000)
    expect(figures).toContain(1_200_000)
    expect(figures).toContain(14.2)
    expect(figures).toContain(38)
    // Thousands separators and decimal commas must not collide.
    expect(figures.filter((f) => f === 900_000)).toHaveLength(2)
  })

  it("keeps a decimal comma a decimal", () => {
    expect(extractFigures("Balance: 0,95")).toContain(0.95)
  })
})

describe("inventsFigures", () => {
  it("catches the invented trade report", () => {
    const invented = [
      "Tyrese Maxey tiene un valor de mercado estimado de €5,2 millones.",
      "Es un luchador de rebotes (7,6 por juego) y un líder de tres puntos (3,8 por juego).",
      "Tiene un riesgo de lesión de 0,5 y se cobra €1,4 millones al año.",
    ].join(" ")
    expect(inventsFigures(invented, TRADE_DATA)).toBe(true)
  })

  it("passes a report that only quotes what it was given", () => {
    const grounded = [
      "Sales ganando por poco: entregas €57,0 M y recibes €54,1 M, un balance de 0,95.",
      "Maxey te da más creación (6.6 asistencias por partido) que Curry (4.7),",
      "y a cambio pierdes al mejor tirador del trato.",
    ].join(" ")
    expect(inventsFigures(grounded, TRADE_DATA)).toBe(false)
  })

  it("lets a good answer round", () => {
    // Told €57,0 M, writing "unos 57 millones" is correct, not invented.
    const rounded = "Maxey vale unos 57 millones y Curry algo menos, 54 millones."
    expect(unsupportedFigures(rounded, TRADE_DATA)).toHaveLength(0)
  })

  it("ignores counts, squad sizes and years", () => {
    const counts =
      "Con 2 bases y 3 aleros en la rotación, en 2024 ya intentaron algo parecido."
    expect(inventsFigures(counts, TRADE_DATA)).toBe(false)
  })

  it("fails a single invented money figure on its own", () => {
    // One stray decimal is a paraphrase; a made-up salary is not.
    expect(
      inventsFigures("El acuerdo rondaría los €12,7 M.", TRADE_DATA),
    ).toBe(true)
  })

  it("says nothing when there is no data to check against", () => {
    expect(inventsFigures("Vale 40 millones.", "sin cifras aquí")).toBe(false)
  })

  it("matches a K figure written back as millions", () => {
    // "€900 K" in the data, "0,9 millones" in the answer.
    expect(
      unsupportedFigures("Cuesta 0,9 millones.", "Valor est. €900 K"),
    ).toHaveLength(0)
  })
})
