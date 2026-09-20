import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"

import { render, screen } from "@/test/utils/render"

vi.mock("@/actions/admin", () => ({
  createCourseAction: vi.fn(async () => ({ ok: true, message: "Course created." })),
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
    expect(screen.getByRole("textbox", { name: "Course title" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Slug" })).toHaveAttribute("placeholder", "shopify-and-tiktok-ads")
    expect(screen.getByRole("textbox", { name: "Full description" })).toBeInTheDocument()
    expect(screen.getByLabelText("Thumbnail")).toHaveAttribute("name", "thumbnail_url")
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("draft")
    expect(screen.getByRole("combobox", { name: "Instructor" })).toHaveValue("")
    expect(screen.getByRole("checkbox", { name: "Featured course" })).toBeInTheDocument()
  })
})
