import { vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
export const videoIds = { lesson: "550e8400-e29b-41d4-a716-446655440001", course: "550e8400-e29b-41d4-a716-446655440002", asset: "550e8400-e29b-41d4-a716-446655440003", upload: "550e8400-e29b-41d4-a716-446655440004", admin: "550e8400-e29b-41d4-a716-446655440005" }
export const videoVersion = "2026-10-03T12:00:00.000Z"
export function videoFixture() {
  const asset = { id: videoIds.asset, lesson_id: videoIds.lesson, original_lesson_id: videoIds.lesson, original_course_id: videoIds.course, object_key: `courses/${videoIds.course}/lessons/${videoIds.lesson}/videos/${videoIds.asset}/source.mp4`, state: "uploading", expected_bytes: 100, verified_bytes: null, object_etag: null, original_name: "lesson.mp4", failure_code: null, duration_seconds: null, retired_at: null, cleanup_after: null }
  const session = { id: videoIds.upload, asset_id: asset.id, initiated_by: videoIds.admin, state: "uploading", multipart_id: "private-multipart", expires_at: "2099-10-04T12:00:00.000Z", expected_updated_at: videoVersion, operation_token: null }
  const { mock } = createSupabaseMock()
  const originalFrom = mock.from
  const db = { ...mock, rpc: vi.fn().mockResolvedValue({ data: session, error: null }), from: vi.fn((name: string) => {
    const chain = originalFrom(name)
    for (const key of ["neq", "is", "in", "lt", "lte"]) if (!chain[key]) chain[key] = vi.fn(() => chain)
    return chain
  }) }
  db.from("lesson_video_assets").single.mockResolvedValue({ data: asset, error: null })
  db.from("lesson_video_uploads").single.mockResolvedValue({ data: session, error: null })
  return { db, asset, session }
}
