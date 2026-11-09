import "server-only"
import { MissingEnvironmentError } from "@/lib/errors"

type Context = { operation?: string; collection?: string }
const expectedCodes = new Set(["23505", "23503", "42501", "23514", "STALE", "11000"])
const networkCodes = new Set(["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ESERVFAIL", "ETIMEOUT", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED"])
const numericCodes = new Set([13, 18, 26, 50, 85, 86, 91, 11600, 11602, 13435, 8000])
const names = new Set(["MongoServerError", "MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError", "MongoParseError", "MongoInvalidArgumentError", "MongoTopologyClosedError", "MissingEnvironmentError", "TypeError", "RangeError"])

export function databaseDiagnostic(error: unknown, context: Context = {}) {
  const e = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; message?: unknown; cause?: { code?: unknown } } : {}
  const code = typeof e.code === "number" && numericCodes.has(e.code) ? e.code
    : typeof e.code === "string" && networkCodes.has(e.code) ? e.code : undefined
  const cause = typeof e.cause?.code === "string" && networkCodes.has(e.cause.code) ? e.cause.code : undefined
  const name = typeof e.name === "string" && names.has(e.name) ? e.name : "DatabaseError"
  const message = typeof e.message === "string" ? e.message : ""
  const category = error instanceof MissingEnvironmentError ? "missing_configuration"
    : name === "MongoParseError" || name === "MongoInvalidArgumentError" || e.code === "DATABASE_URI_INVALID" ? "invalid_configuration"
    : code === 18 || (code === 8000 && /bad auth|authentication failed|auth failed/i.test(message)) ? "authentication_failed"
    : code === 13 ? "permission_denied"
    : code === 85 || code === 86 ? "index_conflict"
    : name === "MongoServerSelectionError" ? "server_selection_failed"
    : name.startsWith("MongoNetwork") || networkCodes.has(String(code)) || cause ? "network_failed"
    : "database_failed"
  const keyNames = new Set(["MONGODB_URI", "MONGODB_DB", "BETTER_AUTH_SECRET", "NEXT_PUBLIC_SITE_URL"])
  return {
    category, name, ...(code !== undefined ? { code } : {}), ...(cause ? { cause } : {}),
    ...(context.operation && ["select", "insert", "update", "upsert", "delete", "rpc"].includes(context.operation) ? { operation: context.operation } : {}),
    ...(context.collection && /^[a-z_]{1,64}$/.test(context.collection) ? { collection: context.collection } : {}),
    ...(error instanceof MissingEnvironmentError ? { missing: error.keys.filter(key => keyNames.has(key)) } : {}),
  }
}

export function reportDatabaseError(error: unknown, context?: Context) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
  if (expectedCodes.has(code)) return
  // Emit only allowlisted metadata, including in production. Driver messages,
  // connection strings, stack traces, query values and account data are omitted.
  console.error("[mongodb]", databaseDiagnostic(error, context))
}
