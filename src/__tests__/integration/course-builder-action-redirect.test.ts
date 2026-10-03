import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }))
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" }) }))

import { createServerClient } from "@supabase/ssr"
import { middleware } from "@/middleware"

const url = "http://localhost:3000/admin/course-builder/course-id"

describe("Course Builder action authorization redirects", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([null, "student"])("redirects a denied action without fetching login HTML (role: %s)", async role => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({ data: { user: role ? { id: "user-id" } : null } })
    mock.from("profiles").single.mockResolvedValue({ data: { role }, error: null })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(new NextRequest(url, { method: "POST", headers: { "next-action": "lesson-action" } }))

    expect(response.status).toBe(200)
    expect(response.headers.get("x-action-redirect")).toBe("/login;replace")
    expect(response.headers.has("location")).toBe(false)
    expect(await response.text()).toBe("")
    expect(response.headers.has("x-middleware-next")).toBe(false)
  })

  it("allows an authenticated admin action to reach its server authorization check", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-id" } } })
    mock.from("profiles").single.mockResolvedValue({ data: { role: "super_admin" }, error: null })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(new NextRequest(url, { method: "POST", headers: { "next-action": "lesson-action" } }))

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.has("x-action-redirect")).toBe(false)
  })

  it("retains the HTTP login redirect for ordinary denied requests", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({ data: { user: null } })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(new NextRequest(url))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("http://localhost:3000/login")
    expect(response.headers.has("x-action-redirect")).toBe(false)
  })
})
