/* eslint-disable @typescript-eslint/no-explicit-any -- The legacy query projection strings describe heterogeneous documents. */
import "server-only"
import { randomUUID } from "node:crypto"
import type { ClientSession, Document, Filter } from "mongodb"
import { mongoDb, transaction } from "./connection"
import { scope, type Access } from "./access"
import { ensureIndexes, tables, type Table } from "./schema"
import { validateWrite, cascadeDelete, syncInstructor } from "./writes"
import { reportDatabaseError } from "./diagnostics"

export type Row = Record<string, any>
export type QueryResult<Single extends boolean = false> = { data: (Single extends true ? any : any[]) | null; error: { code: string; message: string } | null; count: number | null }
export function databaseError(error: unknown, context?: { operation?: string; collection?: string }) {
  reportDatabaseError(error, context)
  const e = error as { code?: string | number }
  const code = e?.code === 11000 ? "23505" : String(e?.code ?? "DATABASE_UNAVAILABLE")
  const messages: Record<string, string> = { "23505": "This record already exists.", "23503": "This record is still referenced or its parent is unavailable.", "42501": "You do not have access to this record.", "23514": "Invalid record details.", "STALE": "This record changed. Refresh and retry." }
  return { code, message: messages[code] || "Database request failed. Please try again shortly." }
}
export function fail(code: string): never { throw Object.assign(new Error(code), { code }) }
const and = (...filters: Filter<Document>[]): Filter<Document> => ({ $and: filters })
const field = (key: string) => { if (!/^[a-z][a-z_0-9]*$/.test(key)) fail("23514"); return key }
const scalar = (value: unknown) => { if (value !== null && !["string", "number", "boolean"].includes(typeof value)) fail("23514"); return value }
export function splitProjection(input: string) {
  const out: string[] = []; let start = 0, depth = 0
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "(") depth++
    else if (input[i] === ")") depth--
    else if (input[i] === "," && depth === 0) { out.push(input.slice(start, i).trim()); start = i + 1 }
  }
  out.push(input.slice(start).trim()); return out.filter(Boolean)
}
function clean(row: Row) { return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_id")) }

// Relationships are explicit: no client-supplied table or foreign-key expressions are executed.
const children: Record<string, [string, string]> = {
  "courses:course_sections": ["course_id", "many"], "courses:enrollments": ["course_id", "many"],
  "course_sections:lessons": ["section_id", "many"], "lessons:lesson_resources": ["lesson_id", "many"],
  "lessons:lesson_video_assets": ["lesson_id", "many"], "lesson_video_assets:lesson_video_uploads": ["asset_id", "one"],
}
export async function projectRow(table: Table, row: Row, projection: string, access: Access, session?: ClientSession): Promise<Row> {
  const result: Row = {}
  for (const part of splitProjection(projection)) {
    if (part === "*") { Object.assign(result, clean(row)); continue }
    const nested = /^([a-z_]+(?::[a-z_]+)?)(?:![a-z_]+)?\((.*)\)$/.exec(part)
    if (!nested) { result[field(part)] = row[part] ?? null; continue }
    const [alias, target] = nested[1].includes(":") ? nested[1].split(":") : [nested[1], nested[1]]
    if (!tables.includes(target as Table)) fail("23514")
    const child = children[`${table}:${target}`]
    const foreign = alias === "section" ? "section_id" : alias === "actor" ? "actor_id" : alias === "author" ? "author_id" : alias === "student" ? "student_id" : alias === "instructor" ? "instructor_id" : target === "courses" ? "course_id" : `${target.replace(/s$/, "")}_id`
    const relation = child ? { [child[0]]: row.id } : { id: row[foreign] ?? null }
    const allowed = await scope(target as Table, access, "select", session)
    const docs = await mongoDb().collection(target).find(and(relation, allowed), { session }).toArray()
    const projected = []
    for (const doc of docs) projected.push(await projectRow(target as Table, doc, nested[2], access, session))
    result[alias] = child?.[1] === "many" ? projected : projected[0] ?? null
  }
  return result
}

export class Query<Single extends boolean = false> implements PromiseLike<QueryResult<Single>> {
  private filters: Filter<Document>[] = []
  private projection = "*"
  private action = "select"
  private payload: Row[] = []
  private conflict = "id"
  private sort: Record<string, 1 | -1> = {}
  private nestedSort: { table: string; field: string; ascending: boolean }[] = []
  private skip = 0
  private take = 0
  private one: "single" | "maybe" | null = null
  private head = false
  private count = false
  private result?: Promise<QueryResult<Single>>
  constructor(private table: Table, private access: Access) {
    if (!tables.includes(table)) fail("42501")
  }
  select(columns = "*", options: { count?: string; head?: boolean } = {}) { this.projection = columns; this.head = options.head ?? false; this.count = Boolean(options.count); return this }
  eq(key: string, value: unknown) { this.filters.push({ [field(key)]: scalar(value) }); return this }
  neq(key: string, value: unknown) { this.filters.push({ [field(key)]: { $ne: scalar(value) } }); return this }
  in(key: string, values: unknown[]) { this.filters.push({ [field(key)]: { $in: values.map(scalar) } }); return this }
  is(key: string, value: null | boolean) { return this.eq(key, value) }
  not(key: string, operator: string, value: unknown) { if (operator !== "eq") fail("23514"); return this.neq(key, value) }
  gte(key: string, value: unknown) { this.filters.push({ [field(key)]: { $gte: scalar(value) } }); return this }
  lte(key: string, value: unknown) { this.filters.push({ [field(key)]: { $lte: scalar(value) } }); return this }
  gt(key: string, value: unknown) { this.filters.push({ [field(key)]: { $gt: scalar(value) } }); return this }
  lt(key: string, value: unknown) { this.filters.push({ [field(key)]: { $lt: scalar(value) } }); return this }
  or(expression: string) {
    this.filters.push({ $or: splitProjection(expression).map(item => {
      const match = /^([a-z_]+)\.(eq|gte|is|in)\.(.*)$/.exec(item)
      if (!match) return fail("23514")
      const key = field(match[1]), value = match[3]
      if (match[2] === "in") return { [key]: { $in: value.replace(/^\(|\)$/g, "").split(",") } }
      if (match[2] === "is" && value === "null") return { [key]: null }
      if (match[2] === "gte") return { [key]: { $gte: value } }
      if (match[2] === "eq") return { [key]: value }
      return fail("23514")
    }) }); return this
  }
  order(key: string, options: { ascending?: boolean; referencedTable?: string } = {}) {
    if (options.referencedTable) this.nestedSort.push({ table: options.referencedTable, field: field(key), ascending: options.ascending !== false })
    else this.sort[field(key)] = options.ascending === false ? -1 : 1
    return this
  }
  limit(value: number) { this.take = Math.max(1, Math.min(10000, value)); return this }
  range(from: number, to: number) { this.skip = Math.max(0, from); this.take = Math.max(1, Math.min(10000, to - from + 1)); return this }
  single() { this.one = "single"; return this as unknown as Query<true> }
  maybeSingle() { this.one = "maybe"; return this as unknown as Query<true> }
  insert(values: Row | Row[]) { this.action = "insert"; this.payload = Array.isArray(values) ? values : [values]; return this }
  update(values: Row) { this.action = "update"; this.payload = [values]; return this }
  upsert(values: Row | Row[], options: { onConflict?: string } = {}) { this.insert(values); this.action = "upsert"; this.conflict = options.onConflict ?? "id"; return this }
  delete() { this.action = "delete"; return this }
  then<TResult1 = QueryResult<Single>, TResult2 = never>(onfulfilled?: ((value: QueryResult<Single>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    this.result ??= this.run()
    return this.result.then(onfulfilled, onrejected)
  }
  private async run(): Promise<QueryResult<Single>> {
    try {
      await ensureIndexes()
      const data = this.action === "select" ? await this.execute() : await transaction((_db, session) => this.execute(session))
      return data
    } catch (error) { return { data: null, error: databaseError(error, { operation: this.action, collection: this.table }), count: null } }
  }
  private async execute(session?: ClientSession): Promise<QueryResult<Single>> {
    const db = mongoDb(), collection = db.collection(this.table), options = { session }
    const allowed = await scope(this.table, this.access, this.action, session)
    const filter = and(...this.filters, allowed)
    let rows: Row[] = []
    const count = this.count ? await collection.countDocuments(filter, options) : null
    if (this.head) return { data: null, error: null, count }
    if (this.action === "select") {
      let cursor = collection.find(filter, options).sort(this.sort).skip(this.skip)
      if (this.take) cursor = cursor.limit(this.take)
      rows = await cursor.toArray()
    } else if (["insert", "upsert"].includes(this.action)) {
      for (const value of this.payload) {
        let existing: Row | null = null
        if (this.action === "upsert") {
          const conflictFilter = Object.fromEntries(this.conflict.split(",").map(key => [field(key), scalar(value[key])]))
          existing = await collection.findOne(conflictFilter, options)
          if (existing && !await collection.findOne(and({ id: existing.id }, allowed), options)) fail("42501")
        }
        const defaults = defaultsFor(this.table)
        const row = { ...defaults, ...existing, ...value, id: existing?.id ?? value.id ?? randomUUID(), updated_at: new Date().toISOString() }
        await validateWrite(this.table, row, existing, this.access, session)
        // Check insert against the same server-side scope inside the transaction.
        if (existing) await collection.updateOne({ id: row.id }, { $set: clean(row) }, options)
        else await collection.insertOne(row, options)
        if (!await collection.findOne(and({ id: row.id }, allowed), options)) fail("42501")
        if (this.table === "courses") await syncInstructor(row, existing, session)
        rows.push(row)
      }
    } else {
      const selected = await collection.find(filter, options).toArray()
      for (const old of selected) {
        if (this.action === "delete") { await cascadeDelete(this.table, old, session); await collection.deleteOne({ id: old.id }, options); rows.push(old) }
        else {
          const row = { ...old, ...this.payload[0], id: old.id, created_at: old.created_at, updated_at: new Date().toISOString() }
          await validateWrite(this.table, row, old, this.access, session)
          await collection.updateOne({ id: old.id }, { $set: clean(row) }, options)
          if (!await collection.findOne(and({ id: old.id }, allowed), options)) fail("42501")
          if (this.table === "courses") await syncInstructor(row, old, session)
          rows.push(row)
        }
      }
    }
    if (this.one && (rows.length > 1 || (this.one === "single" && !rows.length))) return { data: null, error: { code: "PGRST116", message: "Record unavailable." }, count }
    const projected = []
    for (const row of rows) {
      const result = await projectRow(this.table, row, this.projection, this.access, session)
      for (const order of this.nestedSort) {
        if (Array.isArray(result[order.table])) result[order.table].sort((a: Row, b: Row) => (a[order.field] > b[order.field] ? 1 : a[order.field] < b[order.field] ? -1 : 0) * (order.ascending ? 1 : -1))
      }
      projected.push(result)
    }
    return { data: (this.one ? projected[0] ?? null : projected) as QueryResult<Single>["data"], error: null, count }
  }
}

export function defaultsFor(table: Table): Row {
  const now = new Date().toISOString()
  const common = { created_at: now, updated_at: now }
  const values: Partial<Record<Table, Row>> = {
    profiles: { auth_user_id: null, role: "student", status: "active", phone: null, whatsapp: null, avatar_url: null },
    courses: { status: "draft", featured: false, price: 0, currency: "PKR", outcomes: [], requirements: [], thumbnail_url: null, instructor_id: null },
    lessons: { status: "draft", lesson_type: "video", description: null, duration_seconds: 0, position: 0, is_preview: false, video_asset_id: null, youtube_video_id: null, mux_asset_id: null, mux_playback_id: null },
    enrollments: { status: "pending", enrolled_at: null, starts_at: null, expires_at: null, completed_at: null, assigned_by: null },
    payment_submissions: { status: "pending", student_id: null, submitted_at: now, reviewed_at: null, reviewed_by: null, rejection_reason: null },
    enrollment_requests: { status: "pending" }, live_classes: { status: "scheduled", instructor_id: null, ends_at: null, description: null },
    course_recordings: { is_published: false, description: null }, announcements: { course_id: null, is_published: false, published_at: null },
    payment_methods: { is_active: true, iban_number: null, bank_name: null, instructions: null },
    lesson_progress: { progress_seconds: 0, completion_percentage: 0, is_completed: false, last_watched_at: null, completed_at: null },
    contact_submissions: { status: "new" }, audit_logs: { entity_id: null, metadata: {} },
  }
  return { ...common, ...values[table] }
}
