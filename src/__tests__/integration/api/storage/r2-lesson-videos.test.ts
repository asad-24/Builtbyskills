import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/session", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const { send, signed } = vi.hoisted(() => ({ send: vi.fn(), signed: vi.fn() }))
vi.mock("@/lib/r2/server", () => ({ getR2Client: () => ({ send }), getR2Config: () => ({ bucket: "builtbyskills-course-videos" }) }))
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: signed }))
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"
import { POST } from "@/app/api/admin/lesson-videos/route"
import { getCourseBuilderData } from "@/features/admin/data"
import { videoFixture, videoIds as ids, videoVersion } from "@/test/mocks/r2"
import { VIDEO_MAX_BYTES } from "@/lib/r2/constants"
const input = { lessonId: ids.lesson, updatedAt: videoVersion, name: "lesson.mp4", size: 100, contentType: "video/mp4" }
function request(body: object, origin = "https://academy.example.com") {
  return new Request("https://academy.example.com/api/admin/lesson-videos", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) })
}
function op(operation: string, extra = {}) { return request({ operation, lessonId: ids.lesson, uploadId: ids.upload, ...extra }) }
function setup() {
  const fixture = videoFixture()
  vi.mocked(createSupabaseAdminClient).mockReturnValue(fixture.db as never)
  return fixture
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireAdmin).mockResolvedValue({ id: ids.admin, role: "super_admin", status: "active" } as never); signed.mockResolvedValue("https://private.example.com/temporary-part"); send.mockResolvedValue({ UploadId: "mpu" }) })
describe("private R2 multipart administration", () => {
  it("recovers the current admin's durable upload from PostgREST's one-to-one upload relation", async () => {
    const { db } = setup()
    db.from("courses").single.mockResolvedValue({ data: { id: ids.course }, error: null })
    db.from("course_sections").setResolveWith([{ id: "section", lessons: [{ id: ids.lesson, video_asset_id: null, video_assets: [
      { id: ids.asset, state: "validating", original_name: "lesson.mp4", retired_at: null, created_at: videoVersion, lesson_video_uploads: { id: ids.upload, initiated_by: ids.admin, state: "validating" } },
    ] }] }])
    const result = await getCourseBuilderData(ids.course)
    if (!result.ok) throw new Error(result.message)
    expect(result.data.sections[0].lessons?.[0].video_upload).toEqual({ id: ids.upload, state: "validating", name: "lesson.mp4" })
    expect(result.data.sections[0].lessons?.[0]).not.toHaveProperty("video_assets")
  })
  it.each([new AppAuthError(), new AppForbiddenError("Inactive"), new AppForbiddenError("Student"), new AppForbiddenError("Instructor")])("denies unauthorized users before database or R2 calls", async error => {
    setup(); vi.mocked(requireAdmin).mockRejectedValue(error)
    const response = await POST(request({ operation: "begin", lessonId: ids.lesson, input }))
    expect(response.status).toBe(error instanceof AppAuthError ? 401 : 403)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
  })
  it("denies cross-origin control", async () => {
    setup(); expect((await POST(op("complete"))).status).not.toBe(403)
    expect((await POST(request({ operation: "begin", lessonId: ids.lesson, input }, "https://evil.example.com"))).status).toBe(403)
  })
  it.each([{ size: 0 }, { size: VIDEO_MAX_BYTES + 1 }, { name: "movie.exe" }, { contentType: "application/octet-stream" }, { bucket: "public" }, { object_key: "other-course/private.mp4" }])("rejects invalid size/media/key claims: %j", async change => {
    setup()
    expect((await POST(request({ operation: "begin", lessonId: ids.lesson, input: { ...input, ...change } }))).status).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })
  it("persists a bound session before initiating R2 and accepts the exact 1 GB boundary", async () => {
    const { db } = setup()
    expect((await POST(request({ operation: "begin", lessonId: ids.lesson, input: { ...input, size: VIDEO_MAX_BYTES } }))).status).toBe(200)
    expect(db.rpc).toHaveBeenCalledWith("reserve_lesson_video", expect.objectContaining({ target_lesson: ids.lesson, actor: ids.admin, expected_version: videoVersion, file_bytes: VIDEO_MAX_BYTES }))
    expect(db.rpc.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0])
    expect(db.from("lessons").update).not.toHaveBeenCalled()
  })
  it("signs only bounded parts for the persisted lesson-bound upload", async () => {
    const { db } = setup()
    expect((await POST(op("part", { partNumber: 1 }))).status).toBe(200)
    expect(signed.mock.calls[0][1].input).toEqual(expect.objectContaining({ Bucket: "builtbyskills-course-videos", PartNumber: 1, ContentLength: 100 }))
    expect((await POST(op("part", { partNumber: 2 }))).status).toBe(409)
    expect(db.from("lesson_video_assets").eq).toHaveBeenCalledWith("lesson_id", ids.lesson)
  })
  it("denies expired upload permissions", async () => {
    const { session } = setup(); session.expires_at = "2000-01-01T00:00:00Z"
    expect((await POST(op("part", { partNumber: 1 }))).status).toBe(409)
    expect(signed).not.toHaveBeenCalled()
  })
  it("denies cross-lesson bindings even if the database double returns a row", async () => {
    const { asset } = setup(); asset.lesson_id = ids.course
    expect((await POST(op("part", { partNumber: 1 }))).status).toBe(403)
    expect(signed).not.toHaveBeenCalled()
  })
  it("denies tampered immutable object keys", async () => {
    const { asset } = setup(); asset.object_key = "other-course/source.mp4"
    expect((await POST(op("part", { partNumber: 1 }))).status).toBe(403)
    expect(signed).not.toHaveBeenCalled()
  })
  it("promotes only server-verified completed objects to Ready", async () => {
    const { db, asset } = setup()
    send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", Metadata: { "asset-id": asset.id }, ETag: '"verified"' })
    const response = await POST(op("complete"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ state: "ready" })
    expect(db.rpc).toHaveBeenCalledWith("finish_lesson_video_upload", { upload_uuid: ids.upload, actor: ids.admin, claim_uuid: expect.any(String), verified_size: 100, verified_etag: '"verified"' })
    expect(db.rpc).not.toHaveBeenCalledWith("validate_lesson_video", expect.anything())
  })
  it("lists actual parts before server-controlled completion", async () => {
    const { asset } = setup()
    send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockResolvedValueOnce({ Parts: [{ PartNumber: 1, Size: 100, ETag: '"part"' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: 100, ContentType: "video/mp4", Metadata: { "asset-id": asset.id }, ETag: '"verified"' })
    expect((await POST(op("complete"))).status).toBe(200)
    expect(send.mock.calls.map(call => call[0].constructor.name)).toEqual(["HeadObjectCommand", "ListPartsCommand", "CompleteMultipartUploadCommand", "HeadObjectCommand"])
  })
  it("rejects incomplete parts and permits a retry without replacing the lesson", async () => {
    const { db } = setup()
    send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } }).mockResolvedValueOnce({ Parts: [] })
    expect((await POST(op("complete"))).status).toBe(400)
    expect(db.from("lesson_video_uploads").update).toHaveBeenCalledWith(expect.objectContaining({ state: "uploading", operation_token: null }))
    expect(db.from("lessons").update).not.toHaveBeenCalled()
  })
  it.each([{ ContentLength: 101 }, { ContentType: "video/webm" }, { Metadata: { "asset-id": ids.course } }, { ETag: undefined }, { ETag: "" }])("rejects actual object mismatch: %j", async change => {
    const { asset } = setup()
    send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", Metadata: { "asset-id": asset.id }, ETag: '"verified"', ...change })
    expect((await POST(op("complete"))).status).toBe(400)
    expect(vi.mocked(createSupabaseAdminClient)().rpc).not.toHaveBeenCalledWith("finish_lesson_video_upload", expect.anything())
  })
  it("re-verifies stuck validating objects before Ready", async () => {
    const { session, asset } = setup(); session.state = "validating"; asset.state = "validating"; Object.assign(asset, { verified_bytes: 100, object_etag: '"verified"' })
    send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", Metadata: { "asset-id": asset.id }, ETag: '"verified"' })
    expect((await POST(op("complete"))).status).toBe(200)
    expect(send).toHaveBeenCalledTimes(1)
  })
  it("cancels multipart uploads without touching the working video or progress", async () => {
    const { db } = setup()
    expect((await POST(op("cancel"))).status).toBe(200)
    expect(send.mock.calls[0][0].constructor.name).toBe("AbortMultipartUploadCommand")
    expect(db.from("lessons").update).not.toHaveBeenCalled()
    expect(db.from("lesson_progress").update).not.toHaveBeenCalled()
  })
  it("makes cancellation retries idempotent", async () => {
    const { session } = setup(); session.state = "canceled"
    expect((await POST(op("cancel"))).status).toBe(200); expect(send).not.toHaveBeenCalled()
  })
  it("cannot attach an unverified video", async () => {
    const { db } = setup()
    expect((await POST(op("attach", { updatedAt: videoVersion }))).status).toBe(409)
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it("attaches Ready media using optimistic concurrency and preserves all progress", async () => {
    const { db, asset, session } = setup(); asset.state = "ready"; session.state = "validating"
    expect((await POST(op("attach", { updatedAt: videoVersion }))).status).toBe(200)
    expect(db.rpc).toHaveBeenCalledWith("attach_lesson_video", { target_lesson: ids.lesson, target_asset: ids.asset, actor: ids.admin, expected_version: videoVersion })
    expect(db.from("lesson_progress").update).not.toHaveBeenCalled()
  })
  it("rejects stale replacement without deleting the previous video", async () => {
    const { db, asset, session } = setup(); asset.state = "ready"; session.state = "validating"
    db.rpc.mockResolvedValue({ data: null, error: { message: "stale" } } as never)
    expect((await POST(op("attach", { updatedAt: videoVersion }))).status).toBe(409)
    expect(send).not.toHaveBeenCalled()
  })
  it("removes through the atomic Draft/retirement operation without clearing historical fields", async () => {
    const { db } = setup()
    expect((await POST(request({ operation: "remove", lessonId: ids.lesson, updatedAt: videoVersion }))).status).toBe(200)
    expect(db.rpc).toHaveBeenCalledWith("remove_lesson_video", expect.objectContaining({ expected_version: videoVersion }))
    expect(send).not.toHaveBeenCalled(); expect(db.from("lessons").update).not.toHaveBeenCalled()
  })
})

