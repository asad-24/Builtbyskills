import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { render, screen } from "@/test/utils/render"

vi.mock("@/actions/admin", () => ({
  createInstructorAction: vi.fn(async () => ({ ok: true, message: "Instructor created." })),
}))

import { CreateInstructorDialog } from "@/components/admin/instructor-actions"

describe("CreateInstructorDialog", () => {
  it("opens the create instructor modal from the header button", async () => {
    const user = userEvent.setup()
    render(<CreateInstructorDialog />)

    await user.click(screen.getByRole("button", { name: "Create instructor" }))

    expect(screen.getByRole("dialog", { name: "Create instructor" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Full name" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("type", "email")
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("active")
  })
})
