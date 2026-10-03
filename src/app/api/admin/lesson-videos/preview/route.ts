import { z } from "zod"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { assertAssetKey, loadUpload, type VideoAsset } from "@/lib/r2/uploads"
import { presignVideoPlayback } from "@/lib/r2/playback"
import { videoError, videoJson, VideoRequestError } from "@/lib/r2/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function HEAD() {
  return new Response(null, { status: 405, headers: { "Cache-Control": "private, no-store", Allow: "GET" } })
}
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin()
    const parsed = z.object({ lessonId: z.string().uuid(), uploadId: z.string().uuid().optional() }).strict().safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return videoJson({ error: "Video unavailable." }, 400)
    const { lessonId, uploadId } = parsed.data
    const db = createSupabaseAdminClient()
    const { data: lesson, error } = await db.from("lessons").select("id, lesson_type, video_asset_id, section:course_sections(course_id)").eq("id", lessonId).single()
    const section = Array.isArray(lesson?.section) ? lesson.section[0] : lesson?.section
    if (error || !lesson || lesson.lesson_type !== "video" || !section?.course_id) throw new VideoRequestError(404, "Video unavailable.")
    let asset: VideoAsset & { cleanup_claim?: string | null; cleanup_claim_until?: string | null; deleted_at?: string | null }
    if (uploadId) asset = (await loadUpload(db, uploadId, admin.id, lessonId)).asset
    else {
      if (!lesson.video_asset_id) throw new VideoRequestError(404, "Video unavailable.")
      const result = await db.from("lesson_video_assets").select("*").eq("id", lesson.video_asset_id).eq("lesson_id", lessonId).single()
      if (result.error || !result.data) throw new VideoRequestError(404, "Video unavailable.")
      asset = result.data
    }
    if (asset.state !== "ready" || asset.lesson_id !== lessonId || asset.original_lesson_id !== lessonId || asset.original_course_id !== section.course_id || asset.retired_at || asset.cleanup_after || asset.cleanup_claim || asset.cleanup_claim_until || asset.deleted_at || !asset.verified_bytes || asset.verified_bytes !== asset.expected_bytes || !asset.object_etag) throw new VideoRequestError(403, "Video unavailable.")
    assertAssetKey(asset)
    const url = await presignVideoPlayback(request, asset, {})
    return new Response(null, { status: 307, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Location: url } })
  } catch (error) { return videoError(error) }
}
