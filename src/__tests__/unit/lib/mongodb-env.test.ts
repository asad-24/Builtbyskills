import { afterEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { getDatabaseEnv, getPublicEnv, getServerEnv } from "@/lib/env"
afterEach(() => vi.unstubAllEnvs())
describe("MongoDB environment", () => {
  it("keeps all database credentials out of public configuration", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://localhost/synthetic")
    vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-secret-that-is-at-least-32-characters")
    expect(getPublicEnv()).toEqual({ siteUrl: "http://localhost:3000" })
    expect(getDatabaseEnv()).toMatchObject({ mongodbDb: "builtbyskills" })
    expect(getServerEnv().brevoApiKey).toBeTruthy()
  })
  it("requires MongoDB configuration, without accepting old Supabase keys", () => {
    vi.stubEnv("MONGODB_URI", "")
    vi.stubEnv("BETTER_AUTH_SECRET", "")
    expect(() => getDatabaseEnv()).toThrow("MONGODB_URI")
  })
})
