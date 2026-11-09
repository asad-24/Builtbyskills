import "server-only"
import { randomUUID } from "node:crypto"
import type { ClientSession } from "mongodb"
import { mongoDb } from "./connection"
import { type Row, fail, defaultsFor } from "./query"
import type { Access } from "./access"
import type { Table } from "./schema"
import { safeExternalUrl } from "@/lib/validations/course-builder"

export async function validateWrite(table: Table, row: Row, old: Row | null, access: Access, session?: ClientSession) {
  const db = mongoDb(), options = { session }
  for (const key of Object.keys(row)) if (key !== "_id" && !/^[a-z][a-z_0-9]*$/.test(key)) fail("23514")
  for (const key of ["starts_at", "ends_at", "expires_at", "enrolled_at", "completed_at"]) {
    if (row[key]) { const date = new Date(row[key]); if (!Number.isFinite(date.getTime())) fail("23514"); row[key] = date.toISOString() }
  }
  if (!access.service) {
    const identity = await access.identity()
    const profile = identity && await db.collection("profiles").findOne({ auth_user_id: identity.id, status: "active" }, options)
    if (!profile) fail("42501")
    if (profile.role !== "super_admin") {
      if (profile.role !== "instructor" || !["live_classes", "course_recordings"].includes(table)) fail("42501")
      const owner = table === "live_classes" ? "instructor_id" : "author_id"
      if (old && (old.course_id !== row.course_id || old[owner] !== row[owner])) fail("42501")
      if (!old && row[owner] !== profile.id) fail("42501")
      if (old) {
        const allowed = new Set(["title", "description", "updated_at", ...(table === "live_classes" ? ["meeting_url", "meeting_provider", "starts_at", "ends_at", "status"] : ["recording_url", "is_published"])])
        for (const key of Object.keys(row)) if (JSON.stringify(row[key]) !== JSON.stringify(old[key]) && !allowed.has(key)) fail("42501")
      }
    }
  }
  const reference = async (target: string, id: string, extra: Row = {}) => {
    if (!id || !await db.collection(target).findOne({ id, ...extra }, options)) fail("23503")
    if (session) await db.collection(target).updateOne({ id }, { $inc: { access_version: 1 } }, options)
  }
  if (table === "profiles") {
    if (old && (old.role !== row.role || old.email !== row.email || old.auth_user_id !== row.auth_user_id)) fail("42501")
    if (!row.email || !row.full_name || !["super_admin", "instructor", "student"].includes(row.role) || !["active", "inactive", "suspended"].includes(row.status)) fail("23514")
    row.email = row.email.trim().toLowerCase()
    if (row.auth_user_id && !await db.collection("user").findOne({ _id: row.auth_user_id, email: row.email }, options)) fail("23503")
  }
  if (table === "courses") {
    if (!row.title || !row.slug || row.price < 0 || !["published", "draft", "unpublished", "archived"].includes(row.status)) fail("23514")
    if (row.instructor_id) await reference("profiles", row.instructor_id, { role: "instructor", status: "active" })
  }
  if (["course_sections", "instructor_courses", "enrollments", "live_classes", "course_recordings", "payment_submissions", "enrollment_requests"].includes(table)) await reference("courses", row.course_id)
  if (table === "instructor_courses") await reference("profiles", row.instructor_id, { role: "instructor", status: "active" })
  if (table === "enrollments") {
    await reference("profiles", row.student_id, { role: "student" })
    if (!["pending", "active", "suspended", "completed", "expired", "cancelled"].includes(row.status) || (row.expires_at && row.starts_at && row.expires_at <= row.starts_at)) fail("23514")
  }
  if (table === "lessons") {
    await reference("course_sections", row.section_id)
    if (row.status === "published") {
      if (row.lesson_type === "text" && !row.description) fail("23514")
      if (row.lesson_type === "video" && !row.youtube_video_id) await reference("lesson_video_assets", row.video_asset_id, { lesson_id: row.id, state: "ready", retired_at: null, cleanup_after: null })
    }
  }
  if (table === "lesson_resources" || table === "lesson_progress") await reference("lessons", row.lesson_id)
  if (table === "lesson_progress") {
    await reference("profiles", row.student_id, { role: "student", status: "active" })
    const lesson = await db.collection("lessons").findOne({ id: row.lesson_id, status: "published" }, options)
    const section = lesson && await db.collection("course_sections").findOne({ id: lesson.section_id }, options)
    if (!section) fail("42501")
    await reference("courses", section.course_id, { status: "published" })
    const enrollment = await db.collection("enrollments").findOne({ id: row.enrollment_id, student_id: row.student_id, course_id: section.course_id, status: "active" }, options)
    const now = new Date().toISOString()
    if (!enrollment || (enrollment.starts_at && enrollment.starts_at > now) || (enrollment.expires_at && enrollment.expires_at <= now)) fail("42501")
    await reference("enrollments", enrollment.id)
    if (old?.is_completed) { row.is_completed = true; row.completion_percentage = 100; row.completed_at = old.completed_at }
    if (row.progress_seconds < 0 || row.completion_percentage < 0 || row.completion_percentage > 100) fail("23514")
  }
  if (table === "enrollment_requests") await reference("payment_submissions", row.payment_submission_id, { course_id: row.course_id })
  if (table === "payment_submissions") {
    if (row.payment_method_id) await reference("payment_methods", row.payment_method_id)
    if (row.student_id) await reference("profiles", row.student_id, { role: "student" })
  }
  if (table === "course_recordings" && (!safeExternalUrl(row.recording_url) || row.title?.trim().length < 3)) fail("23514")
  if (table === "live_classes") {
    if (!safeExternalUrl(row.meeting_url) || !Number.isFinite(Date.parse(row.starts_at)) || (row.ends_at && row.ends_at <= row.starts_at)) fail("23514")
    if (row.instructor_id) {
      await reference("profiles", row.instructor_id, { role: "instructor", status: "active" })
      if (!await db.collection("instructor_courses").findOne({ instructor_id: row.instructor_id, course_id: row.course_id }, options)) fail("23503")
    }
  }
  if (table === "announcements" && row.course_id) await reference("courses", row.course_id)
}