describe("verification failures remain isolated", () => {
  it("does not promote or replace a lesson after R2 HEAD failure", async () => {
    const { db } = setup(); send.mockRejectedValue(new Error("R2 unavailable"))
    expect((await POST(op("complete"))).status).toBe(500)
    expect(db.rpc).not.toHaveBeenCalledWith("finish_lesson_video_upload", expect.anything())
    expect(db.from("lessons").update).not.toHaveBeenCalled()
  })
  it("does not report Ready after database finalization failure", async () => {
    const { db, asset, session } = setup()
    send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", Metadata: { "asset-id": asset.id }, ETag: '"verified"' })
    db.rpc.mockResolvedValueOnce({ data: session, error: null }).mockResolvedValueOnce({ data: null, error: { message: "claim lost" } })
    expect((await POST(op("complete"))).status).toBe(409)
    expect(db.from("lessons").update).not.toHaveBeenCalled()
  })
  it("rejects a changed stuck object", async () => {
    const { asset, session, db } = setup(); session.state="validating"; asset.state="validating"
    Object.assign(asset, { verified_bytes: 100, object_etag: '"old"' })
    send.mockResolvedValue({ ContentLength: 100, ContentType: "video/mp4", Metadata: { "asset-id": asset.id }, ETag: '"new"' })
    expect((await POST(op("complete"))).status).toBe(400)
    expect(db.rpc).not.toHaveBeenCalledWith("finish_lesson_video_upload", expect.anything())
  })
})
