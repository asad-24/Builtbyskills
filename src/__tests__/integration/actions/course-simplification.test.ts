import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail: vi.fn() }))
import { createCourseDraftAction, updateCourseAction, updateCoursePublicationAction } from "@/actions/admin"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const id = "550e8400-e29b-41d4-a716-446655440001"
const required = { title: "AI", short_description: "Learn AI", description: "Try AI.", price: "0" }
function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
function setup() {
  const { mock } = createSupabaseMock()
  vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
  const courses = mock.from("courses")
  courses.single.mockResolvedValue({ data: { id }, error: null })
  return { mock, courses }
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue({ id, role: "super_admin" } as never) })

describe("simplified course actions", () => {
  it("creates short trimmed content as a draft with an automatic address and no invented optional values", async () => {
    const { courses } = setup()
    const result = await createCourseDraftAction(undefined, form({ ...required, title: " AI ", status: "published", slug: "browser-address" }))
    expect(result).toEqual({ ok: true, message: "Course created.", nextHref: `/admin/course-builder/${id}` })
    expect(courses.insert).toHaveBeenCalledWith(expect.objectContaining({ title: "AI", slug: expect.stringMatching(/^ai-[a-f0-9]{8}$/), status: "draft", category: "", level: "", instructor_id: null, price: 0, currency: "PKR" }))
  })
  it.each(["title", "short_description", "description"])("rejects whitespace-only %s", async field => {
    const { courses } = setup()
    const result = await createCourseDraftAction(undefined, form({ ...required, [field]: "   " }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain("required")
    expect(result.message).not.toMatch(/Zod|invalid_type|\{|\[/)
    expect(courses.insert).not.toHaveBeenCalled()
  })
  it.each(["", "   ", "-1", "NaN", "Infinity"])("rejects an unintentional or invalid fee %j", async price => {
    const { courses } = setup()
    const result = await createCourseDraftAction(undefined, form({ ...required, price }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain("Price")
    expect(courses.insert).not.toHaveBeenCalled()
  })
  it("preserves every omitted legacy value by updating only the submitted course name", async () => {
    const { courses } = setup()
    expect((await updateCourseAction(undefined, form({ id, title: "New name" }))).ok).toBe(true)
    expect(courses.update).toHaveBeenCalledWith({ title: "New name" })
    // No default currency/status/category, regenerated slug, cleared image, arrays, or instructor is written.
    expect(courses.eq).toHaveBeenCalledWith("id", id)
  })
  it("supports deliberate clearing and turning catalog priority off", async () => {
    const { courses } = setup()
    expect((await updateCourseAction(undefined, form({ id, thumbnail_url: "", duration_text: "", instructor_id: "", outcomes: "", featured: "false" }))).ok).toBe(true)
    expect(courses.update).toHaveBeenCalledWith({ thumbnail_url: null, duration_text: null, instructor_id: null, outcomes: [], featured: false })
  })
  it("does not let an empty edited fee overwrite a stored price", async () => {
    const { courses } = setup()
    const result = await updateCourseAction(undefined, form({ id, price: "" }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain("Price")
    expect(courses.update).not.toHaveBeenCalled()
  })
  it.each(["draft", "published", "unpublished", "archived"])("manages %s without overwriting course details", async status => {
    const { courses } = setup()
    expect((await updateCoursePublicationAction(undefined, form({ id, status, currency: "PKR", title: "untrusted" }))).ok).toBe(true)
    expect(courses.update).toHaveBeenCalledWith({ status })
  })
  it("rejects invalid identities and unauthorized edits", async () => {
    const { courses } = setup()
    expect((await updateCourseAction(undefined, form({ id: "invalid", title: "Name" }))).ok).toBe(false)
    vi.mocked(requireAdmin).mockRejectedValue(new Error("private auth details"))
    expect((await updateCourseAction(undefined, form({ id, title: "Name" }))).ok).toBe(false)
    expect(courses.update).not.toHaveBeenCalled()
  })
})
