import { StrictMode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createBrowserClient } from "@supabase/ssr"
import { render, screen, waitFor } from "@/test/utils/render"
import AuthCallbackPage from "@/app/auth/callback/page"
import { recoveryError } from "@/lib/auth/password-recovery"

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }))
vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("@supabase/ssr", () => ({ createBrowserClient: vi.fn() }))

function setup(path: string) {
  window.history.replaceState({}, "", path)
  const auth = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
    setSession: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
  }
  vi.mocked(createBrowserClient).mockReturnValue({ auth } as unknown as ReturnType<typeof createBrowserClient>)
  return auth
}

describe("password callback (mocked Supabase)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("exchanges a PKCE code once under Strict Mode and ignores external next", async () => {
    const auth = setup("/auth/callback?code=test-code&next=https://evil.example")
    auth.exchangeCodeForSession.mockImplementation(async () => {
      expect(window.location.search).toContain("code=test-code")
      return { data: { user: { id: "auth-user" } }, error: null }
    })
    render(<StrictMode><AuthCallbackPage /></StrictMode>)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reset-password"))
    expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("test-code")
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(window.location.search).toBe("")
    expect(createBrowserClient).toHaveBeenCalledWith(expect.any(String), expect.any(String),
      { isSingleton: false, auth: { detectSessionInUrl: false } })
  })

  it.each(["recovery", "invite"])("verifies a %s token hash", async (type) => {
    const auth = setup("/auth/callback?token_hash=test-hash&type=" + type)
    render(<AuthCallbackPage />)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reset-password"))
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "test-hash", type })
  })

  it.each(["recovery", "invite"])("establishes a %s session from Supabase's verified link fragment", async (type) => {
    const auth = setup("/auth/callback#access_token=test-access&refresh_token=test-refresh&type=" + type)
    render(<AuthCallbackPage />)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/reset-password"))
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "test-access", refresh_token: "test-refresh" })
    expect(window.location.hash).toBe("")
  })

  it.each([
    "/auth/callback", "/auth/callback?code=", "/auth/callback?type=recovery",
    "/auth/callback?token_hash=test&type=signup",
    "/auth/callback#error=access_denied&error_code=otp_expired&error_description=secret",
    "/auth/callback#access_token=test&type=recovery",
  ])("rejects missing/malformed/expired link %s even with an existing user", async (path) => {
    const auth = setup(path)
    render(<AuthCallbackPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent(recoveryError)
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
    expect(screen.queryByText("secret")).not.toBeInTheDocument()
  })

  it.each(["exchangeCodeForSession", "verifyOtp", "setSession"] as const)("fails safely when %s rejects invalid/expired/reused credentials", async (method) => {
    const urls = {
      exchangeCodeForSession: "/auth/callback?code=reused",
      verifyOtp: "/auth/callback?token_hash=expired&type=recovery",
      setSession: "/auth/callback#access_token=invalid&refresh_token=invalid&type=recovery",
    }
    const auth = setup(urls[method])
    auth[method].mockResolvedValue({ error: { message: "sensitive internal message" } })
    render(<AuthCallbackPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent(recoveryError)
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("requires a verified user after exchange", async () => {
    const auth = setup("/auth/callback?code=test")
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: null })
    render(<AuthCallbackPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent(recoveryError)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("hides thrown exchange errors", async () => {
    const auth = setup("/auth/callback?code=test")
    auth.exchangeCodeForSession.mockRejectedValue(new Error("secret"))
    render(<AuthCallbackPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent(recoveryError)
    expect(router.replace).not.toHaveBeenCalled()
  })
})
