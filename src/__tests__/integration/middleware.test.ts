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

    const response = await middleware(createMockRequest("/courses/") as any)

    expect(NextResponse.next).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("allows API routes without authentication", async () => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({
      data: { user: null },
    })
    vi.mocked(createServerClient).mockReturnValue(mock)

    const response = await middleware(createMockRequest("/api/storage/payment-screenshot-upload") as any)

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

  const publicPaths = [
    "/", "/about", "/contact", "/courses", "/courses/some-slug",
    "/courses/another-slug", "/how-to-join", "/enroll", "/privacy-policy", "/terms",
    "/login", "/forgot-password", "/reset-password", "/auth/callback",
    "/enroll/", "/auth/callback/",
  ]

  it.each(publicPaths)("allows anonymous access to %s without a profile query", async (path) => {
    const { mock } = createSupabaseMock()
    vi.mocked(createServerClient).mockReturnValue(mock)
    const response = await middleware(createMockRequest(path) as any)
    expect(response.status).toBe(200)
    expect(NextResponse.redirect).not.toHaveBeenCalled()
    expect(createServerClient).not.toHaveBeenCalled()
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.auth.getUser).not.toHaveBeenCalled()
  })

  it.each(publicPaths)("keeps authenticated visitors on public route %s", async (path) => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    vi.mocked(createServerClient).mockReturnValue(mock)
    expect((await middleware(createMockRequest(path) as any)).status).toBe(200)
    expect(NextResponse.redirect).not.toHaveBeenCalled()
    expect(createServerClient).not.toHaveBeenCalled()
    expect(mock.from).not.toHaveBeenCalled()
  })

  it.each([
    "/admin", "/admin/courses", "/instructor", "/instructor/courses",
    "/student", "/student/lessons/some-id", "/courses-admin", "/enrollment",
    "/login-admin", "/auth/callback-admin", "/about/private", "/enroll/private",
  ])("does not classify %s as public", async (path) => {
    const { mock } = createSupabaseMock()
    vi.mocked(createServerClient).mockReturnValue(mock)
    const response = await middleware(createMockRequest(path) as any)
    expect(response.headers.get("Location")).toBe("http://localhost:3000/login")
  })

  it.each([
    ["student", "/admin"], ["instructor", "/admin/courses"],
    ["super_admin", "/student"], ["instructor", "/student/courses"],
    ["student", "/instructor"], ["super_admin", "/instructor/courses"],
  ])("blocks role %s from %s", async (role, path) => {
    const { mock } = createSupabaseMock()
    mock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mock.from("profiles").single.mockResolvedValue({ data: { role }, error: null })
    vi.mocked(createServerClient).mockReturnValue(mock)
    expect((await middleware(createMockRequest(path) as any)).headers.get("Location"))
      .toBe("http://localhost:3000/login")
  })

  it("allows the login destination after redirecting an anonymous dashboard request", async () => {
    const { mock } = createSupabaseMock()
    vi.mocked(createServerClient).mockReturnValue(mock)
    const blocked = await middleware(createMockRequest("/student") as any)
    const destination = new URL(blocked.headers.get("Location")!)
    expect((await middleware(createMockRequest(destination.pathname) as any)).status).toBe(200)
    expect(NextResponse.redirect).toHaveBeenCalledTimes(1)
  })
})
