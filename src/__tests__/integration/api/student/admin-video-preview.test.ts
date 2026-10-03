import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("@/lib/r2/playback", () => ({ presignVideoPlayback: vi.fn() }))
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { presignVideoPlayback } from "@/lib/r2/playback"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"
import { GET } from "@/app/api/admin/lesson-videos/preview/route"
import { videoFixture, videoIds as ids } from "@/test/mocks/r2"
function setup() {
  const fixture = videoFixture()
  Object.assign(fixture.asset, { state: "ready", verified_bytes: 100, object_etag: '"immutable"' })
  fixture.db.from("lessons").single.mockResolvedValue({ data: { id: ids.lesson, lesson_type: "video", status: "draft", video_asset_id: ids.asset, section: { course_id: ids.course } }, error: null })
  vi.mocked(createSupabaseAdminClient).mockReturnValue(fixture.db as never)
  return fixture
}
function call(upload = false, extra = "") { return GET(new Request(`https://academy.example.com/api/admin/lesson-videos/preview?lessonId=${ids.lesson}${upload ? `&uploadId=${ids.upload}` : ""}${extra}`)) }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue({ id: ids.admin, role: "super_admin", status: "active" } as never)
  vi.mocked(presignVideoPlayback).mockResolvedValue("https://synthetic.r2.cloudflarestorage.com/signed")
})
describe("private admin preview", () => {
  it.each([false, true])("previews a Ready draft asset, upload=%s, without mutations", async upload => {
    const { db } = setup(); const response = await call(upload)
    expect(response.status).toBe(307)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(presignVideoPlayback).toHaveBeenCalledOnce()
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.from("lesson_video_assets").update).not.toHaveBeenCalled()
  })
  it.each([new AppAuthError(), new AppForbiddenError()])("denies unauthorized users before signing", async error => {
    setup(); vi.mocked(requireAdmin).mockRejectedValue(error)
    expect((await call()).status).toBe(error instanceof AppAuthError ? 401 : 403)
    expect(presignVideoPlayback).not.toHaveBeenCalled()
  })
  it.each([{ state: "validating" }, { state: "uploading" }, { state: "failed" }, { retired_at: "2026-01-01" }, { cleanup_claim: "claim" }, { deleted_at: "2026-01-01" }, { original_course_id: ids.upload }, { lesson_id: ids.course }, { verified_bytes: 99 }])("rejects unavailable or mismatched assets %j", async changes => {
    const { asset } = setup(); Object.assign(asset, changes)
    expect((await call()).status).toBe(403)
    expect(presignVideoPlayback).not.toHaveBeenCalled()
  })
  it("rejects another admin's unattached upload", async () => {
    const { session } = setup(); session.initiated_by = ids.course
    expect((await call(true)).status).toBe(403)
    expect(presignVideoPlayback).not.toHaveBeenCalled()
  })
  it("rejects browser-supplied object keys", async () => {
    setup(); expect((await call(false, "&key=arbitrary")).status).toBe(400)
    expect(presignVideoPlayback).not.toHaveBeenCalled()
  })
  it("reauthorizes each refresh", async () => {
    setup(); expect((await call()).status).toBe(307)
    vi.mocked(requireAdmin).mockRejectedValue(new AppForbiddenError())
    expect((await call()).status).toBe(403)
    expect(presignVideoPlayback).toHaveBeenCalledOnce()
  })
})
