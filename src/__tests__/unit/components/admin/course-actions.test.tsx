import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { render, screen } from "@/test/utils/render"

vi.mock("@/actions/admin", () => ({
  createCourseDraftAction: vi.fn(async () => ({ ok: true, message: "Course created." })),
}))

vi.mock("@/components/admin/thumbnail-upload-input", () => ({
  ThumbnailUploadInput: ({ name }: { name: string }) => (
    <input aria-label="Thumbnail" name={name} type="hidden" value="" />
  ),
}))

import { CreateCourseDialog } from "@/components/admin/course-actions"

describe("CreateCourseDialog", () => {
  it("opens the create course modal from the header button", async () => {
    const user = userEvent.setup()
    render(<CreateCourseDialog instructorOptions={[{ value: "", label: "No instructor" }]} />)

    await user.click(screen.getByRole("button", { name: "Create course" }))

    expect(screen.getByRole("dialog", { name: "Create course" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Course name" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: /address/i })).not.toBeInTheDocument()
    expect(screen.getByText("Additional details (optional)").closest("details")).not.toHaveAttribute("open")
    await user.click(screen.getByText("Additional details (optional)"))
    expect(screen.getByRole("textbox", { name: "About this course" })).toBeInTheDocument()
    expect(screen.getByLabelText("Thumbnail")).toHaveAttribute("name", "thumbnail_url")
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Displayed instructor" })).toHaveValue("")
    expect(screen.getByRole("combobox", { name: "Show first in course catalog" })).toBeInTheDocument()
  })
})
