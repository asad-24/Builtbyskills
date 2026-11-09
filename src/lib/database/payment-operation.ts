import "server-only"
import { randomUUID } from "node:crypto"
import type { Db, ClientSession } from "mongodb"
import { defaultsFor, type Row } from "./query"

export async function approvePaymentOperation(db: Db, session: ClientSession, args: Row, actor: Row) {
  const options = { session }, now = new Date().toISOString()
  const failure = (reason: string) => ({ ok: false, reason })
  const payment = await db.collection("payment_submissions").findOne({ id: args.p_payment_id }, options)
  if (!payment) return failure("missing_payment")
  if (!["pending", "under_review", "approved"].includes(payment.status)) return failure("invalid_state")
  const request = await db.collection("enrollment_requests").findOne({ payment_submission_id: payment.id }, options)
  if (request && (request.course_id !== payment.course_id || !["pending", "active"].includes(request.status))) return failure("invalid_request")
  const linked = payment.student_id ? await db.collection("profiles").findOne({ id: payment.student_id }, options) : null
  const email = String(request?.email || linked?.email || "").trim().toLowerCase()
  const fullName = request?.full_name || linked?.full_name
  if (!email || !fullName) return failure("invalid_request")
  const course = await db.collection("courses").findOne({ id: payment.course_id }, options)
  if (!course) return failure("missing_course")
  const user = await db.collection("user").findOne({ email }, options)
  const matches = await db.collection("profiles").find({ $or: [{ email }, ...(user ? [{ auth_user_id: String(user._id) }] : [])] }, options).toArray()
  if (matches.length > 1) return failure("identity_conflict")
  let student: Row | null = matches[0] ?? null
  if ((user && !user.emailVerified) || (student && (student.role !== "student" || student.status !== "active" || student.email !== email || (student.auth_user_id && student.auth_user_id !== String(user?._id))))) return failure("identity_conflict")
  if (payment.student_id && payment.student_id !== student?.id) return failure("identity_conflict")
  let enrollment = student ? await db.collection("enrollments").findOne({ student_id: student.id, course_id: course.id }, options) : null
  if (payment.status === "approved") {
    if (!student?.auth_user_id || payment.student_id !== student.id || !enrollment || enrollment.status !== "active" || (enrollment.starts_at && enrollment.starts_at > now) || (enrollment.expires_at && enrollment.expires_at <= now) || (request && request.status !== "active")) return failure("incomplete_approval")
    const receipt = await db.collection("audit_logs").findOne({ action: "payment.reviewed", entity_id: payment.id, "metadata.approval_version": 1 }, options)
    return { ok: true, already_approved: true, email_status: receipt?.metadata?.email_status || "unknown" }
  }
  if (enrollment && (!["pending", "active"].includes(enrollment.status) || (enrollment.expires_at && enrollment.expires_at <= now))) return failure("enrollment_conflict")
  if (!args.p_finalize) return { ok: true, email, full_name: fullName, auth_user_id: user ? String(user._id) : null }
  if (!user || String(user._id) !== args.p_auth_user_id) return failure("identity_changed")
  // Unique email and enrollment indexes arbitrate concurrent approvals. The
  // payment update below also makes replay compete on the same document.
  if (!student) {
    student = { ...defaultsFor("profiles"), id: randomUUID(), auth_user_id: String(user._id), full_name: fullName, email, phone: request?.phone ?? null, whatsapp: request?.whatsapp ?? null }
    await db.collection("profiles").insertOne(student, options)
  } else if (!student.auth_user_id) {
    student.auth_user_id = String(user._id)
    await db.collection("profiles").updateOne({ id: student.id }, { $set: { auth_user_id: student.auth_user_id } }, options)
  }
  if (!enrollment) {
    const row = { ...defaultsFor("enrollments"), id: randomUUID(), student_id: student.id, course_id: course.id, status: "active", enrolled_at: now, starts_at: now, assigned_by: actor.id }
    await db.collection("enrollments").insertOne(row, options)
    enrollment = await db.collection("enrollments").findOne({ id: row.id }, options)
  } else if (enrollment.status === "pending") await db.collection("enrollments").updateOne({ id: enrollment.id }, { $set: { status: "active", enrolled_at: enrollment.enrolled_at || now, starts_at: enrollment.starts_at || now, updated_at: now } }, options)
  await db.collection("payment_submissions").updateOne({ id: payment.id }, { $set: { student_id: student.id, status: "approved", reviewed_by: actor.id, reviewed_at: now, rejection_reason: null } }, options)
  if (request) await db.collection("enrollment_requests").updateOne({ id: request.id }, { $set: { status: "active" } }, options)
  const activation = user.passwordSetupRequired === true && !await db.collection("audit_logs").findOne({ "metadata.auth_user_id": String(user._id), "metadata.activation": true }, options)
  const metadata = { status: "approved", approval_version: 1, student_id: student.id, auth_user_id: String(user._id), enrollment_id: enrollment!.id, activation, email_status: "pending" }
  const receiptId = randomUUID()
  await db.collection("audit_logs").insertOne({ ...defaultsFor("audit_logs"), id: receiptId, actor_id: actor.id, action: "payment.reviewed", entity_type: "payment_submission", entity_id: payment.id, metadata }, options)
  return { ok: true, already_approved: false, activation, email, full_name: student.full_name, course_title: course.title, receipt_id: receiptId, receipt_metadata: metadata }
}
