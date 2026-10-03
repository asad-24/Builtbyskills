import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
const { send, sign } = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn() }))
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: sign }))
vi.mock("@/lib/r2/server", () => ({ getR2Client: () => ({ send }), getR2Config: () => ({ bucket: "builtbyskills-course-videos" }) }))
import { requireRole } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"
import { GET, HEAD } from "@/app/api/student/videos/[lessonId]/route"
import { parseVideoRange } from "@/lib/r2/playback"
import { videoFixture, videoIds as ids } from "@/test/mocks/r2"
function setup() {
  const fixture = videoFixture()
  const asset = { ...fixture.asset, state: "ready", verified_bytes: 100, object_etag: '"immutable"' }
  fixture.db.from("lesson_video_assets").single.mockResolvedValue({ data: asset, error: null })
  fixture.db.from("lessons").single.mockResolvedValue({ data: { id: ids.lesson, video_asset_id: ids.asset, lesson_type: "video", status: "published", section: { course_id: ids.course } }, error: null })
  fixture.db.from("courses").single.mockResolvedValue({ data: { id: ids.course, status: "published" }, error: null })
  fixture.db.from("enrollments").single.mockResolvedValue({ data: { id: "enrollment", status: "active", starts_at: null, expires_at: null }, error: null })
  vi.mocked(createSupabaseAdminClient).mockReturnValue(fixture.db as never)
  return { ...fixture, asset }
}
function call(range?: string, method = "GET") {
  const req = new Request(`https://academy.example.com/api/student/videos/${ids.lesson}`, { method, headers: range ? { Range: range } : {} })
  return (method === "HEAD" ? HEAD : GET)(req, { params: Promise.resolve({ lessonId: ids.lesson }) })
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireRole).mockResolvedValue({ id: "student", role: "student", status: "active" } as never); vi.stubEnv("R2_PLAYBACK_RUNTIME", "long-lived-node"); vi.stubEnv("VERCEL", "") })
afterEach(() => vi.unstubAllEnvs())
describe("authenticated private video gateway", () => {
  it.each([new AppAuthError(), new AppForbiddenError("Inactive"), new AppForbiddenError("Wrong role")])("denies unauthorized playback before R2", async error => {
    setup(); vi.mocked(requireRole).mockRejectedValue(error)
    expect((await call()).status).toBe(error instanceof AppAuthError ? 401 : 403)
    expect(send).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
  })
  it.each(["draft", "unpublished", "archived"])("denies a %s course", async status => {
    const { db } = setup(); db.from("courses").single.mockResolvedValue({ data: { status }, error: null })
    expect((await call()).status).toBe(403); expect(send).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
  })
  it.each([{ status: "suspended" }, { status: "expired" }, { status: "cancelled" }, { starts_at: "2099-10-03T00:00:00Z" }, { expires_at: "2000-01-01T00:00:00Z" }])("denies revoked/out-of-window enrollment %j", async overrides => {
    const { db } = setup(); db.from("enrollments").single.mockResolvedValue({ data: { status: "active", starts_at: null, expires_at: null, ...overrides }, error: null })
    expect((await call()).status).toBe(403); expect(send).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
  })
  it("checks exact course enrollment and denies cross-lesson objects", async () => {
    const { db, asset } = setup(); asset.lesson_id = ids.course
    expect((await call()).status).toBe(403)
    expect(db.from("enrollments").eq).toHaveBeenCalledWith("course_id", ids.course)
    expect(db.from("enrollments").eq).toHaveBeenCalledWith("student_id", "student")
    expect(send).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
  })
  it("rejects a formerly bound video when its lesson is moved to another course", async () => {
    const { db } = setup()
    db.from("lessons").single.mockResolvedValue({ data: { id: ids.lesson, video_asset_id: ids.asset, lesson_type: "video", status: "published", section: { course_id: ids.upload } }, error: null })
    expect((await call()).status).toBe(403); expect(send).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
  })
  it.each(["uploading", "validating", "failed", "deleting"])("denies %s assets", async state => {
    const { asset } = setup(); asset.state = state
    expect((await call()).status).toBe(403); expect(send).not.toHaveBeenCalled(); expect(sign).not.toHaveBeenCalled()
  })
  it("issues a five-minute GET redirect on Vercel", async () => {
    setup(); vi.stubEnv("VERCEL", "1")
    send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", ETag: '"immutable"' })
    sign.mockResolvedValue("https://example.r2.cloudflarestorage.com/signed")
    const response = await call("bytes=10-19")
    expect(response.status).toBe(307)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(response.headers.get("Location")).toBe("https://example.r2.cloudflarestorage.com/signed")
    expect(sign.mock.calls[0][2]).toEqual({ expiresIn: 300 })
    expect(send).toHaveBeenCalledTimes(1)
  })
  it("caps the URL lifetime at enrollment expiry", async () => {
    const { db } = setup()
    db.from("enrollments").single.mockResolvedValue({ data: { status: "active", starts_at: null, expires_at: new Date(Date.now() + 60000).toISOString() }, error: null })
    send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", ETag: '"immutable"' })
    sign.mockResolvedValue("https://example.r2.cloudflarestorage.com/signed")
    expect((await call()).status).toBe(307)
    expect(sign.mock.calls[0][2].expiresIn).toBeLessThanOrEqual(60)
    expect(sign.mock.calls[0][2].expiresIn).toBeGreaterThan(0)
  })
  it.each([{ retired_at: "2026-01-01" }, { cleanup_after: "2026-01-01" }, { cleanup_claim: "claim" }, { cleanup_claim_until: "2099-01-01" }, { deleted_at: "2026-01-01" }, { verified_bytes: 99 }])("rejects unavailable asset %j before signing", async overrides => {
    const { asset } = setup(); Object.assign(asset, overrides)
    expect((await call()).status).toBe(403)
    expect(sign).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
  })
  it("never exposes signing errors", async () => {
    setup(); send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", ETag: '"immutable"' })
    sign.mockRejectedValue(new Error("secret-test-value signed-url-test-value"))
    const response = await call()
    expect(response.status).toBe(500)
    expect(await response.text()).not.toMatch(/secret-test-value|signed-url-test-value/)
    expect(response.headers.get("Location")).toBeNull()
  })
  it("returns metadata-only HEAD after authorization", async () => {
    setup(); send.mockResolvedValueOnce({ ContentLength: 100, ContentType: "video/mp4", ETag: '"immutable"' })
    const response = await call(undefined, "HEAD")
    expect(response.status).toBe(200); expect(await response.text()).toBe(""); expect(send).toHaveBeenCalledTimes(1)
  })
  it("fails closed on changed/missing R2 objects", async () => {
    setup(); send.mockResolvedValue({ ContentLength: 101, ETag: '"changed"' })
    expect((await call()).status).toBe(503)
  })
})
describe("video range parsing", () => {
  it.each([["bytes=0-9", 0, 9], ["bytes=90-", 90, 99], ["bytes=-10", 90, 99], ["bytes=90-200", 90, 99], ["bytes=-200", 0, 99]])("supports %s", (value, start, end) => expect(parseVideoRange(String(value), 100)).toEqual({ start, end }))
  it.each(["bytes=100-", "bytes=10-9", "bytes=-0", "bytes=-", "bytes=0-1,10-11", "invalid", "bytes=999999999999999999999-"])("rejects %s", value => expect(() => parseVideoRange(value, 100)).toThrow())
})
