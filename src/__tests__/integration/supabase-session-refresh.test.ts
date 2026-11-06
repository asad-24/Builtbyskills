import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }))
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({ supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "synthetic-public-key" }),
}))

import { createServerClient } from "@supabase/ssr"
import { proxy } from "@/proxy"

const cacheHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
}
function sessionWriter() {
  const writer = vi.mocked(createServerClient).mock.calls.at(-1)?.[2].cookies.setAll
  if (!writer) throw new Error("Expected the SSR cookie adapter")
  return writer
}

describe("Supabase session refresh through Next.js Proxy", () => {
  beforeEach(() => vi.clearAllMocks())

  it("forwards refreshed cookies to the render and browser, retaining cache protection across multiple writes", async () => {
    const request = new NextRequest("https://academy.example/student", {
      headers: { cookie: "sb-example-auth-token.0=expired; sb-example-auth-token.1=stale-chunk" },
    })
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockImplementation(async () => {
      const write = sessionWriter()
      await write([
        { name: "sb-example-auth-token.0", value: "refreshed-token", options: { path: "/", httpOnly: true, secure: true } },
        { name: "sb-example-auth-token.1", value: "", options: { path: "/", maxAge: 0 } },
      ], cacheHeaders)
      // SSR supplies cache headers only with the first write from this client.
      await write([{ name: "sb-example-flow-state", value: "updated", options: { path: "/" } }], {})
      return { data: { user: { id: "student-id" } }, error: null }
    })
    mock.from("profiles").single.mockResolvedValue({ data: { role: "student" }, error: null })
    vi.mocked(createServerClient).mockReturnValue(mock as never)

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(request.cookies.get("sb-example-auth-token.0")?.value).toBe("refreshed-token")
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-example-auth-token.0=refreshed-token")
    expect(response.headers.get("x-middleware-request-cookie")).not.toContain("expired")
    expect(response.cookies.get("sb-example-auth-token.0")).toMatchObject({ value: "refreshed-token", httpOnly: true, secure: true })
    expect(response.cookies.get("sb-example-auth-token.1")).toMatchObject({ value: "", maxAge: 0 })
    expect(response.cookies.get("sb-example-flow-state")?.value).toBe("updated")
    for (const [name, value] of Object.entries(cacheHeaders)) expect(response.headers.get(name)).toBe(value)
  })

  it.each([
    { method: "GET", hasUser: false }, { method: "POST", hasUser: false },
    { method: "GET", hasUser: true }, { method: "POST", hasUser: true },
  ])("preserves session cookies and cache headers on denied $method requests (signed in: $hasUser)", async ({ method, hasUser }) => {
    const request = new NextRequest("https://academy.example/admin", {
      method, headers: method === "POST" ? { "next-action": "synthetic-action" } : {},
    })
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockImplementation(async () => {
      await sessionWriter()([
        { name: "sb-example-auth-token", value: hasUser ? "refreshed-student-token" : "", options: { path: "/", ...(hasUser ? { secure: true } : { maxAge: 0 }) } },
      ], cacheHeaders)
      return { data: { user: hasUser ? { id: "student-id" } : null }, error: null }
    })
    mock.from("profiles").single.mockResolvedValue({ data: { role: "student" }, error: null })
    vi.mocked(createServerClient).mockReturnValue(mock as never)

    const response = await proxy(request)

    expect(response.status).toBe(method === "POST" ? 200 : 307)
    if (method === "POST") {
      expect(response.headers.get("x-action-redirect")).toBe("/login;replace")
      expect(response.headers.has("x-middleware-next")).toBe(false)
    } else expect(response.headers.get("location")).toBe("https://academy.example/login")
    expect(response.cookies.get("sb-example-auth-token")?.value).toBe(hasUser ? "refreshed-student-token" : "")
    if (!hasUser) expect(response.cookies.get("sb-example-auth-token")?.maxAge).toBe(0)
    for (const [name, value] of Object.entries(cacheHeaders)) expect(response.headers.get(name)).toBe(value)
  })
})
