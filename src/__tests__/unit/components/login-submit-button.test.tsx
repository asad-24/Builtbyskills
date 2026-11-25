import { act } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render, screen, waitFor } from "@/test/utils/render"
import { LoginSubmitButton } from "@/components/auth/login-submit-button"

describe("login submission feedback", () => {
  it("shows loading and disables repeat clicks until the action finishes", async () => {
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    const action = vi.fn(async () => { await pending })
    const user = userEvent.setup()
    render(<form action={action}><LoginSubmitButton /></form>)
    const button = screen.getByRole("button", { name: "Sign in" })
    await user.click(button)
    expect(button).toHaveTextContent("Signing in...")
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
    await user.click(button)
    expect(action).toHaveBeenCalledTimes(1)
    await act(async () => { finish(); await pending })
    await waitFor(() => expect(button).toBeEnabled())
    expect(button).toHaveTextContent("Sign in")
    expect(button).toHaveAttribute("aria-busy", "false")
  })
})
