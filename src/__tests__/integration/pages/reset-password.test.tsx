import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent } from "@testing-library/react"
import { createBrowserClient } from "@supabase/ssr"
import { render, screen } from "@/test/utils/render"
import ResetPasswordPage from "@/app/reset-password/page"
import { passwordUpdateError, recoveryError } from "@/lib/auth/password-recovery"

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }))
vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("@supabase/ssr", () => ({ createBrowserClient: vi.fn() }))

function setup(role = "student", status = "active") {
  window.history.replaceState({}, "", "/reset-password")
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
    setSession: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null }),
  }
  const single = vi.fn().mockResolvedValue({ data: { role, status }, error: null })
  const eq = vi.fn(() => ({ single }))
  const supabase = { auth, from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })) }
  vi.mocked(createBrowserClient).mockReturnValue(supabase as unknown as ReturnType<typeof createBrowserClient>)
  return { auth, eq, single }
}

async function fill(password = "NewPassword123", confirm = password) {
  const input = await screen.findByLabelText("New password")
  fireEvent.change(input, { target: { value: password } })
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } })
  fireEvent.submit(input.closest("form")!)
}

describe("password reset form (mocked Supabase)", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([["student", "/student"], ["instructor", "/instructor"], ["super_admin", "/admin"]])(
    "updates the authenticated %s password and offers %s after success", async (role, destination) => {
      const { auth, eq } = setup(role)
      render(<ResetPasswordPage />)
      await fill()
      expect(await screen.findByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", destination)
      expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "NewPassword123" })
      expect(auth.getUser).toHaveBeenCalledTimes(2)
      expect(eq).toHaveBeenCalledWith("auth_user_id", "auth-user")
      expect(screen.getByRole("status")).toHaveTextContent("Your password has been updated")
      expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
      expect(router.replace).not.toHaveBeenCalled()
    })

  it("supports existing forgot-password links pointing directly at reset-password", async () => {
    const { auth } = setup()
    window.history.replaceState({}, "", "/reset-password?code=test&next=https://evil.example")
    render(<ResetPasswordPage />)
    await fill()
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test")
    expect(auth.getUser).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "/student")
  })

  it("establishes a recovery session from token_hash on first load", async () => {
    const { auth } = setup()
    window.history.replaceState({}, "", "/reset-password?token_hash=recovery-token&type=recovery")
    render(<ResetPasswordPage />)
    await fill()
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "recovery-token", type: "recovery" })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "/student")
  })

  it("establishes an invite session from token_hash on first load", async () => {
    const { auth } = setup()
    window.history.replaceState({}, "", "/reset-password?token_hash=invite-token&type=invite")
    render(<ResetPasswordPage />)
    await fill()
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "invite-token", type: "invite" })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "/student")
  })

  it("establishes a session from access_token and refresh_token on first load", async () => {
    const { auth } = setup()
    window.history.replaceState({}, "", '/reset-password#access_token=access-token&refresh_token=refresh-token&type=recovery')
    render(<ResetPasswordPage />)
    await fill()
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "access-token", refresh_token: "refresh-token" })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "/student")
  })

  it("does not exchange credentials more than once", async () => {
    const { auth } = setup()
    window.history.replaceState({}, "", "/reset-password?token_hash=recovery-token&type=recovery")
    render(<ResetPasswordPage />)
    await fill()
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1)
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(auth.setSession).not.toHaveBeenCalled()
  })

  it.each([["short", "short", "at least 8"], ["NewPassword123", "", "confirm your password"],
    ["NewPassword123", "OtherPassword123", "Passwords do not match"]])(
    "rejects invalid password fields before mutation", async (password, confirm, message) => {
      const { auth } = setup()
      render(<ResetPasswordPage />)
      await fill(password, confirm)
      expect(await screen.findByRole("alert")).toHaveTextContent(message)
      expect(auth.updateUser).not.toHaveBeenCalled()
    })

  it("blocks unauthenticated direct visits", async () => {
    const { auth } = setup()
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    render(<ResetPasswordPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent(recoveryError)
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it.each([null, { id: "different-user" }])("blocks lost or changed sessions on submit", async (user) => {
    const { auth } = setup()
    render(<ResetPasswordPage />)
    await screen.findByLabelText("New password")
    auth.getUser.mockResolvedValue({ data: { user }, error: null })
    await fill()
    expect(await screen.findByRole("alert")).toHaveTextContent(recoveryError)
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
  })

  it.each(["returned", "thrown"])("shows a safe message for %s password update failures", async (kind) => {
    const { auth } = setup()
    if (kind === "returned") auth.updateUser.mockResolvedValue({ error: { message: "secret password internals" } })
    else auth.updateUser.mockRejectedValue(new Error("secret password internals"))
    render(<ResetPasswordPage />)
    await fill()
    expect(await screen.findByRole("alert")).toHaveTextContent(passwordUpdateError)
    expect(screen.queryByText(/secret password internals/)).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Continue to dashboard" })).not.toBeInTheDocument()
  })

  it.each([["student", "inactive"], ["instructor", "suspended"], ["unknown", "active"]])(
    "uses login for unavailable profile access", async (role, status) => {
      setup(role, status)
      render(<ResetPasswordPage />)
      await fill()
      expect(await screen.findByRole("link", { name: "Continue to login" })).toHaveAttribute("href", "/login")
    })

  it("retains success when profile lookup throws", async () => {
    const { single, auth } = setup()
    single.mockRejectedValue(new Error("lookup failed"))
    render(<ResetPasswordPage />)
    await fill()
    expect(await screen.findByRole("link", { name: "Continue to login" })).toHaveAttribute("href", "/login")
    expect(auth.updateUser).toHaveBeenCalledOnce()
  })
})
