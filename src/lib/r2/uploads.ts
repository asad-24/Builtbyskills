import "server-only"
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, HeadObjectCommand, ListPartsCommand, UploadPartCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getR2Client, getR2Config } from "@/lib/r2/server"
import { VIDEO_MAX_BYTES, VIDEO_PART_BYTES, VIDEO_PART_URL_SECONDS } from "@/lib/r2/constants"
import { VideoRequestError } from "@/lib/r2/http"

type DB = ReturnType<typeof createSupabaseAdminClient>
export type UploadSession = { id: string; asset_id: string; initiated_by: string; state: string; multipart_id: string | null; expires_at: string; expected_updated_at: string; operation_token: string | null }
export type VideoAsset = { id: string; lesson_id: string | null; original_lesson_id: string; original_course_id: string; object_key: string; state: string; expected_bytes: number; verified_bytes: number | null; object_etag: string | null; original_name: string; failure_code: string | null; duration_seconds: number | null; retired_at: string | null; cleanup_after: string | null }
export const beginVideoSchema = z.object({ lessonId: z.string().uuid(), updatedAt: z.string().datetime({ offset: true }), name: z.string().trim().min(1).max(200).regex(/\.mp4$/i), size: z.number().int().positive().max(VIDEO_MAX_BYTES), contentType: z.literal("video/mp4") }).strict()

