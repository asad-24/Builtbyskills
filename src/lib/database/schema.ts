import "server-only"
import { mongoDb, mongoClient } from "./connection"
import type { MongoClient } from "mongodb"

export const tables = ["profiles", "courses", "course_sections", "lessons", "lesson_resources", "instructor_courses", "enrollments", "lesson_progress", "payment_methods", "payment_submissions", "enrollment_requests", "live_classes", "course_recordings", "announcements", "contact_submissions", "notifications", "audit_logs", "skills", "lesson_video_assets", "lesson_video_uploads"] as const
export type Table = typeof tables[number]

export const DATABASE_SCHEMA_VERSION = 1
type Entry = { client: MongoClient; name: string; version: number; promise: Promise<void> }
const registry = globalThis as typeof globalThis & { lmsSchemaState?: { initialized?: Entry; ready?: Entry } }
// Next.js may load separate server-action and RSC module graphs in one process.
// Share readiness across those graphs, just like the MongoClient pool.
const state = registry.lmsSchemaState ??= {}

// Runtime checks never create collections or indexes. Successful readiness is
// shared by this process, bound to the exact connection and database.
export function ensureDatabaseReady() {
  const client = mongoClient(), name = mongoDb().databaseName
  if (!state.ready || state.ready.client !== client || state.ready.name !== name || state.ready.version !== DATABASE_SCHEMA_VERSION) {
    const entry = { client, name, version: DATABASE_SCHEMA_VERSION, promise: Promise.resolve() }
    entry.promise = (async () => {
      const schema = await mongoDb().collection<{ _id: string; version: number }>("lms_metadata").findOne({ _id: "schema" })
      if (schema?.version !== DATABASE_SCHEMA_VERSION) throw Object.assign(new Error("Database setup is incomplete. Please contact the academy."), { code: "DATABASE_NOT_READY" })
    })().catch(error => { if (state.ready === entry) state.ready = undefined; throw error })
    state.ready = entry
  }
  return state.ready.promise
}

// Explicit setup only: scripts and disposable database test fixtures.
export function ensureIndexes() {
  const client = mongoClient(), name = mongoDb().databaseName
  if (!state.initialized || state.initialized.client !== client || state.initialized.name !== name || state.initialized.version !== DATABASE_SCHEMA_VERSION) {
    const entry = { client, name, version: DATABASE_SCHEMA_VERSION, promise: Promise.resolve() }
    entry.promise = initialize().catch(error => { if (state.initialized === entry) state.initialized = undefined; throw error })
    state.initialized = entry
  }
  return state.initialized.promise
}
async function initialize() {
  const db = mongoDb()
  for (const table of tables) await db.collection(table).createIndex({ id: 1 }, { unique: true })
  for (const [table, keys] of [
    ["profiles", { email: 1 }], ["courses", { slug: 1 }],
    ["course_sections", { course_id: 1, position: 1 }],
    ["lessons", { section_id: 1, position: 1 }], ["lessons", { section_id: 1, slug: 1 }],
    ["instructor_courses", { instructor_id: 1, course_id: 1 }],
    ["enrollments", { student_id: 1, course_id: 1 }],
    ["lesson_progress", { student_id: 1, lesson_id: 1 }],
    ["lesson_video_uploads", { asset_id: 1 }],
  ] as const) await db.collection(table).createIndex(keys, { unique: true })
  await db.collection("profiles").createIndex({ auth_user_id: 1 }, { unique: true, partialFilterExpression: { auth_user_id: { $type: "string" } } })
  for (const table of ["live_classes", "course_recordings", "announcements"]) await db.collection(table).createIndex({ course_id: 1 })
  await db.collection("instructor_courses").createIndex({ course_id: 1 })
  await db.collection("enrollment_requests").createIndex({ payment_submission_id: 1 }, { unique: true })
  await db.collection("user").createIndex({ email: 1 }, { unique: true })
  await db.collection("session").createIndex({ token: 1 }, { unique: true })
  await db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true })
  await db.collection("verification").createIndex({ identifier: 1 })
  await db.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("file_grants").createIndex({ token: 1 }, { unique: true })
  await db.collection("file_grants").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("file_chunks").createIndex({ fileId: 1, index: 1 }, { unique: true })
  await db.collection("file_chunks").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("files").createIndex({ bucket: 1, path: 1 }, { unique: true })
  for (const table of ["courses", "enrollments", "payment_submissions", "announcements", "contact_submissions", "audit_logs"]) {
    await db.collection(table).createIndex({ created_at: -1, id: -1 })
  }
  await db.collection("profiles").createIndex({ role: 1, created_at: -1, id: -1 })
  await db.collection("live_classes").createIndex({ starts_at: 1, id: 1 })
  await db.collection<{ _id: string; version: number; prepared_at: Date }>("lms_metadata").updateOne({ _id: "schema" }, { $set: { version: DATABASE_SCHEMA_VERSION, prepared_at: new Date() } }, { upsert: true })
  state.ready = { client: mongoClient(), name: db.databaseName, version: DATABASE_SCHEMA_VERSION, promise: Promise.resolve() }
}
