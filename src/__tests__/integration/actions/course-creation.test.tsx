import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail: vi.fn() }))

import { createCourseAction, updateCourseAction } from "@/actions/admin"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { ThumbnailUploadInput } from "@/components/admin/thumbnail-upload-input"
import { courseSchema } from "@/lib/validations/lms"

const thumbnail = "https://example.supabase.co/storage/v1/object/public/course-thumbnails/course-thumbnails/image.png"
const fields = {
  title: "Useful Course", slug: "", short_description: "A useful course description",
  description: "A sufficiently detailed course description.", category: "Learning",
  level: "Beginner", price: "1000", currency: "PKR", status: "draft",
  duration_text: "", instructor_id: "", outcomes: "Build stores\n\n Drive sales ", requirements: "",
}
function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ ...fields, thumbnail_url: thumbnail, ...overrides })) data.set(key, value)
  return data
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin", role: "super_admin" } as never)
})
afterEach(() => vi.unstubAllGlobals())
function setup() {
  const { mock } = createSupabaseMock()
  mock.from("courses").single.mockResolvedValue({ data: { id: "course-1" }, error: null })
  vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
  return mock.from("courses")
}

describe("course creation with uploaded thumbnails", () => {
  it("traces the invalid generated address to the slug check, independently of the uploaded image", () => {
    const result = courseSchema.safeParse({ ...fields, title: "a".repeat(79) + " course", slug: "a".repeat(79) + "--12345678", thumbnail_url: thumbnail })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map(issue => issue.path)).toEqual([["slug"]])
    // The previous form required an explicit address; it did not derive one from the title.
    expect(courseSchema.safeParse({ ...fields, title: "a".repeat(79) + " course", slug: "valid-custom-address", thumbnail_url: thumbnail }).success).toBe(true)
  })

  it.each(["Useful Course", "a".repeat(79) + " course"])("creates %s through the actual file upload and hidden FormData value", async title => {
    const courses = setup()
    const uploadToSignedUrl = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createSupabaseBrowserClient).mockReturnValue({ storage: { from: vi.fn(() => ({ uploadToSignedUrl, getPublicUrl: () => ({ data: { publicUrl: thumbnail } }) })) } } as never)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ path: "course-thumbnails/image.png", token: "signed-token" }) }))
    const { container } = render(<form><ThumbnailUploadInput name="thumbnail_url" /></form>)
    const file = new File(["image"], "image.png", { type: "image/png" })
    await userEvent.setup().upload(screen.getByLabelText("Upload from computer"), file)
    await screen.findByText("Thumbnail uploaded.")
    expect(uploadToSignedUrl).toHaveBeenCalledWith("course-thumbnails/image.png", "signed-token", file)
    const data = new FormData(container.querySelector("form")!)
    expect(data.get("thumbnail_url")).toBe(thumbnail)
    for (const [key, value] of Object.entries({ ...fields, title })) data.set(key, value)
    expect(await createCourseAction(undefined, data)).toEqual({ ok: true, message: "Course created.", nextHref: "/admin/course-builder/course-1" })
    expect(courses.insert).toHaveBeenCalledWith(expect.objectContaining({
      thumbnail_url: thumbnail, slug: expect.stringMatching(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      instructor_id: null, duration_text: null, outcomes: ["Build stores", "Drive sales"], requirements: [], price: 1000, currency: "PKR", featured: false,
    }))
  })

  it.each(["draft", "published", "unpublished", "archived"])("preserves %s and instructor selection", async status => {
    const courses = setup()
    const instructor_id = "550e8400-e29b-41d4-a716-446655440001"
    expect((await createCourseAction(undefined, form({ status, instructor_id, slug: "custom-address", featured: "true" }))).ok).toBe(true)
    expect(courses.insert).toHaveBeenCalledWith(expect.objectContaining({ status, instructor_id, slug: "custom-address", featured: true }))
  })

  it.each([
    ["title", "   ", "Course name"], ["slug", "Invalid Address", "Course address"],
    ["short_description", "   ", "Brief summary"], ["description", "   ", "About this course"],
    ["price", "-1", "Price"],
    ["currency", "PK", "Currency"], ["status", "invalid", "Status"],
    ["instructor_id", "invalid", "Instructor"], ["thumbnail_url", "invalid", "Thumbnail"],
  ])("retains validation and identifies %s without raw Zod details", async (field, value, label) => {
    const courses = setup()
    const result = await createCourseAction(undefined, form({ [field]: value }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain(label)
    expect(result.message).not.toMatch(/Zod|invalid_type|\{|\[/)
    expect(courses.insert).not.toHaveBeenCalled()
  })

  it("preserves course editing and its existing address and thumbnail", async () => {
    const courses = setup()
    expect((await updateCourseAction(undefined, form({ id: "550e8400-e29b-41d4-a716-446655440001", slug: "existing-address" }))).ok).toBe(true)
    expect(courses.update).toHaveBeenCalledWith(expect.objectContaining({ slug: "existing-address", thumbnail_url: thumbnail }))
  })

  it("gives field-specific feedback on editing without writing invalid data", async () => {
    const courses = setup()
    const result = await updateCourseAction(undefined, form({ id: "550e8400-e29b-41d4-a716-446655440001", slug: "existing-address", short_description: "   ", instructor_id: "invalid" }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain("Brief summary is required.")
    expect(result.message).toContain("Instructor must be selected from the list")
    expect(result.message).not.toContain("Thumbnail")
    expect(courses.update).not.toHaveBeenCalled()
  })
})