function check(error: unknown) { if (error) throw new VideoRequestError(409, "This video changed or is unavailable. Refresh and retry.") }
export function assertAssetKey(asset: VideoAsset) {
  const uuid = z.string().uuid()
  if (![asset.id, asset.original_course_id, asset.original_lesson_id].every(value => uuid.safeParse(value).success) || asset.object_key !== `courses/${asset.original_course_id}/lessons/${asset.original_lesson_id}/videos/${asset.id}/source.mp4`) throw new VideoRequestError(403, "Video unavailable.")
}
export async function loadUpload(db: DB, id: string, actor: string, lessonId: string) {
  const { data: session, error } = await db.from("lesson_video_uploads").select("*").eq("id", id).eq("initiated_by", actor).single()
  check(error)
  if (!session) throw new VideoRequestError(404, "Upload unavailable.")
  const { data: asset, error: assetError } = await db.from("lesson_video_assets").select("*").eq("id", session.asset_id).eq("lesson_id", lessonId).single()
  check(assetError)
  if (!asset || asset.lesson_id !== lessonId || session.initiated_by !== actor) throw new VideoRequestError(403, "Upload unavailable.")
  assertAssetKey(asset)
  return { session: session as UploadSession, asset: asset as VideoAsset }
}
export async function beginUpload(db: DB, actor: string, input: z.infer<typeof beginVideoSchema>) {
  const r2 = getR2Client(), { bucket } = getR2Config()
  const uploadId = crypto.randomUUID(), assetId = crypto.randomUUID()
  const { error } = await db.rpc("reserve_lesson_video", { target_lesson: input.lessonId, actor, expected_version: input.updatedAt, asset_uuid: assetId, upload_uuid: uploadId, file_name: input.name, file_bytes: input.size })
  check(error)
  const { asset } = await loadUpload(db, uploadId, actor, input.lessonId)
  // State already durable. A lost response is recoverable via status; orphaned
  // multipart IDs from an initialization crash are handled by R2 lifecycle.
  const created = await r2.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: asset.object_key, ContentType: "video/mp4", CacheControl: "private, no-store", Metadata: { "asset-id": asset.id } }))
  if (!created.UploadId) throw new Error("Upload unavailable")
  const { data, error: saveError } = await db.from("lesson_video_uploads").update({ multipart_id: created.UploadId, state: "uploading" }).eq("id", uploadId).eq("state", "initializing").select("id").single()
  if (saveError || !data) {
    await r2.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: asset.object_key, UploadId: created.UploadId })).catch(() => undefined)
    check(saveError ?? true)
  }
  return { uploadId, partBytes: VIDEO_PART_BYTES, partCount: Math.ceil(input.size / VIDEO_PART_BYTES) }
}
export async function signPart(session: UploadSession, asset: VideoAsset, partNumber: number) {
  if (session.state !== "uploading" || !session.multipart_id || Date.parse(session.expires_at) <= Date.now() || partNumber < 1 || partNumber > Math.ceil(asset.expected_bytes / VIDEO_PART_BYTES)) throw new VideoRequestError(409, "This upload expired or cannot accept more parts. Upload again.")
  const size = Math.min(VIDEO_PART_BYTES, asset.expected_bytes - (partNumber - 1) * VIDEO_PART_BYTES)
  const url = await getSignedUrl(getR2Client(), new UploadPartCommand({ Bucket: getR2Config().bucket, Key: asset.object_key, UploadId: session.multipart_id, PartNumber: partNumber, ContentLength: size }), { expiresIn: Math.min(VIDEO_PART_URL_SECONDS, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000)) })
  return { url, size }
}
async function headCompleted(asset: VideoAsset, signal: AbortSignal) {
  try { return await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Config().bucket, Key: asset.object_key }), { abortSignal: signal }) }
  catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null
    throw error
  }
}
export async function completeUpload(db: DB, actor: string, session: UploadSession, asset: VideoAsset) {
  if (session.state === "validating" && asset.state === "ready" && !asset.retired_at && !asset.cleanup_after) return { state: "ready" }
  const recoveringValidation = asset.state === "validating"
  const token = crypto.randomUUID()
  const { data, error } = await db.rpc("claim_lesson_video_upload", { upload_uuid: session.id, actor, target_state: "completing", claim_uuid: token })
  check(error)
  const claimed = data as UploadSession
  if (!claimed?.multipart_id) throw new VideoRequestError(409, "Upload unavailable.")
  const r2 = getR2Client(), { bucket } = getR2Config()
  const signal = AbortSignal.timeout(120000)
  let completedObject = false
  try {
    // Recover CompleteMultipartUpload success followed by a lost response/DB failure.
    let head = await headCompleted(asset, signal)
    completedObject = !!head
    if (!head && recoveringValidation) throw new VideoRequestError(400, "The completed video is missing. Cancel and upload again.")
    if (!head) {
      const parts = await r2.send(new ListPartsCommand({ Bucket: bucket, Key: asset.object_key, UploadId: claimed.multipart_id }), { abortSignal: signal })
      const expectedCount = Math.ceil(asset.expected_bytes / VIDEO_PART_BYTES)
      if (parts.IsTruncated || parts.Parts?.length !== expectedCount || parts.Parts.some((part, index) => part.PartNumber !== index + 1 || !part.ETag || part.Size !== Math.min(VIDEO_PART_BYTES, asset.expected_bytes - index * VIDEO_PART_BYTES))) throw new VideoRequestError(400, "The upload is incomplete. Retry the missing video parts.")
      await r2.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: asset.object_key, UploadId: claimed.multipart_id, MultipartUpload: { Parts: parts.Parts.map(part => ({ ETag: part.ETag, PartNumber: part.PartNumber })) } }), { abortSignal: signal })
      completedObject = true
      head = await headCompleted(asset, signal)
    }
    if (!head || head.ContentLength !== asset.expected_bytes || head.ContentLength > VIDEO_MAX_BYTES || head.ContentType !== "video/mp4" || head.Metadata?.["asset-id"] !== asset.id || !head.ETag) throw new VideoRequestError(400, "The uploaded object could not be verified. Cancel and upload again.")
    if (recoveringValidation && (head.ContentLength !== asset.verified_bytes || head.ETag !== asset.object_etag)) throw new VideoRequestError(400, "The completed video changed. Cancel and upload again.")
    // Object verification establishes readiness for trusted-admin uploads;
    // codec, duration and fast-start metadata are deliberately not fabricated.
    const { error: saveError } = await db.rpc("finish_lesson_video_upload", { upload_uuid: session.id, actor, claim_uuid: token, verified_size: head.ContentLength, verified_etag: head.ETag })
    check(saveError)
    return { state: "ready" }
  } catch (error) {
    // Keep `completing` for recovery: a transient HEAD failure must never let a
    // completed object be overwritten by a new multipart upload.
    await db.from("lesson_video_uploads").update({ ...(error instanceof VideoRequestError && !completedObject ? { state: recoveringValidation ? "validating" : "uploading" } : {}), operation_token: null, operation_until: null }).eq("id", session.id).eq("operation_token", token)
    throw error
  }
}
export async function cancelUpload(db: DB, actor: string, session: UploadSession, asset: VideoAsset) {
  if (session.state === "canceled") return
  if (asset.state === "ready") throw new VideoRequestError(409, "Ready videos must be removed from the lesson instead.")
  const token = crypto.randomUUID()
  const { error } = await db.rpc("claim_lesson_video_upload", { upload_uuid: session.id, actor, target_state: "canceling", claim_uuid: token })
  check(error)
  if (session.multipart_id) {
    try { await getR2Client().send(new AbortMultipartUploadCommand({ Bucket: getR2Config().bucket, Key: asset.object_key, UploadId: session.multipart_id })) }
    catch (error) { if ((error as { name?: string }).name !== "NoSuchUpload") throw error }
  }
  const { error: assetError } = await db.from("lesson_video_assets").update({ retired_at: new Date().toISOString(), cleanup_after: new Date().toISOString(), failure_code: "canceled" }).eq("id", asset.id).neq("state", "ready")
  check(assetError)
  const { error: saveError } = await db.from("lesson_video_uploads").update({ state: "canceled", operation_token: null, operation_until: null }).eq("id", session.id).eq("operation_token", token)
  check(saveError)
}
