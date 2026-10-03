import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
vi.mock("server-only", () => ({}))
vi.mock("@/features/student/data", () => ({ getStudentDashboardData: vi.fn() }))
import { getStudentDashboardData } from "@/features/student/data"
import CoursesPage from "@/app/student/courses/page"
import DashboardPage from "@/app/student/page"
import { firstAccessibleLesson } from "@/lib/lessons/discovery"
import type { SectionWithLessons } from "@/types/lms"

const now = "2026-10-01T12:00:00Z"
const active = { status: "active" as const, starts_at: null, expires_at: null }
function section(position: number, lessons: { id: string; status: string; position: number }[]): SectionWithLessons {
  return { id: `section-${position}`, position, lessons: lessons.map(lesson => ({ ...lesson, title: lesson.id })) } as SectionWithLessons
}
const published = { id: "available", status: "published", position: 2 }
const draft = { id: "hidden-draft", status: "draft", position: 0 }
const archived = { id: "hidden-archive", status: "archived", position: 1 }
function enrollment(sections: SectionWithLessons[], overrides = {}) {
  return { id: "enrollment", ...active, course: { title: "Course", course_sections: sections }, ...overrides }
}
function data(enrollments: ReturnType<typeof enrollment>[]) {
  vi.mocked(getStudentDashboardData).mockResolvedValue({ ok: true, data: { profile: { full_name: "Student" }, enrollments, progress: [], liveClasses: [], announcements: [], payments: [] } } as never)
}
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(Date, "now").mockReturnValue(Date.parse(now)) })
afterEach(() => vi.restoreAllMocks())

describe("student course discovery", () => {
  it.each([[], [draft], [draft, archived]].map(lessons => ({ lessons })))("finds a published lesson beyond a first section containing $lessons", async ({ lessons }) => {
    const sections = [section(0, lessons), section(1, [published])]
    expect(firstAccessibleLesson(active, sections)?.id).toBe("available")
    data([enrollment(sections)])
    render(await CoursesPage())
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/student/lessons/available")
    expect(screen.queryByText("No published lessons are available yet.")).not.toBeInTheDocument()
  })
  it("respects section and lesson order without mutating curriculum", () => {
    const sections = [section(9, [published]), section(2, [{ ...published, id: "later", position: 8 }, draft, { ...published, id: "first", position: 3 }])]
    expect(firstAccessibleLesson(active, sections)?.id).toBe("first")
    expect(sections.map(item => item.position)).toEqual([9, 2])
    expect(sections[1].lessons?.[0].id).toBe("later")
  })
  it.each([[], [section(0, [])], [section(0, [draft, archived])]].map(sections => ({ sections })))("does not offer draft/archived content when no published lesson exists: $sections", async ({ sections }) => {
    expect(firstAccessibleLesson(active, sections)).toBeUndefined()
    data([enrollment(sections)])
    render(await CoursesPage())
    expect(screen.getByText("No published lessons are available yet.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument()
  })
  it.each([
    { status: "pending" as const }, { status: "suspended" as const }, { status: "expired" as const },
    { starts_at: "2026-10-01T12:00:00.001Z" }, { expires_at: now },
  ])("does not offer lessons for an ineligible enrollment: %j", async overrides => {
    const record = enrollment([section(0, [published])], overrides)
    expect(firstAccessibleLesson({ ...active, ...overrides }, record.course.course_sections)).toBeUndefined()
    data([record])
    render(await CoursesPage())
    expect(screen.getByText("Course access is not currently active.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument()
  })
  it("keeps inclusive start and exclusive expiry boundaries", () => {
    expect(firstAccessibleLesson({ ...active, starts_at: now, expires_at: "2026-10-01T12:00:00.001Z" }, [section(0, [published])])?.id).toBe("available")
  })
  it("continues beyond an empty first course and the next course's first section", async () => {
    data([enrollment([section(0, [draft])]), enrollment([section(0, []), section(1, [published])], { id: "second" })])
    render(await DashboardPage())
    expect(screen.getByRole("link", { name: "Open lesson" })).toHaveAttribute("href", "/student/lessons/available")
  })
  it("dashboard skips future enrollments and gives a clear empty state", async () => {
    data([enrollment([section(0, [published])], { starts_at: "2026-10-02T12:00:00Z" }), enrollment([section(0, [draft, archived])], { id: "second" })])
    render(await DashboardPage())
    expect(screen.queryByRole("link", { name: "Open lesson" })).not.toBeInTheDocument()
    expect(screen.getByText("No published lessons are available yet.")).toBeInTheDocument()
  })
})
