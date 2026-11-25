import nextEnv from "@next/env"
nextEnv.loadEnvConfig(process.cwd())
const { ensureIndexes } = await import("../src/lib/database/schema")
const { mongoClient } = await import("../src/lib/database/connection")
try {
  await ensureIndexes()
  console.log("MongoDB indexes and runtime readiness prepared. Existing records preserved.")
} catch {
  console.error("MongoDB preparation failed. Verify database credentials, permissions and existing indexes.")
  process.exitCode = 1
} finally { await mongoClient().close() }
