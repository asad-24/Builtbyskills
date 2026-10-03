import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AppForbiddenError } from "@/lib/errors"
import { POST } from "@/app/api/admin/lesson-resources/route"
const id = "550e8400-e29b-41d4-a716-446655440001"
const admin = "550e8400-e29b-41d4-a716-446655440002"
const resource = "550e8400-e29b-41d4-a716-446655440003"
const path = `${id}/${admin}/${resource}`
function request(body: object) { return new Request("https://example.com/api/admin/lesson-resources", { method: "POST", body: JSON.stringify({ lessonId: id, ...body }) }) }
function setup() {
  const { mock } = createSupabaseMock()
  const signed = vi.fn().mockResolvedValue({ data: { token: "scoped-upload-token" }, error: null })
  const info = vi.fn().mockResolvedValue({ data: { size: 1000, contentType: "application/pdf" }, error: null })
  const bucket = vi.fn(() => ({ createSignedUploadUrl: signed, info }))
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ ...mock, storage: { from: bucket } } as never)
  mock.from("lessons").single.mockResolvedValue({ data: { id, section: { course_id: id } }, error: null })
  return { mock, signed, info, bucket }
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue({ id: admin } as never) })
describe("private lesson resource authoring", () => {
  it.each([
    { operation: "upload", contentType: "application/pdf", size: 1000 },
    { operation: "attach", path, title: "Handout" },
    { operation: "link", title: "Lesson link", url: "https://example.com" },
  ])("requires admin before authoring resources: %j", async payload => {
    vi.mocked(requireAdmin).mockRejectedValue(new AppForbiddenError())
    expect((await POST(request(payload))).status).toBe(403)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })
  it("creates a scoped private upload without creating a premature resource row", async () => {
    const { mock, signed, bucket } = setup()
    const response = await POST(request({ operation: "upload", contentType: "application/pdf", size: 1000 }))
    const body = await response.json()
    expect(body.path).toMatch(new RegExp(`^${id}/${admin}/`))
    expect(body.token).toBe("scoped-upload-token")
    expect(signed).toHaveBeenCalledWith(body.path, { upsert: false })
    expect(bucket).toHaveBeenCalledWith("lesson-resources")
    expect(mock.from).not.toHaveBeenCalledWith("lesson_resources")
  })
  it.each([{ contentType: "text/html", size: 1000 }, { contentType: "application/pdf", size: 26 * 1024 * 1024 }, { contentType: "application/pdf", size: 0 }])("retains MIME and size restrictions: %j", async fields => {
    const { signed } = setup()
    expect((await POST(request({ operation: "upload", ...fields }))).status).toBe(400)
    expect(signed).not.toHaveBeenCalled()
  })
  it("verifies real uploaded metadata before attaching and uses a stable resource ID", async () => {
    const { mock, info } = setup()
    expect((await POST(request({ operation: "attach", path, title: "Handout.pdf" }))).status).toBe(200)
    expect(info).toHaveBeenCalledWith(path)
    expect(mock.from("lesson_resources").insert).toHaveBeenCalledWith({ id: resource, lesson_id: id, title: "Handout.pdf", file_path: path, resource_type: "application/pdf", position: 0 })
  })
  it.each(["../private/file", `another-lesson/${admin}/${resource}`, `${id}/another-admin/${resource}`])("denies cross-lesson or malformed upload paths", async badPath => {
    const { info } = setup()
    expect((await POST(request({ operation: "attach", path: badPath, title: "Handout" }))).status).toBe(400)
    expect(info).not.toHaveBeenCalled()
  })
  it.each([{ size: 0, contentType: "application/pdf" }, { size: 26 * 1024 * 1024, contentType: "application/pdf" }, { size: 1000, contentType: "text/html" }])("does not trust browser metadata: %j", async metadata => {
    const { mock, info } = setup()
    info.mockResolvedValue({ data: metadata, error: null })
    expect((await POST(request({ operation: "attach", path, title: "Handout" }))).status).toBe(400)
    expect(mock.from).not.toHaveBeenCalledWith("lesson_resources")
  })
  it("handles attachment retries idempotently", async () => {
    const { mock } = setup()
    mock.from("lesson_resources").setResolveWith(null, { code: "23505" })
    mock.from("lesson_resources").maybeSingle.mockResolvedValue({ data: { id: resource }, error: null })
    expect((await POST(request({ operation: "attach", path, title: "Handout" }))).status).toBe(200)
    expect(mock.from("lesson_resources").eq).toHaveBeenCalledWith("file_path", path)
  })
  it.each(["javascript:alert(1)", "ftp://example.com/file", "https://user:pass@example.com"])("rejects unsafe links", async url => {
    const { mock } = setup()
    expect((await POST(request({ operation: "link", title: "Lesson link", url }))).status).toBe(400)
    expect(mock.from).not.toHaveBeenCalledWith("lesson_resources")
  })
  it("stores external links in the existing resource model", async () => {
    const { mock } = setup()
    expect((await POST(request({ operation: "link", title: "Video on an external website", url: "https://example.com/video" }))).status).toBe(200)
    expect(mock.from("lesson_resources").insert).toHaveBeenCalledWith({ title: "Video on an external website", file_path: "https://example.com/video", resource_type: "external_link", lesson_id: id, position: 0 })
  })
  it("scopes link editing to its existing lesson and resource type", async () => {
    const { mock } = setup()
    mock.from("lesson_resources").maybeSingle.mockResolvedValue({ data: { id: resource }, error: null })
    expect((await POST(request({ operation: "link", title: "Corrected link", url: "https://example.com/new", resourceId: resource }))).status).toBe(200)
    expect(mock.from("lesson_resources").eq).toHaveBeenCalledWith("lesson_id", id)
    expect(mock.from("lesson_resources").eq).toHaveBeenCalledWith("resource_type", "external_link")
  })
})
