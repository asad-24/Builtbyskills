import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@/lib/r2/server", () => ({ getR2Client: () => ({ send }), getR2Config: () => ({ bucket: "builtbyskills-course-videos" }) }))
import { cleanupVideos } from "@/lib/r2/cleanup"
import { videoFixture } from "@/test/mocks/r2"
beforeEach(() => { vi.clearAllMocks(); send.mockResolvedValue({}) })
describe("reference-safe R2 cleanup", () => {
  it("does not delete objects when the database refuses the cleanup claim", async () => {
    const { db, asset } = videoFixture()
    db.from("lesson_video_assets").setResolveWith([{ id: asset.id }])
    db.rpc.mockResolvedValue({ data: null, error: null } as never)
    expect(await cleanupVideos(db as never)).toEqual({ deleted: 0 })
    expect(send).not.toHaveBeenCalled()
    expect(db.rpc).toHaveBeenCalledWith("retire_expired_lesson_videos")
  })
  it("aborts multipart state then deletes only a claimed eligible object", async () => {
    const { db, asset } = videoFixture()
    db.from("lesson_video_assets").setResolveWith([{ id: asset.id }])
    db.rpc.mockResolvedValueOnce({ data: null, error: null } as never).mockResolvedValueOnce({ data: asset, error: null } as never)
    expect(await cleanupVideos(db as never)).toEqual({ deleted: 1 })
    expect(send.mock.calls.map(call => call[0].constructor.name)).toEqual(["AbortMultipartUploadCommand", "DeleteObjectCommand"])
    expect(db.from("lesson_video_assets").update).toHaveBeenCalledWith(expect.objectContaining({ state: "deleted" }))
  })
  it("keeps failed deletions retryable rather than marking them deleted", async () => {
    const { db, asset } = videoFixture()
    db.from("lesson_video_assets").setResolveWith([{ id: asset.id }])
    db.rpc.mockResolvedValueOnce({ data: null, error: null } as never).mockResolvedValueOnce({ data: asset, error: null } as never)
    send.mockRejectedValue(new Error("R2 unavailable"))
    await expect(cleanupVideos(db as never)).rejects.toThrow()
    expect(db.from("lesson_video_assets").update).not.toHaveBeenCalled()
  })
})
