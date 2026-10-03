import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
vi.mock("server-only", () => ({}))
vi.mock("@/features/admin/data", () => ({ getCourseBuilderData: vi.fn() }))
vi.mock("@/actions/admin", () => ({ createCourseDraftAction: vi.fn(), updateCoursePublicationAction: vi.fn(), updateCourseAction: vi.fn(), createLessonAction: vi.fn(), updateLessonAction: vi.fn(), createSectionAction: vi.fn(), updateSectionAction: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: vi.fn() }))
import { getCourseBuilderData } from "@/features/admin/data"
import CourseBuilderPage from "@/app/admin/course-builder/[courseId]/page"

const id = "550e8400-e29b-41d4-a716-446655440001"
const version = "2026-10-01T12:00:00Z"
beforeEach(() => vi.clearAllMocks())

describe("Course Builder content visibility", () => {
  it("opens lesson content controls by default, including lessons with identical versions", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(getCourseBuilderData).mockResolvedValue({ ok: true, data: {
      course: { id, title: "My course", status: "draft", outcomes: [], requirements: [] }, instructors: [],
      sections: [{ id, title: "Introduction", updated_at: version, lessons: [
        { id: "video-lesson", title: "Video lesson", lesson_type: "video", status: "draft", updated_at: version, mux_playback_id: "existing-playback" },
        { id: "file-lesson", title: "File lesson", lesson_type: "pdf_resource", status: "draft", updated_at: version },
        { id: "link-lesson", title: "Link lesson", lesson_type: "external_resource", status: "draft", updated_at: version },
      ] }],
    } } as never)
    try {
      const { container } = render(await CourseBuilderPage({ params: Promise.resolve({ courseId: id }) }))
      for (const label of ["Choose video", "Attach a file", "Link URL"]) {
        const controls = screen.getAllByLabelText(label)
        for (const control of controls) {
          expect(control).toBeVisible()
          if (control.closest("details")) expect(control.closest("details")).toHaveAttribute("open")
        }
      }
      expect(screen.getByText(/replace this lesson's historical video/)).toBeVisible()
      expect(container.querySelector('[name="mux_asset_id"], [name="mux_playback_id"], [name="mux_upload_id"]')).toBeNull()
      expect(error.mock.calls.flat().join(" ")).not.toMatch(/same key/)
    } finally { error.mockRestore() }
  })
  it("shows an accessible safe failure when admin data is unavailable", async () => {
    vi.mocked(getCourseBuilderData).mockResolvedValue({ ok: false, message: "raw database details" } as never)
    render(await CourseBuilderPage({ params: Promise.resolve({ courseId: id }) }))
    expect(screen.getByRole("alert")).toHaveTextContent("sign in with an admin account")
    expect(screen.queryByText("raw database details")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Upload video")).not.toBeInTheDocument()
  })
})
