/*
 * Tagged-template SQL client for the maintenance scripts, over mysql2.
 *
 * These scripts were written against postgres-js, whose tagged-template API has
 * no equivalent in mysql2. Rather than rewrite ~4,500 lines of query code by
 * hand, this reproduces the exact slice of that API the scripts actually use:
 *
 *   sql`select ... where id = ${id}`   parameterised query -> rows
 *   sql(ids)                           array   -> (?, ?, ?) for IN lists
 *   sql(fills)                         object  -> `a` = ?, `b` = ? for UPDATE SET
 *   sql("p.col")                       string  -> `p`.`col` identifier
 *   sql.json(value)                    JSON parameter
 *   result.count                       rows affected (writes) or returned (reads)
 *   sql.begin(async tx => ...)         transaction, tx has the same API
 *   sql.end()                          close the pool
 *
 * Values are always bound as parameters, never interpolated, so the injection
 * properties of the original code are preserved. The one exception is sql(),
 * which produces identifiers — it back-quotes them and rejects anything that
 * is not a plain dotted name.
 */
import mysql from "mysql2/promise"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export type Row = Record<string, unknown>
export type Result<T = Row> = T[] & { count: number }

/** A pre-rendered SQL fragment plus its parameters. */
class Fragment {
  constructor(
    readonly text: string,
    readonly params: unknown[],
  ) {}
}

class Identifier {
  constructor(readonly name: string) {}
}

class JsonValue {
  constructor(readonly value: unknown) {}
}

/** Back-quote a possibly dotted identifier: `p.first_name` -> `p`.`first_name`. */
function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`)
  }
  return name
    .split(".")
    .map((part) => "`" + part + "`")
    .join(".")
}

type Executor = (text: string, params: unknown[]) => Promise<unknown>

function render(
  strings: TemplateStringsArray,
  values: unknown[],
): { text: string; params: unknown[] } {
  let text = ""
  const params: unknown[] = []

  for (let i = 0; i < strings.length; i++) {
    text += strings[i]
    if (i >= values.length) continue
    const v = values[i]

    if (v instanceof Query) {
      // An un-awaited query embedded in another: inline its SQL and parameters.
      const f = v.fragment
      text += f.text
      params.push(...f.params)
    } else if (v instanceof Fragment) {
      text += v.text
      params.push(...v.params)
    } else if (v instanceof Identifier) {
      text += quoteIdent(v.name)
    } else if (v instanceof JsonValue) {
      text += "?"
      params.push(JSON.stringify(v.value))
    } else if (Array.isArray(v)) {
      // IN lists. An empty list must still be valid SQL that matches nothing.
      text += v.length === 0 ? "(NULL)" : `(${v.map(() => "?").join(", ")})`
      params.push(...v)
    } else if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      // UPDATE ... SET assignments.
      const entries = Object.entries(v as Row)
      if (entries.length === 0) throw new Error("sql(): empty assignment object")
      text += entries.map(([k]) => `${quoteIdent(k)} = ?`).join(", ")
      params.push(...entries.map(([, val]) => val))
    } else {
      text += "?"
      params.push(v)
    }
  }
  return { text, params }
}

function attachCount(rows: unknown[], raw: unknown): unknown[] & { count: number } {
  const out = rows as unknown[] & { count: number }
  const header = raw as { affectedRows?: number } | undefined
  // postgres-js exposes `.count` as rows affected for writes and rows returned
  // for reads; mirror both cases.
  out.count =
    header && typeof header.affectedRows === "number"
      ? header.affectedRows
      : rows.length
  return out
}

/**
 * A lazy query, exactly like postgres-js: nothing runs until it is awaited, so
 * a query can also be built once and embedded into others as a fragment —
 *
 *   const scope = sql`from t where x = ${1}`
 *   await sql`select count(*) ${scope}`
 *
 * Executing eagerly would turn `scope` into a Promise and silently corrupt the
 * outer statement.
 */
class Query<T extends readonly unknown[]> implements PromiseLike<T & { count: number }> {
  constructor(
    private readonly strings: TemplateStringsArray,
    private readonly values: unknown[],
    private readonly exec: Executor,
  ) {}

  /** Rendered SQL and parameters, for embedding into an outer query. */
  get fragment(): Fragment {
    const { text, params } = render(this.strings, this.values)
    return new Fragment(text, params)
  }

  private run(): Promise<T & { count: number }> {
    const { text, params } = render(this.strings, this.values)
    return this.exec(text, params).then((raw) => {
      const rows = Array.isArray(raw) ? raw : []
      return attachCount(
        rows,
        Array.isArray(raw) ? undefined : raw,
      ) as unknown as T & { count: number }
    })
  }

  then<A = T & { count: number }, B = never>(
    onOk?: ((v: T & { count: number }) => A | PromiseLike<A>) | null,
    onErr?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onOk, onErr)
  }

  catch<B = never>(onErr?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().catch(onErr)
  }

  finally(onDone?: (() => void) | null) {
    return this.run().finally(onDone)
  }
}

// The generic is the ARRAY type, not the row type — postgres-js is written
// `sql<DbPlayer[]>\`…\``, and matching that exactly is what lets the 23 call
// sites stay untouched.
function makeTag(exec: Executor) {
  return <T extends readonly unknown[] = Row[]>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => new Query<T>(strings, values, exec)
}

/**
 * `sql(x)` — identifier, IN list or SET object, depending on the argument.
 * Returns a marker the template renderer expands; it is never a query itself.
 */
function makeHelper(x: unknown): unknown {
  if (typeof x === "string") return new Identifier(x)
  return x // arrays and plain objects are handled by render()
}

export type Sql = ReturnType<typeof makeTag> & {
  (x: unknown): unknown
  json(value: unknown): JsonValue
  begin<T>(cb: (tx: Sql) => Promise<T>): Promise<T>
  end(): Promise<void>
}

/** Load .env / .env.local the same way the other maintenance scripts do. */
export function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const key = m[1]!
      if (!process.env[key]) process.env[key] = m[2]!.replace(/^["']|["']$/g, "")
    }
  }
}

export function createSql(): Sql {
  loadEnv()
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const pool = mysql.createPool({
    uri: url,
    // Match the application pool: datetimes are stored and read as UTC.
    timezone: "Z",
    connectionLimit: 4,
    supportBigNumbers: true,
    bigNumberStrings: false,
  })

  const exec: Executor = async (text, params) => {
    const [result] = await pool.query(text, params)
    return result
  }

  const base = makeTag(exec)
  const sql = ((...args: unknown[]) => {
    // Called as a tagged template when the first argument carries `raw`.
    const first = args[0] as TemplateStringsArray | undefined
    if (first && Array.isArray(first) && "raw" in first) {
      return base(first, ...args.slice(1))
    }
    return makeHelper(args[0])
  }) as Sql

  sql.json = (value: unknown) => new JsonValue(value)

  sql.begin = async <T>(cb: (tx: Sql) => Promise<T>): Promise<T> => {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const txExec: Executor = async (text, params) => {
        const [result] = await conn.query(text, params)
        return result
      }
      const txBase = makeTag(txExec)
      const tx = ((...args: unknown[]) => {
        const first = args[0] as TemplateStringsArray | undefined
        if (first && Array.isArray(first) && "raw" in first) {
          return txBase(first, ...args.slice(1))
        }
        return makeHelper(args[0])
      }) as Sql
      tx.json = sql.json
      tx.begin = () => {
        throw new Error("Nested transactions are not supported")
      }
      tx.end = async () => {}

      const out = await cb(tx)
      await conn.commit()
      return out
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  sql.end = () => pool.end()

  return sql
}
