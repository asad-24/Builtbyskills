import { describe, it, expect, vi, beforeEach } from "vitest"
import { createBrowserClient } from "@supabase/ssr"

const mockPush = vi.fn()

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

import { render, waitFor } from "@/test/utils/render"
import AuthCallbackPage from "@/app/auth/callback/page"

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    mockPush.mockClear()
    vi.clearAllMocks()
  })

  it("redirects to /student for student role", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "student" },
              error: null,
            }),
          })),
        })),
      })),
    }

    vi.mocked(createBrowserClient).mockReturnValue(mockSupabase as any)

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/student")
    })
  })

  it("redirects to /instructor for instructor role", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-2" } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "instructor" },
              error: null,
            }),
          })),
        })),
      })),
    }

    vi.mocked(createBrowserClient).mockReturnValue(mockSupabase as any)

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/instructor")
    })
  })

  it("redirects to /admin for super_admin role", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-3" } },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { role: "super_admin" },
              error: null,
            }),
          })),
        })),
      })),
    }

    vi.mocked(createBrowserClient).mockReturnValue(mockSupabase as any)

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin")
    })
  })

  it("redirects to /login when no user", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
      })),
    }

    vi.mocked(createBrowserClient).mockReturnValue(mockSupabase as any)

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login?error=Session+not+established")
    })
  })
})
