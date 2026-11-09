import { afterEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { MissingEnvironmentError } from "@/lib/errors"
import { databaseDiagnostic, reportDatabaseError } from "@/lib/database/diagnostics"
afterEach(() => vi.restoreAllMocks())

describe("production MongoDB diagnostics", () => {
  it.each([
    [{ name: "MongoServerError", code: 18 }, "authentication_failed"],
    [{ name: "MongoServerError", code: 8000, message: "bad auth : authentication failed" }, "authentication_failed"],
    [{ name: "MongoServerError", code: 13 }, "permission_denied"],
    [{ name: "MongoServerError", code: 85 }, "index_conflict"],
    [{ name: "MongoParseError" }, "invalid_configuration"],
    [{ name: "MongoServerSelectionError" }, "server_selection_failed"],
    [{ name: "MongoNetworkError", cause: { code: "ENOTFOUND" } }, "network_failed"],
    [new MissingEnvironmentError(["MONGODB_URI"]), "missing_configuration"],
  ])("classifies errors without exposing the original payload: %j", (error, category) => {
    expect(databaseDiagnostic(error).category).toBe(category)
  })
  it("logs safe metadata in production and excludes credentials, messages, stacks and arbitrary fields", () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {})
    const secret = "synthetic-do-not-log"
    reportDatabaseError({ name: "MongoServerError", code: 18, message: `mongodb+srv://user:${secret}@example.test`, stack: secret, data: secret }, { operation: "select", collection: "courses" })
    expect(logger).toHaveBeenCalledWith("[mongodb]", { category: "authentication_failed", name: "MongoServerError", code: 18, operation: "select", collection: "courses" })
    expect(JSON.stringify(logger.mock.calls)).not.toContain(secret)
  })
  it("does not log normal validation, access denial or duplicate-record outcomes", () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {})
    for (const code of [11000, "23505", "23503", "42501", "23514", "STALE"]) reportDatabaseError({ code })
    expect(logger).not.toHaveBeenCalled()
  })
  it("rejects unexpected metadata and environment key contents", () => {
    const diagnostic = databaseDiagnostic(new MissingEnvironmentError(["MONGODB_URI", "synthetic-secret"]), { operation: "synthetic-secret", collection: "mongodb://secret" })
    expect(diagnostic).toEqual({ category: "missing_configuration", name: "MissingEnvironmentError", missing: ["MONGODB_URI"] })
  })
})
