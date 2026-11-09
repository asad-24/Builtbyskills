import { beforeEach, describe, expect, it, vi } from "vitest"
import { StrictMode } from "react"
import { fireEvent } from "@testing-library/react"
import { render, screen } from "@/test/utils/render"
import ResetPasswordPage from "@/app/reset-password/page"
import { recoveryError } from "@/lib/auth/password-recovery"
const { resetPassword } = vi.hoisted(() => ({ resetPassword: vi.fn() }))
vi.mock("better-auth/react", () => ({ createAuthClient: () => ({ resetPassword }) }))
beforeEach(() => { vi.clearAllMocks(); resetPassword.mockResolvedValue({ error: null }); window.history.replaceState({}, "", "/reset-password?token=synthetic-reset-token-123456789") })
async function fill(password = "NewPassword123", confirmPassword = password) {
  const input = await screen.findByLabelText("New password")
  fireEvent.change(input, { target: { value: password } }); fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirmPassword } }); fireEvent.submit(input.closest("form")!)
}
describe("MongoDB password reset", () => {
  it("uses the token once and sends the user to sign in", async () => {
    render(<ResetPasswordPage />); await fill()
    expect(await screen.findByRole("link", { name: "Continue to login" })).toHaveAttribute("href", "/login")
    expect(resetPassword).toHaveBeenCalledExactlyOnceWith({ newPassword: "NewPassword123", token: "synthetic-reset-token-123456789" })
    expect(window.location.search).toBe("")
  })
  it("retains the reset token under Strict Mode", async () => {
    render(<StrictMode><ResetPasswordPage /></StrictMode>); await fill()
    expect(await screen.findByRole("link", { name: "Continue to login" })).toBeInTheDocument()
  })
  it.each(["/reset-password", "/reset-password?error=INVALID_TOKEN", "/reset-password?code=old-supabase-code"])("rejects missing or obsolete tokens: %s", async url => {
    window.history.replaceState({}, "", url); render(<ResetPasswordPage />)
    expect(await screen.findByText(recoveryError)).toBeInTheDocument(); expect(resetPassword).not.toHaveBeenCalled()
  })
  it("shows invalid/expired token errors without claiming success", async () => {
    resetPassword.mockResolvedValue({ error: { code: "INVALID_TOKEN" } }); render(<ResetPasswordPage />); await fill()
    expect(await screen.findByText(recoveryError)).toBeInTheDocument(); expect(screen.queryByText("Your password has been updated. You can now continue.")).not.toBeInTheDocument()
  })
  it("validates password confirmation before sending a request", async () => {
    render(<ResetPasswordPage />); await fill("NewPassword123", "different-password")
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument(); expect(resetPassword).not.toHaveBeenCalled()
  })
})
