import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@supabase/ssr", () => ({ createBrowserClient: vi.fn(() => ({})) }))

import { createBrowserClient } from "@supabase/ssr"
import { getOptionalServerEnv, getPublicEnv, getServerEnv, getSupabaseAdminEnv } from "@/lib/env"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
  vi.stubEnv("SUPABASE_SECRET_KEY", "")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-public")
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-server")
})
afterEach(() => vi.unstubAllEnvs())

describe("Supabase API key migration", () => {
  it("supports the existing legacy configuration on server and browser", () => {
    expect(getSupabaseAdminEnv()).toMatchObject({ supabaseAnonKey: "legacy-public", supabaseServiceRoleKey: "legacy-server" })
    createSupabaseBrowserClient()
    expect(createBrowserClient).toHaveBeenCalledWith("http://localhost:3000", "legacy-public", undefined)
  })

  it("uses publishable and secret keys without requiring legacy keys", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic")
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic")
    expect(getSupabaseAdminEnv()).toMatchObject({ supabaseAnonKey: "sb_publishable_synthetic", supabaseServiceRoleKey: "sb_secret_synthetic" })
    expect(getServerEnv().supabaseServiceRoleKey).toBe("sb_secret_synthetic")
    expect(getOptionalServerEnv().supabaseAnonKey).toBe("sb_publishable_synthetic")
    createSupabaseBrowserClient()
    expect(createBrowserClient).toHaveBeenCalledWith("http://localhost:3000", "sb_publishable_synthetic", undefined)
  })

  it("prefers new keys consistently when both names are configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "preferred-public")
    vi.stubEnv("SUPABASE_SECRET_KEY", "preferred-server")
    expect(getSupabaseAdminEnv()).toMatchObject({ supabaseAnonKey: "preferred-public", supabaseServiceRoleKey: "preferred-server" })
    expect(getOptionalServerEnv()).toMatchObject({ supabaseAnonKey: "preferred-public", supabaseServiceRoleKey: "preferred-server" })
    createSupabaseBrowserClient(true)
    expect(createBrowserClient).toHaveBeenCalledWith("http://localhost:3000", "preferred-public", { isSingleton: false, auth: { detectSessionInUrl: false } })
  })

  it("never uses the server secret as a missing public key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic")
    expect(() => getPublicEnv()).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    expect(() => createSupabaseBrowserClient()).toThrow("environment variables are missing")
    expect(createBrowserClient).not.toHaveBeenCalled()
  })

  it("requires a separate server key for privileged operations", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    expect(getPublicEnv().supabaseAnonKey).toBe("legacy-public")
    expect(() => getSupabaseAdminEnv()).toThrow("SUPABASE_SECRET_KEY")
  })
})