export async function syncInstructor(row: Row, old: Row | null, session?: ClientSession) {
  const db = mongoDb(), options = { session }
  if (old?.instructor_id && old.instructor_id !== row.instructor_id) await db.collection("instructor_courses").deleteOne({ course_id: row.id, instructor_id: old.instructor_id }, options)
  if (row.instructor_id) await db.collection("instructor_courses").updateOne({ course_id: row.id, instructor_id: row.instructor_id }, { $setOnInsert: { id: randomUUID(), created_at: new Date().toISOString(), assigned_by: null } }, { ...options, upsert: true })
}

export async function cascadeDelete(table: Table, row: Row, session?: ClientSession) {
  const db = mongoDb(), options = { session }
  if (table === "payment_methods" && await db.collection("payment_submissions").findOne({ payment_method_id: row.id }, options)) fail("23503")
  if (table === "courses") {
    if (await db.collection("payment_submissions").findOne({ course_id: row.id }, options)) fail("23503")
    for (const section of await db.collection("course_sections").find({ course_id: row.id }, options).toArray()) await cascadeDelete("course_sections", section, session)
    for (const child of ["course_sections", "enrollments", "instructor_courses", "live_classes", "course_recordings", "announcements", "enrollment_requests"]) await db.collection(child).deleteMany({ course_id: row.id }, options)
  }
  if (table === "course_sections") {
    for (const lesson of await db.collection("lessons").find({ section_id: row.id }, options).toArray()) await cascadeDelete("lessons", lesson, session)
    await db.collection("lessons").deleteMany({ section_id: row.id }, options)
  }
  if (table === "lessons") {
    for (const child of ["lesson_resources", "lesson_progress"]) await db.collection(child).deleteMany({ lesson_id: row.id }, options)
    const now = new Date().toISOString()
    await db.collection("lesson_video_assets").updateMany({ lesson_id: row.id }, { $set: { lesson_id: null, retired_at: now, cleanup_after: now } }, options)
  }
  if (table === "profiles") {
    // Revoke sessions before removing the identity's profile. Auth credentials
    // remain unusable because every protected operation requires an active profile.
    if (row.auth_user_id) await db.collection("session").deleteMany({ userId: row.auth_user_id }, options)
    for (const child of ["enrollments", "lesson_progress"]) await db.collection(child).deleteMany({ student_id: row.id }, options)
    await db.collection("instructor_courses").deleteMany({ instructor_id: row.id }, options)
    await db.collection("payment_submissions").updateMany({ student_id: row.id }, { $set: { student_id: null } }, options)
  }
}

export async function ensureStudent(identity: { id: string; email: string; emailVerified: boolean; name?: string; phone?: string }, session?: ClientSession) {
  if (!identity.emailVerified) fail("42501")
  const db = mongoDb(), options = { session }, email = identity.email.trim().toLowerCase()
  const old = await db.collection("profiles").findOne({ $or: [{ auth_user_id: identity.id }, { email }] }, options)
  if (old && (old.role !== "student" || old.status !== "active" || (old.auth_user_id && old.auth_user_id !== identity.id) || old.email !== email)) fail("42501")
  if (old) {
    await db.collection("profiles").updateOne({ id: old.id }, { $set: { auth_user_id: identity.id } }, options)
    return old.id
  }
  const row = { ...defaultsFor("profiles"), id: randomUUID(), auth_user_id: identity.id, full_name: identity.name || email, email, phone: identity.phone ?? null }
  await db.collection("profiles").insertOne(row, options)
  return row.id
}
