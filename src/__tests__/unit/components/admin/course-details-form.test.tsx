import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CourseDetailsForm, CoursePublication } from "@/components/admin/course-details-form"
import type { Course } from "@/types/lms"

vi.mock("@/actions/admin", () => ({
  createCourseDraftAction: vi.fn(async () => ({ ok: true, message: "Course created.", nextHref: "/admin/course-builder/new-course" })),
  updateCourseAction: vi.fn(), updateCoursePublicationAction: vi.fn(),
}))
vi.mock("@/components/admin/thumbnail-upload-input", () => ({ ThumbnailUploadInput: ({ name, defaultValue }: { name: string; defaultValue?: string }) => <input type="hidden" name={name} value={defaultValue ?? ""} /> }))

const course: Course = {
  id: "550e8400-e29b-41d4-a716-446655440001", title: "Legacy course", slug: "stable-address",
  short_description: "Legacy summary", description: "Legacy description", price: 25.5, currency: "USD", status: "archived",
  thumbnail_url: "https://example.com/image.png", category: "Existing category", level: "Existing level", duration_text: "6 weeks",
  instructor_id: "550e8400-e29b-41d4-a716-446655440002", featured: true, outcomes: ["Learn skills"], requirements: ["Legacy requirements"],
  created_at: "2026-10-01", updated_at: "2026-10-01",
}
const instructorOptions = [{ value: "", label: "No instructor" }]

describe("non-technical course details", () => {
  it("retains legacy visible values, currency and unavailable instructor without submitting hidden configuration", () => {
    const { container } = render(<CourseDetailsForm course={course} instructorOptions={instructorOptions} />)
    expect(screen.getByLabelText(/Course fee \(USD\)/)).toHaveValue(25.5)
    const data = new FormData(container.querySelector("form")!)
    for (const field of ["slug", "currency", "status", "requirements"]) expect(data.has(field)).toBe(false)
    expect(data.get("thumbnail_url")).toBe(course.thumbnail_url)
    expect(data.get("instructor_id")).toBe(course.instructor_id)
    expect(data.get("category")).toBe(course.category)
    expect(data.get("level")).toBe(course.level)
    expect(data.get("featured")).toBe("true")
    expect(data.get("outcomes")).toBe("Learn skills")
  })
  it("lets admins add and remove learning outcomes without handling array syntax", async () => {
    const user = userEvent.setup()
    const { container } = render(<CourseDetailsForm instructorOptions={instructorOptions} />)
    await user.click(screen.getByText("Additional details (optional)"))
    await user.click(screen.getByRole("button", { name: "Add learning outcome" }))
    await user.type(screen.getByLabelText("Learning outcome 1"), "Build a store")
    await user.click(screen.getByRole("button", { name: "Add learning outcome" }))
    await user.type(screen.getByLabelText("Learning outcome 2"), "Sell products")
    await user.click(screen.getByRole("button", { name: "Remove learning outcome 1" }))
    expect(new FormData(container.querySelector("form")!).get("outcomes")).toBe("Sell products")
  })
  it("offers a builder continuation after saving a draft", async () => {
    const user = userEvent.setup()
    render(<CourseDetailsForm instructorOptions={instructorOptions} />)
    await user.type(screen.getByLabelText("Course name"), "AI")
    await user.type(screen.getByLabelText("Brief summary"), "Learn AI")
    await user.type(screen.getByLabelText("About this course"), "Try AI.")
    await user.type(screen.getByLabelText(/Course fee/), "0")
    await user.click(screen.getByRole("button", { name: "Save draft and add lessons" }))
    expect(await screen.findByRole("link", { name: "Continue to Course Builder" })).toHaveAttribute("href", "/admin/course-builder/new-course")
  })
  it.each(["draft", "published", "unpublished", "archived"] as const)("shows %s and explicit publication actions without suggesting enrollment is revoked", status => {
    render(<CoursePublication course={{ ...course, status }} />)
    expect(screen.getByText(/Course link:/)).toHaveTextContent("/courses/stable-address")
    expect(screen.getByText(/does not remove access for enrolled students/)).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })
})
