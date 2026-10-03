import "server-only"
import { AbortMultipartUploadCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getR2Client, getR2Config } from "@/lib/r2/server"
import { assertAssetKey, type VideoAsset } from "@/lib/r2/uploads"

export async function cleanupVideos(db = createSupabaseAdminClient()) {
  const now = new Date().toISOString()
  // Database locks serialize expiration against attachment and cleanup.
  const { error } = await db.rpc("retire_expired_lesson_videos")
  if (error) throw new Error("Cleanup lookup failed")
  const { data: candidates, error: candidatesError } = await db.from("lesson_video_assets").select("id").lte("cleanup_after", now).neq("state", "deleted").limit(10)
  if (candidatesError) throw new Error("Cleanup lookup failed")
  let deleted = 0
  for (const candidate of candidates ?? []) {
    const token = crypto.randomUUID()
    const { data, error: claimError } = await db.rpc("claim_lesson_video_cleanup", { target_asset: candidate.id, claim_uuid: token })
    if (claimError) throw new Error("Cleanup claim failed")
    if (!data) continue
    const asset = data as VideoAsset
    assertAssetKey(asset)
    const { data: upload, error: uploadError } = await db.from("lesson_video_uploads").select("id, multipart_id, operation_until").eq("asset_id", asset.id).single()
    if (uploadError || !upload) throw new Error("Cleanup upload unavailable")
    // Do not race an active complete/cancel. Claim remains retryable.
    if (upload.operation_until && Date.parse(upload.operation_until) > Date.now()) continue
    const r2 = getR2Client(), { bucket } = getR2Config()
    if (upload.multipart_id) {
      try { await r2.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: asset.object_key, UploadId: upload.multipart_id })) }
      catch (error) { if ((error as { name?: string }).name !== "NoSuchUpload") throw error }
    }
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.object_key }))
    const { error: saveError } = await db.from("lesson_video_assets").update({ state: "deleted", deleted_at: new Date().toISOString(), cleanup_claim: null, cleanup_claim_until: null }).eq("id", asset.id).eq("cleanup_claim", token)
    if (saveError) throw new Error("Cleanup recording failed")
    const { error: sessionError } = await db.from("lesson_video_uploads").update({ state: "canceled", operation_token: null, operation_until: null }).eq("id", upload.id)
    if (sessionError) throw new Error("Cleanup session recording failed")
    deleted++
  }
  return { deleted }
}
