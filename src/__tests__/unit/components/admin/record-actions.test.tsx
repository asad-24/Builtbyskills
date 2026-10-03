import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render, screen } from "@/test/utils/render"
vi.mock("@/actions/admin-records", () => ({ updateInstructorAction: vi.fn() }))
import { DeleteRecord } from "@/components/admin/record-actions"
describe("delete confirmation", () => {
  it("requires explicit confirmation, traps focus, cancels, and reports failure", async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ ok: false, message: "History is preserved. Deactivate instead." }))
    render(<DeleteRecord id="record" updatedAt="timestamp" label="method" description="Permanently delete?" action={action} />)
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(screen.getByRole("alertdialog", { name: "Delete method?" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
    expect(action).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete" }))
    await user.click(screen.getByRole("button", { name: "Confirm delete" }))
    expect(await screen.findByRole("status")).toHaveTextContent("History is preserved")
    expect(action).toHaveBeenCalledTimes(1)
  })
  it("disables resubmission after success", async () => {
    const user = userEvent.setup(); const action = vi.fn(async () => ({ ok: true, message: "Deleted." }))
    render(<DeleteRecord id="record" updatedAt="timestamp" label="submission" description="Delete?" action={action} />)
    await user.click(screen.getByRole("button", { name: "Delete" })); await user.click(screen.getByRole("button", { name: "Confirm delete" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Deleted.")
    expect(screen.queryByRole("button", { name: "Confirm delete" })).not.toBeInTheDocument()
  })
})
