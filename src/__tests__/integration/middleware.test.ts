import { vi, describe, it, expect, beforeEach } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("next/server", () => {
  const next = vi.fn(() => ({ status: 200 }))
  const redirect = vi.fn((url: URL) => ({
    status: 302,
    headers: new Headers({ Location: url.toString() }),
  }))
  return { NextResponse: { next, redirect } }
})

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/env", () => ({
  getPublicEnv: vi.fn(() => ({
    siteUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
  })),
}))

import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import { middleware } from "@/middleware"

function createMockRequest(pathname: string) {
  return {
    url: `http://localhost:3000${pathname}`,
    nextUrl: { pathname },
    cookies: {
      getAll: () => [],
    },
  }
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows public routes without authentication", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: null },
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/login") as any)

    expect(NextResponse.next).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("allows public route with trailing slash without authentication", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: null },
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/courses") as any)

    expect(NextResponse.next).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("allows API routes without authentication", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: null },
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/api/skills") as any)

    expect(NextResponse.next).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("redirects to /login for protected routes when not authenticated", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: null },
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/admin/courses") as any)

    expect(NextResponse.redirect).toHaveBeenCalled()
    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("http://localhost:3000/login")
  })

  it("allows admin routes for super_admin users", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
    })
    mock.from("profiles").single.mockResolvedValue({
      data: { role: "super_admin" },
      error: null,
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/admin/courses") as any)

    expect(NextResponse.next).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("redirects non-admin users from admin routes", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: { id: "student-1" } },
    })
    mock.from("profiles").single.mockResolvedValue({
      data: { role: "student" },
      error: null,
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/admin/courses") as any)

    expect(NextResponse.redirect).toHaveBeenCalled()
    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("http://localhost:3000/login")
  })

  it("allows instructor routes for instructor users", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: { id: "instructor-1" } },
    })
    mock.from("profiles").single.mockResolvedValue({
      data: { role: "instructor" },
      error: null,
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/instructor/dashboard") as any)

    expect(NextResponse.next).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("allows student routes for student users", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: { id: "student-1" } },
    })
    mock.from("profiles").single.mockResolvedValue({
      data: { role: "student" },
      error: null,
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/student/dashboard") as any)

    expect(NextResponse.next).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })
})
