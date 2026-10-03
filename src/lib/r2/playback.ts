import "server-only"
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { requireStudentLesson } from "@/lib/lessons/access"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { privateHeaders } from "@/lib/lessons/http"
import { assertAssetKey, type VideoAsset } from "@/lib/r2/uploads"
import { getR2Client, getR2Config } from "@/lib/r2/server"
import { VideoRequestError } from "@/lib/r2/http"

export async function authorizeVideoPlayback(lessonId: string) {
  const access = await requireStudentLesson(lessonId)
  if (access.lesson.lesson_type !== "video" || !access.lesson.video_asset_id) throw new VideoRequestError(404, "Video unavailable.")
  const { data, error } = await access.supabase.from("lesson_video_assets").select("*").eq("id", access.lesson.video_asset_id).eq("lesson_id", lessonId).eq("state", "ready").single()
  const asset = data as (VideoAsset & { cleanup_claim?: string | null; cleanup_claim_until?: string | null; deleted_at?: string | null }) | null
  if (error || !asset || asset.state !== "ready" || asset.lesson_id !== lessonId || asset.original_lesson_id !== lessonId || asset.original_course_id !== access.courseId || asset.retired_at || asset.cleanup_after || asset.cleanup_claim || asset.cleanup_claim_until || asset.deleted_at || asset.verified_bytes !== asset.expected_bytes || !asset.verified_bytes || !asset.object_etag) throw new VideoRequestError(403, "Video unavailable.")
  assertAssetKey(asset)
  return { ...access, asset }
}

export function parseVideoRange(value: string | null, size: number): { start: number; end: number } | null {
  if (!value) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2])) throw new VideoRequestError(416, "Unsupported video range.")
  const suffix = !match[1]
  const first = Number(match[1] || match[2]), last = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || (suffix && first < 1)) throw new VideoRequestError(416, "Invalid video range.")
  const start = suffix ? Math.max(0, size - first) : first
  const end = suffix ? size - 1 : Math.min(last, size - 1)
  if (start >= size || end < start) throw new VideoRequestError(416, "Video range unavailable.")
  return { start, end }
}

export async function streamPrivateVideo(request: Request, asset: VideoAsset) {
  const size = asset.verified_bytes!
  let range: ReturnType<typeof parseVideoRange>
  try { range = request.method === "HEAD" ? null : parseVideoRange(request.headers.get("range"), size) }
  catch (error) {
    if (error instanceof VideoRequestError && error.status === 416) return new Response(null, { status: 416, headers: { ...privateHeaders, "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } })
    throw error
  }
  const base = { Bucket: getR2Config().bucket, Key: asset.object_key, IfMatch: asset.object_etag! }
  const r2 = getR2Client()
  const head = await r2.send(new HeadObjectCommand(base), { abortSignal: request.signal })
  if (head.ContentLength !== size || head.ETag !== asset.object_etag || head.ContentType !== "video/mp4") throw new VideoRequestError(503, "Video unavailable. Please contact your course administrator.")
  const length = range ? range.end - range.start + 1 : size
  const headers = new Headers({ ...privateHeaders, "Content-Type": "video/mp4", "Content-Disposition": "inline", "Content-Length": String(length), "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" })
  if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`)
  if (request.method === "HEAD") return new Response(null, { headers })
  const result = await r2.send(new GetObjectCommand({ ...base, ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) }), { abortSignal: request.signal })
  if (!result.Body || result.ContentLength !== length || (range && result.ContentRange !== `bytes ${range.start}-${range.end}/${size}`)) throw new Error("Video response mismatch")
  return new Response(result.Body.transformToWebStream(), { status: range ? 206 : 200, headers })
}

export async function presignVideoPlayback(request: Request, asset: VideoAsset, enrollment: { expires_at?: string | null }) {
  const r2 = getR2Client()
  const base = { Bucket: getR2Config().bucket, Key: asset.object_key }
  const head = await r2.send(new HeadObjectCommand({ ...base, IfMatch: asset.object_etag! }), { abortSignal: request.signal })
  if (head.ContentLength !== asset.verified_bytes || head.ETag !== asset.object_etag || head.ContentType !== "video/mp4") throw new VideoRequestError(503, "Video unavailable.")
  const expiresIn = Math.min(300, enrollment.expires_at ? Math.floor((Date.parse(enrollment.expires_at) - Date.now()) / 1000) : 300)
  if (!Number.isFinite(expiresIn) || expiresIn < 1) throw new VideoRequestError(403, "Video unavailable.")
  // Native video cannot set If-Match. Keys are immutable and generated server-side.
  return getSignedUrl(r2, new GetObjectCommand({ ...base, ResponseContentType: "video/mp4", ResponseContentDisposition: "inline", ResponseCacheControl: "private, no-store" }), { expiresIn })
}
