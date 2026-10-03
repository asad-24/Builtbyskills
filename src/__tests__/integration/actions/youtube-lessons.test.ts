import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/email/send", () => ({ sendTransactionalEmail: vi.fn() }))
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createLessonAction, updateLessonAction } from "@/actions/admin"

const id = "550e8400-e29b-41d4-a716-446655440001"
const videoId = "dQw4w9WgXcQ"
const fields = { id, updated_at: "old", section_id: id, title: "Video lesson", lesson_type: "video", status: "draft" }
function form(overrides: Record<string, string> = {}) {
  const data = new FormData()
  Object.entries({ ...fields, ...overrides }).forEach(([key, value]) => data.set(key, value))
  return data
}
function setup(overrides = {}) {
  const { mock } = createSupabaseMock()
  vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
  const lessons = mock.from("lessons")
  lessons.single.mockResolvedValue({ data: { id, mux_playback_id: "historical", section: { course_id: id }, ...overrides }, error: null })
  lessons.maybeSingle.mockResolvedValue({ data: { id, position: 2 }, error: null })
  return lessons
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue({ id, role: "super_admin" } as never) })
describe("legacy YouTube compatibility during R2 rollout", () => {
  it("creates new video drafts without a legacy provider reference", async () => {
    const lessons = setup()
    expect((await createLessonAction(undefined, form())).ok).toBe(true)
    expect(lessons.insert).toHaveBeenCalledWith(expect.objectContaining({ youtube_video_id: null, status: "draft" }))
    expect(lessons.insert.mock.calls[0][0]).not.toHaveProperty("youtube_url")
    expect(lessons.insert.mock.calls[0][0]).not.toHaveProperty("mux_playback_id")
  })
  it.each(["", "https://example.com/video", "<iframe></iframe>"])("rejects publication without a valid link: %s", async youtube_url => {
    const lessons = setup()
    expect((await createLessonAction(undefined, form({ youtube_url, status: "published" }))).ok).toBe(false)
    expect((await updateLessonAction(undefined, form({ youtube_url, status: "published" }))).ok).toBe(false)
    expect(lessons.insert).not.toHaveBeenCalled()
    expect(lessons.update).not.toHaveBeenCalled()
  })
  it("replaces legacy video and publishes without erasing historical metadata", async () => {
    const lessons = setup()
    expect((await updateLessonAction(undefined, form({ youtube_url: `https://youtube.com/watch?v=${videoId}&t=120`, status: "published" }))).ok).toBe(true)
    expect(lessons.update).toHaveBeenCalledWith(expect.objectContaining({ youtube_video_id: videoId, status: "published", duration_seconds: 0 }))
    const payload = lessons.update.mock.calls[0][0]
    expect(payload).not.toHaveProperty("mux_playback_id")
    expect(payload).not.toHaveProperty("mux_asset_id")
    expect(payload).not.toHaveProperty("position")
  })
  it("allows publication with a valid already saved reference", async () => {
    const lessons = setup({ youtube_video_id: videoId })
    expect((await updateLessonAction(undefined, form({ status: "published" }))).ok).toBe(true)
    expect(lessons.update.mock.calls[0][0]).not.toHaveProperty("youtube_video_id")
  })
  it("does not treat legacy Mux metadata as publishable content", async () => {
    const lessons = setup()
    const result = await updateLessonAction(undefined, form({ status: "published" }))
    expect(result.ok).toBe(false)
    expect(result.message).toContain("YouTube video link")
    expect(lessons.update).not.toHaveBeenCalled()
  })
  it("intentionally removes a link when saved as draft", async () => {
    const lessons = setup({ youtube_video_id: videoId })
    expect((await updateLessonAction(undefined, form({ youtube_url: "" }))).ok).toBe(true)
    expect(lessons.update).toHaveBeenCalledWith(expect.objectContaining({ youtube_video_id: null, status: "draft" }))
  })
  it("rejects stale replacement edits", async () => {
    const lessons = setup()
    lessons.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await updateLessonAction(undefined, form({ youtube_url: `https://youtu.be/${videoId}` }))).message).toContain("Refresh")
    expect(lessons.eq).toHaveBeenCalledWith("updated_at", "old")
  })
  it("cannot bypass URL validation by submitting a raw stored ID", async () => {
    setup()
    expect((await createLessonAction(undefined, form({ status: "published", youtube_video_id: videoId }))).ok).toBe(false)
  })
})
