import "server-only"
import { MongoClient, type ClientSession, type Db } from "mongodb"
import { MissingEnvironmentError } from "@/lib/errors"

const cache = globalThis as typeof globalThis & { lmsMongo?: { uri: string; client: MongoClient } }

export function mongoClient() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new MissingEnvironmentError(["MONGODB_URI"])
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error("Invalid MongoDB connection configuration.")
  if (!cache.lmsMongo || cache.lmsMongo.uri !== uri) {
    cache.lmsMongo = { uri, client: new MongoClient(uri, {
      maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000,
      socketTimeoutMS: 20_000,
    }) }
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
