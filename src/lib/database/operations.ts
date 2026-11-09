import "server-only"
import { randomUUID } from "node:crypto"
import { transaction } from "./connection"
import { ensureIndexes } from "./schema"
import { fail, defaultsFor, type Row } from "./query"
import { ensureStudent } from "./writes"
import type { Access } from "./access"
import { approvePaymentOperation } from "./payment-operation"
import { videoOperation } from "./video-operations"

export async function runOperation(name: string, args: Row, access: Access) {
  await ensureIndexes()
  return transaction(async (db, session) => {
    const options = { session }, now = new Date().toISOString()
    if (name === "ensure_student_profile") {
      if (access.service) fail("42501")
      const identity = await access.identity()
      if (!identity) fail("42501")
      return ensureStudent(identity, session)
    }
    const identity = !access.service ? await access.identity() : null
    const actorId = access.service ? args.p_admin_id || args.actor || args.actor_profile_id : null
    const actor = await db.collection("profiles").findOne({ ...(access.service ? { id: actorId } : { auth_user_id: identity?.id ?? null }), status: "active", role: "super_admin" }, options)
    const cleanup = ["retire_expired_lesson_videos", "claim_lesson_video_cleanup"].includes(name)
    if (!actor && !(access.service && cleanup)) fail("42501")
    // Write an authorization fence. Concurrent suspension or revocation causes
    // the MongoDB transaction to retry against current permissions.
    if (actor) await db.collection("profiles").updateOne({ id: actor.id }, { $inc: { access_version: 1 } }, options)
    if (name === "manage_course_instructor") {
      if (!await db.collection("courses").findOne({ id: args.p_course_id }, options)) fail("23503")
      if (!await db.collection("profiles").findOne({ id: args.p_instructor_id, role: "instructor", ...(args.p_assigned ? { status: "active" } : {}) }, options)) fail("23503")
      await db.collection("courses").updateOne({ id: args.p_course_id }, { $inc: { access_version: 1 } }, options)
      const key = { course_id: args.p_course_id, instructor_id: args.p_instructor_id }
      if (args.p_assigned) await db.collection("instructor_courses").updateOne(key, { $setOnInsert: { ...key, ...defaultsFor("instructor_courses"), id: randomUUID(), assigned_by: actor!.id } }, { ...options, upsert: true })
      else {
        await db.collection("instructor_courses").deleteOne(key, options)
        await db.collection("courses").updateOne({ id: args.p_course_id, instructor_id: args.p_instructor_id }, { $set: { instructor_id: null, updated_at: now } }, options)
      }
      await db.collection("audit_logs").insertOne({ ...defaultsFor("audit_logs"), id: randomUUID(), actor_id: actor!.id, entity_type: "course", entity_id: args.p_course_id, action: args.p_assigned ? "instructor.assigned" : "instructor.unassigned", metadata: { instructor_id: args.p_instructor_id } }, options)
      return null
    }
    if (!access.service) fail("42501")
    if (name === "approve_student_payment") return approvePaymentOperation(db, session, args, actor!)
    if (name === "delete_unreferenced_payment_method") {
      // Touch the method before checking references, so payment inserts serialize.
      const method = await db.collection("payment_methods").findOneAndUpdate({ id: args.target_id, updated_at: args.expected_updated_at }, { $inc: { access_version: 1 } }, { ...options, returnDocument: "after" })
      if (!method) return false
      if (await db.collection("payment_submissions").findOne({ payment_method_id: args.target_id }, options)) fail("23503")
      await db.collection("payment_methods").deleteOne({ id: args.target_id }, options)
      await db.collection("audit_logs").insertOne({ ...defaultsFor("audit_logs"), id: randomUUID(), actor_id: actor!.id, entity_type: "payment_method", entity_id: args.target_id, action: "payment_method.deleted" }, options)
      return true
    }
    return videoOperation(db, session, name, args)
  })
}
