import "server-only"
import { MongoClient, type ClientSession, type Db } from "mongodb"
import { MissingEnvironmentError } from "@/lib/errors"

const cache = globalThis as typeof globalThis & { lmsMongo?: { uri: string; client: MongoClient } }

export function mongoClient() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new MissingEnvironmentError(["MONGODB_URI"])
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) throw Object.assign(new Error("Invalid MongoDB connection configuration."), { code: "DATABASE_URI_INVALID" })
  if (!cache.lmsMongo || cache.lmsMongo.uri !== uri) {
    cache.lmsMongo = { uri, client: new MongoClient(uri, {
      maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000,
      socketTimeoutMS: 20_000,
      monitorCommands: process.env.LMS_PERF === "1",
    }) }
    if (process.env.LMS_PERF === "1") {
      const collections = new Map<number, string>()
      const allowed = /^(profiles|courses|course_sections|lessons|lesson_resources|enrollments|instructor_courses|lesson_progress|payment_submissions|payment_methods|live_classes|announcements|contact_submissions|audit_logs|lms_metadata|user|session)$/
      cache.lmsMongo.client.on("commandStarted", event => {
        const collection = event.command[event.commandName]
        if (typeof collection === "string" && allowed.test(collection)) collections.set(event.requestId, collection)
      })
      cache.lmsMongo.client.on("commandSucceeded", event => {
        const collection = collections.get(event.requestId)
        collections.delete(event.requestId)
        if (collection) console.info("[lms-db-perf]", JSON.stringify({ command: event.commandName, collection, durationMs: event.duration }))
      })
      cache.lmsMongo.client.on("commandFailed", event => collections.delete(event.requestId))
    }
  }
  return cache.lmsMongo.client
}

export function mongoDb(): Db {
  return mongoClient().db(process.env.MONGODB_DB || "builtbyskills")
}

export async function transaction<T>(work: (db: Db, session: ClientSession) => Promise<T>) {
  const client = mongoClient()
  const session = client.startSession()
  try {
    return await session.withTransaction(() => work(mongoDb(), session), {
      readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
    })
  } finally { await session.endSession() }
}
