import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail: vi.fn() }))
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createCourseAction, createLessonAction, createSectionAction, updateLessonAction, updateSectionAction } from "@/actions/admin"
import { AppForbiddenError } from "@/lib/errors"

const id = "550e8400-e29b-41d4-a716-446655440001"
const fields = { section_id: id, title: "A useful lesson", description: "Lesson content", lesson_type: "text", status: "draft" }
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data }
function setup() {
  const { mock } = createSupabaseMock()
  vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
  return { mock, lessons: mock.from("lessons"), sections: mock.from("course_sections") }
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue({ id: "admin", role: "super_admin" } as never) })

describe("course builder mutations", () => {
  it("generates a lesson slug and appends after the highest stored position", async () => {
    const { lessons } = setup()
    lessons.maybeSingle.mockResolvedValue({ data: { position: 8 }, error: null })
    lessons.single.mockResolvedValue({ data: { id, course_sections: { course_id: id } }, error: null })
    expect((await createLessonAction(undefined, form({ ...fields, slug: "browser-slug", position: "1", duration_seconds: "999", is_preview: "true" }))).ok).toBe(true)
    expect(lessons.insert).toHaveBeenCalledWith(expect.objectContaining({ position: 9, slug: expect.stringMatching(/^a-useful-lesson-[a-f0-9]{8}$/), duration_seconds: 0, is_preview: false, youtube_video_id: null }))
  })
  it("re-reads append position after a concurrent insert", async () => {
    const { lessons } = setup()
    lessons.maybeSingle.mockResolvedValueOnce({ data: { position: 8 }, error: null }).mockResolvedValueOnce({ data: { position: 9 }, error: null })
    lessons.single.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "private constraint" } }).mockResolvedValueOnce({ data: { id }, error: null })
    expect((await createLessonAction(undefined, form(fields))).ok).toBe(true)
    expect(lessons.insert.mock.calls.map((call: [{ position: number }]) => call[0].position)).toEqual([9, 10])
  })
  it("bounds append retries and hides constraint details", async () => {
    const { lessons } = setup()
    lessons.single.mockResolvedValue({ data: null, error: { code: "23505", message: "private constraint" } })
    const result = await createLessonAction(undefined, form(fields))
    expect(result.ok).toBe(false)
    expect(result.message).toContain("same time")
    expect(result.message).not.toContain("constraint")
    expect(lessons.insert).toHaveBeenCalledTimes(4)
  })
  it("appends sections without moving existing content", async () => {
    const { sections } = setup()
    sections.maybeSingle.mockResolvedValue({ data: { position: 12 }, error: null })
    sections.single.mockResolvedValue({ data: { id }, error: null })
    expect((await createSectionAction(undefined, form({ course_id: id, title: "New section", position: "1" }))).ok).toBe(true)
    expect(sections.insert).toHaveBeenCalledWith({ course_id: id, title: "New section", description: null, position: 13 })
    expect(sections.update).not.toHaveBeenCalled()
  })
  it("edits content while retaining legacy Mux data, slug, order, duration, and preview", async () => {
    const { lessons } = setup()
    lessons.single.mockResolvedValue({ data: { id, mux_asset_id: "legacy", mux_playback_id: "legacy-playback", duration_seconds: 300, slug: "old-address", position: 9, is_preview: true, section: { course_id: id } }, error: null })
    lessons.maybeSingle.mockResolvedValue({ data: { id }, error: null })
    expect((await updateLessonAction(undefined, form({ ...fields, id, updated_at: "old-version", status: "published", slug: "replacement", position: "1", mux_playback_id: "untrusted" }))).ok).toBe(true)
    expect(lessons.update).toHaveBeenCalledWith({ title: fields.title, description: fields.description, lesson_type: "text", status: "published" })
    expect(lessons.eq).toHaveBeenCalledWith("updated_at", "old-version")
  })
  it("rejects stale lesson edits", async () => {
    const { lessons } = setup()
    lessons.single.mockResolvedValue({ data: { id }, error: null })
    const result = await updateLessonAction(undefined, form({ ...fields, id, updated_at: "stale" }))
    expect(result.message).toContain("Refresh")
    expect(result.ok).toBe(false)
  })
  it.each(["video", "pdf_resource", "external_resource"])("requires attached %s content before publishing", async lesson_type => {
    const { lessons } = setup()
    lessons.single.mockResolvedValue({ data: { id, lesson_resources: [] }, error: null })
    expect((await updateLessonAction(undefined, form({ ...fields, lesson_type, id, updated_at: "old-version", status: "published" }))).ok).toBe(false)
    expect(lessons.update).not.toHaveBeenCalled()
  })
  it("does not accept browser-supplied Mux IDs during creation", async () => {
    expect((await createLessonAction(undefined, form({ ...fields, lesson_type: "video", mux_asset_id: "untrusted" }))).ok).toBe(false)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
  it("returns friendly validation instead of Zod JSON", async () => {
    const result = await createLessonAction(undefined, form({ ...fields, title: "", section_id: "invalid" }))
    expect(result.message).not.toMatch(/Zod|\{|\[|invalid_type|path|code/)
    expect(result.ok).toBe(false)
  })
  it.each([createCourseAction, createSectionAction, createLessonAction, updateLessonAction, updateSectionAction])("requires admin authorization", async action => {
    vi.mocked(requireAdmin).mockRejectedValue(new AppForbiddenError())
    expect((await action(undefined, form(fields))).ok).toBe(false)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
  it("automates course addresses while retaining all course lifecycle states", async () => {
    const { mock } = setup()
    mock.from("courses").single.mockResolvedValue({ data: { id }, error: null })
    const result = await createCourseAction(undefined, form({ title: "Useful Course", short_description: "A useful course description", description: "A sufficiently detailed course description.", category: "Learning", level: "Beginner", price: "1000", currency: "PKR", status: "unpublished" }))
    expect(result.ok).toBe(true)
    expect(mock.from("courses").insert).toHaveBeenCalledWith(expect.objectContaining({ slug: expect.stringMatching(/^useful-course-[a-f0-9]{8}$/), status: "unpublished", featured: false }))
  })
})
