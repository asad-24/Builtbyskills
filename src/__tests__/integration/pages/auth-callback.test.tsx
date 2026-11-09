import { beforeEach, expect, it, vi } from "vitest"
import { render, screen } from "@/test/utils/render"
import AuthCallbackPage from "@/app/auth/callback/page"
const { resetPassword } = vi.hoisted(() => ({ resetPassword: vi.fn() }))
vi.mock("better-auth/react", () => ({ createAuthClient: () => ({ resetPassword }) }))
beforeEach(() => vi.clearAllMocks())
it("supports a MongoDB password token at the compatibility callback", async () => {
  window.history.replaceState({}, "", "/auth/callback?token=synthetic-recovery-token-1234&next=https://untrusted.test")
  render(<AuthCallbackPage />)
  expect(await screen.findByLabelText("New password")).toBeInTheDocument()
  expect(window.location.pathname).toBe("/reset-password"); expect(window.location.search).toBe("")
})
it("rejects an old provider callback", async () => {
  window.history.replaceState({}, "", "/auth/callback?code=obsolete-code")
  render(<AuthCallbackPage />)
  expect(await screen.findByRole("alert")).toBeInTheDocument(); expect(resetPassword).not.toHaveBeenCalled()
})
