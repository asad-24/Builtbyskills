import { vi, describe, it, expect, beforeEach } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("server-only", () => ({}))

vi.mock("next/navigation", () => {
  const mockRedirect = vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  })
  return { redirect: mockRedirect }
})

vi.mock("@/lib/email/send", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({
    ok: true as const,
    skipped: false,
    message: "Email sent.",
  }),
}))

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}))

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { signInAction, signOutAction, forgotPasswordAction } from "@/actions/auth"

function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }
  return formData
}

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("signInAction", () => {
    it("redirects to /student when profile role is student", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.signInWithPassword.mockResolvedValue({ error: null })
      mock.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
      })
      mock.from("profiles").single.mockResolvedValue({
        data: { role: "student" },
        error: null,
      })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      const formData = createFormData({
        email: "student@example.com",
        password: "password123",
      })

      await expect(signInAction(formData)).rejects.toThrow("REDIRECT:/student")
      expect(redirect).toHaveBeenCalledWith("/student")
    })

    it("redirects to /instructor when profile role is instructor", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.signInWithPassword.mockResolvedValue({ error: null })
      mock.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-2" } },
      })
      mock.from("profiles").single.mockResolvedValue({
        data: { role: "instructor" },
        error: null,
      })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      const formData = createFormData({
        email: "instructor@example.com",
        password: "password123",
      })

      await expect(signInAction(formData)).rejects.toThrow("REDIRECT:/instructor")
      expect(redirect).toHaveBeenCalledWith("/instructor")
    })

    it("redirects to /admin when profile role is super_admin", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.signInWithPassword.mockResolvedValue({ error: null })
      mock.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-3" } },
      })
      mock.from("profiles").single.mockResolvedValue({
        data: { role: "super_admin" },
        error: null,
      })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      const formData = createFormData({
        email: "admin@example.com",
        password: "password123",
      })

      await expect(signInAction(formData)).rejects.toThrow("REDIRECT:/admin")
      expect(redirect).toHaveBeenCalledWith("/admin")
    })

    it("redirects to /login?error=... on auth failure", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.signInWithPassword.mockResolvedValue({
        error: { message: "Invalid login credentials" },
      })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      const formData = createFormData({
        email: "wrong@example.com",
        password: "wrongpass",
      })

      await expect(signInAction(formData)).rejects.toThrow(
        "REDIRECT:/login?error=Invalid%20login%20credentials"
      )
      expect(redirect).toHaveBeenCalledWith(
        "/login?error=Invalid%20login%20credentials"
      )
    })

    it("redirects to /login?error=Session+not+established when user is null", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.signInWithPassword.mockResolvedValue({ error: null })
      mock.auth.getUser.mockResolvedValue({
        data: { user: null },
      })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      const formData = createFormData({
        email: "nouser@example.com",
        password: "password123",
      })

      await expect(signInAction(formData)).rejects.toThrow(
        "REDIRECT:/login?error=Session+not+established"
      )
      expect(redirect).toHaveBeenCalledWith("/login?error=Session+not+established")
    })
  })

  describe("signOutAction", () => {
    it("redirects to /login after sign out", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.signOut.mockResolvedValue({ error: null })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      await expect(signOutAction()).rejects.toThrow("REDIRECT:/login")
      expect(redirect).toHaveBeenCalledWith("/login")
    })
  })

  describe("forgotPasswordAction", () => {
    it("redirects to /forgot-password?sent=1 on success", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      const formData = createFormData({
        email: "user@example.com",
      })

      await expect(forgotPasswordAction(formData)).rejects.toThrow(
        "REDIRECT:/forgot-password?sent=1"
      )
      expect(redirect).toHaveBeenCalledWith("/forgot-password?sent=1")
      expect(mock.auth.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      })
    })

    it("redirects to /forgot-password?error=... on reset failure", async () => {
      const { mock } = createSupabaseMock()
      mock.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({
        error: { message: "Email not found" },
      })
      vi.mocked(createSupabaseServerClient).mockResolvedValue(mock as any)

      const formData = createFormData({
        email: "missing@example.com",
      })

      await expect(forgotPasswordAction(formData)).rejects.toThrow(
        "REDIRECT:/forgot-password?error=Unable%20to%20send%20a%20reset%20link.%20Please%20try%20again."
      )
      expect(redirect).toHaveBeenCalledWith(
        "/forgot-password?error=Unable%20to%20send%20a%20reset%20link.%20Please%20try%20again."
      )
    })
  })
})
