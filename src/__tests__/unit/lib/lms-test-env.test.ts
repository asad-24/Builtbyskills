import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs", () => {
  const fs = { existsSync: vi.fn(), readFileSync: vi.fn() }
  return { ...fs, default: fs }
})
import { existsSync, readFileSync } from "node:fs"
import { loadTestEnvironment } from "../../../../scripts/lms-test-env.mjs"

let testConfig: string
beforeEach(() => {
  vi.stubEnv("LMS_TEST_ENV_FILE", "/synthetic/test.env")
  testConfig = "NEXT_PUBLIC_SUPABASE_URL=https://test-project.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_synthetic\nSUPABASE_SECRET_KEY=sb_secret_synthetic"
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(readFileSync).mockImplementation(path => path === "/synthetic/test.env" ? testConfig : "NEXT_PUBLIC_SUPABASE_URL=https://existing-project.supabase.co")
})
afterEach(() => vi.unstubAllEnvs())

describe("separate LMS test credentials", () => {
  it("normalizes both key names to prevent inheriting existing project credentials", () => {
    const env = loadTestEnvironment()
    expect(env).toMatchObject({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_synthetic", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic", SUPABASE_SECRET_KEY: "sb_secret_synthetic", LMS_E2E: "1" })
  })

  it("preserves legacy-only test configurations", () => {
    testConfig = "NEXT_PUBLIC_SUPABASE_URL=https://test-project.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=legacy-public\nSUPABASE_SERVICE_ROLE_KEY=legacy-server"
    expect(loadTestEnvironment()).toMatchObject({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "legacy-public", SUPABASE_SECRET_KEY: "legacy-server" })
  })

  it("refuses a public key alone instead of borrowing the existing server key", () => {
    testConfig = testConfig.replace("SUPABASE_SECRET_KEY=sb_secret_synthetic", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "existing-project-key")
    expect(() => loadTestEnvironment()).toThrow("Configure SUPABASE_SECRET_KEY")
  })

  it("continues to reject the existing application project", () => {
    testConfig = testConfig.replace("test-project.supabase.co", "existing-project.supabase.co")
    expect(() => loadTestEnvironment()).toThrow("Use a separate test project")
  })
})
