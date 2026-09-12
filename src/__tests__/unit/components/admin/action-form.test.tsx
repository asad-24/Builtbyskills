import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@/test/utils/render"
import userEvent from "@testing-library/user-event"
import { ActionForm } from "@/components/admin/action-form"

const mockAction = vi.fn()

describe("ActionForm", () => {
  beforeEach(() => {
    mockAction.mockClear()
  })

  it("renders children and submit button", () => {
    render(
      <ActionForm action={mockAction} submitLabel="Save">
        <input name="test" />
      </ActionForm>
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "" })).toBeInTheDocument()
  })

  it("shows success message when action returns ok:true", async () => {
    const user = userEvent.setup()
    mockAction.mockResolvedValue({ ok: true, message: "Saved successfully" })

    render(
      <ActionForm action={mockAction} submitLabel="Save">
        <input name="test" defaultValue="value" />
      </ActionForm>
    )

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(screen.getByText("Saved successfully")).toBeInTheDocument()
    })
  })

  it("shows error message when action returns ok:false", async () => {
    const user = userEvent.setup()
    mockAction.mockResolvedValue({ ok: false, message: "Something went wrong" })

    render(
      <ActionForm action={mockAction} submitLabel="Save">
        <input name="test" defaultValue="value" />
      </ActionForm>
    )

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    })
  })

  it("disables button while action is pending", async () => {
    const user = userEvent.setup()
    let resolve: (value: { ok: boolean; message: string }) => void
    mockAction.mockImplementation(
      () =>
        new Promise<{ ok: boolean; message: string }>((r) => {
          resolve = r
        })
    )

    render(
      <ActionForm action={mockAction} submitLabel="Save">
        <input name="test" defaultValue="value" />
      </ActionForm>
    )

    const button = screen.getByRole("button", { name: "Save" })
    await user.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveTextContent("Saving...")

    resolve!({ ok: true, message: "Done" })

    await waitFor(() => {
      expect(button).not.toBeDisabled()
      expect(button).toHaveTextContent("Save")
    })
  })
})
