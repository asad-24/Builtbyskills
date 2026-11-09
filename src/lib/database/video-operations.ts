import "server-only"
import { randomUUID } from "node:crypto"
import type { Db, ClientSession } from "mongodb"
import { fail, defaultsFor, type Row } from "./query"

export async function videoOperation(db: Db, session: ClientSession, name: string, args: Row) {
  const options = { session }, now = new Date().toISOString(), fiveMinutes = new Date(Date.now() + 300_000).toISOString()
  const audit = async (action: string, id: string) => db.collection("audit_logs").insertOne({ ...defaultsFor("audit_logs"), id: randomUUID(), action, actor_id: args.actor, entity_type: "lesson", entity_id: id }, options)
  if (name === "reserve_lesson_video") {
    if (!args.asset_uuid || !args.upload_uuid || !args.file_name || args.file_name.length > 200 || args.file_bytes < 1 || args.file_bytes > 1_000_000_000) fail("23514")
    if (await db.collection("lesson_video_uploads").countDocuments({ initiated_by: args.actor, state: { $in: ["initializing", "uploading", "completing"] }, expires_at: { $gt: now } }, options) >= 3) fail("STALE")
    const lesson = await db.collection("lessons").findOneAndUpdate({ id: args.target_lesson, lesson_type: "video", updated_at: args.expected_version }, { $inc: { access_version: 1 } }, { ...options, returnDocument: "after" })
    if (!lesson) fail("STALE")
    const section = await db.collection("course_sections").findOne({ id: lesson.section_id }, options)
    if (!section) fail("23503")
    await db.collection("lesson_video_assets").insertOne({ ...defaultsFor("lesson_video_assets"), id: args.asset_uuid, lesson_id: lesson.id, original_lesson_id: lesson.id, original_course_id: section.course_id, object_key: `courses/${section.course_id}/lessons/${lesson.id}/videos/${args.asset_uuid}/source.mp4`, original_name: args.file_name, expected_bytes: args.file_bytes, uploaded_by: args.actor, state: "uploading", verified_bytes: null, object_etag: null, retired_at: null, cleanup_after: null, cleanup_claim: null, cleanup_claim_until: null, deleted_at: null, failure_code: null }, options)
    const upload = { ...defaultsFor("lesson_video_uploads"), id: args.upload_uuid, asset_id: args.asset_uuid, initiated_by: args.actor, expected_updated_at: args.expected_version, state: "initializing", multipart_id: null, operation_token: null, operation_until: null, expires_at: new Date(Date.now() + 24 * 3600_000).toISOString() }
    await db.collection("lesson_video_uploads").insertOne(upload, options)
    return upload
  }
  if (name === "claim_lesson_video_upload" || name === "finish_lesson_video_upload") {
    const upload = await db.collection("lesson_video_uploads").findOne({ id: args.upload_uuid, initiated_by: args.actor }, options)
    const asset = upload && await db.collection("lesson_video_assets").findOne({ id: upload.asset_id }, options)
    if (!upload || !asset || ["deleting", "deleted"].includes(asset.state)) fail("STALE")
    await db.collection("lesson_video_assets").updateOne({ id: asset.id }, { $inc: { access_version: 1 } }, options)
    if (name === "claim_lesson_video_upload") {
      if (!["completing", "canceling"].includes(args.target_state) || (upload.operation_until && upload.operation_until > now)) fail("STALE")
      if (args.target_state === "completing" && (asset.retired_at || asset.cleanup_after || asset.cleanup_claim || !["uploading", "validating"].includes(asset.state) || upload.expires_at <= now || !["uploading", "completing", "validating"].includes(upload.state))) fail("STALE")
      if (args.target_state === "canceling" && (asset.state === "ready" || !["initializing", "uploading", "completing", "validating", "canceling", "failed"].includes(upload.state))) fail("STALE")
      const changed = { state: args.target_state, operation_token: args.claim_uuid, operation_until: fiveMinutes }
      await db.collection("lesson_video_uploads").updateOne({ id: upload.id }, { $set: changed }, options)
      const { _id: omitted, ...result } = upload; void omitted
      return { ...result, ...changed }
    }
    if (upload.state !== "completing" || !upload.multipart_id || upload.operation_token !== args.claim_uuid || !upload.operation_until || upload.operation_until <= now || upload.expires_at <= now || !["uploading", "validating"].includes(asset.state) || !asset.lesson_id || asset.retired_at || asset.cleanup_after || asset.cleanup_claim || asset.deleted_at || args.verified_size !== asset.expected_bytes || !args.verified_etag) fail("STALE")
    if (asset.state === "validating" && (asset.verified_bytes !== args.verified_size || asset.object_etag !== args.verified_etag)) fail("STALE")
    await db.collection("lesson_video_assets").updateOne({ id: asset.id }, { $set: { state: "ready", verified_bytes: args.verified_size, object_etag: args.verified_etag, failure_code: null } }, options)
    await db.collection("lesson_video_uploads").updateOne({ id: upload.id }, { $set: { state: "validating", completed_at: now, operation_token: null, operation_until: null } }, options)
    return null
  }
  if (name === "attach_lesson_video" || name === "remove_lesson_video") {
    const lesson = await db.collection("lessons").findOne({ id: args.target_lesson, updated_at: args.expected_version, lesson_type: "video" }, options)
    if (!lesson) fail("STALE")
    if (name === "attach_lesson_video") {
      const asset = await db.collection("lesson_video_assets").findOneAndUpdate({ id: args.target_asset, lesson_id: lesson.id, state: "ready", retired_at: null, cleanup_after: null, cleanup_claim: null }, { $inc: { access_version: 1 } }, { ...options, returnDocument: "after" })
      if (!asset) fail("STALE")
    }
    if (lesson.video_asset_id && lesson.video_asset_id !== args.target_asset) await db.collection("lesson_video_assets").updateOne({ id: lesson.video_asset_id }, { $set: { retired_at: now, cleanup_after: new Date(Date.now() + 7 * 86400_000).toISOString() } }, options)
    await db.collection("lessons").updateOne({ id: lesson.id }, { $set: { video_asset_id: name === "attach_lesson_video" ? args.target_asset : null, video_source: "r2", youtube_video_id: null, duration_seconds: 0, updated_at: now, ...(name === "remove_lesson_video" ? { status: "draft" } : {}) } }, options)
    await audit(name === "attach_lesson_video" ? "lesson.video_attached" : "lesson.video_removed", lesson.id)
    return now
  }
  if (name === "claim_lesson_video_cleanup") {
    const asset = await db.collection("lesson_video_assets").findOne({ id: args.target_asset, state: { $ne: "deleted" }, cleanup_after: { $ne: null, $lte: now }, $or: [{ cleanup_claim_until: null }, { cleanup_claim_until: { $lte: now } }] }, options)
    if (!asset || await db.collection("lessons").findOne({ video_asset_id: asset.id }, options)) return null
    const upload = await db.collection("lesson_video_uploads").findOne({ asset_id: asset.id }, options)
    if (!upload || (upload.operation_until && upload.operation_until > now)) return null
    await db.collection("lesson_video_uploads").updateOne({ id: upload.id }, { $inc: { access_version: 1 } }, options)
    const changes = { state: "deleting", cleanup_claim: args.claim_uuid, cleanup_claim_until: fiveMinutes }
    await db.collection("lesson_video_assets").updateOne({ id: asset.id }, { $set: changes }, options)
    const { _id: omitted, ...result } = asset; void omitted
    return { ...result, ...changes }
  }
  if (name === "retire_expired_lesson_videos") {
    const uploads = await db.collection("lesson_video_uploads").find({ expires_at: { $lte: now }, $or: [{ operation_until: null }, { operation_until: { $lte: now } }] }, options).toArray()
    for (const upload of uploads) {
      if (await db.collection("lessons").findOne({ video_asset_id: upload.asset_id }, options)) continue
      const asset = await db.collection("lesson_video_assets").findOne({ id: upload.asset_id, retired_at: null, cleanup_after: null, state: { $nin: ["deleting", "deleted"] } }, options)
      if (!asset) continue
      await db.collection("lesson_video_uploads").updateOne({ id: upload.id }, { $inc: { access_version: 1 } }, options)
      await db.collection("lesson_video_assets").updateOne({ id: asset.id }, { $set: { retired_at: now, cleanup_after: asset.state === "ready" ? new Date(Date.now() + 7 * 86400_000).toISOString() : now, failure_code: "unattached_upload_expired" } }, options)
    }
    return null
  }
  fail("42501")
}
