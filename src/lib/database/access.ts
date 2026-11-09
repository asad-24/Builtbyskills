import "server-only"
import type { ClientSession, Document, Filter } from "mongodb"
import { mongoDb } from "./connection"
import type { Table } from "./schema"

export type Identity = { id: string; email: string; emailVerified: boolean }
export type Access = { service: true } | { service: false; identity: () => Promise<Identity | null> }
const denied = { id: { $in: [] } }

export async function scope(table: Table, access: Access, operation = "select", session?: ClientSession): Promise<Filter<Document>> {
  if (access.service) return {}
  const db = mongoDb(), options = { session }
  const identity = await access.identity()
  const profile = identity?.emailVerified ? await db.collection("profiles").findOne({ auth_user_id: identity.id, status: "active" }, options) : null
  if (profile && operation !== "select" && session) await db.collection("profiles").updateOne({ id: profile.id }, { $inc: { access_version: 1 } }, options)
  if (profile?.role === "super_admin") return {}
  const read = operation === "select"
  if (!profile) {
    if (!read) return denied
    if (table === "courses") return { status: "published" }
    if (table === "skills") return { is_active: true }
    if (table === "payment_methods") return { is_active: true }
    return denied
  }
  if (table === "profiles") return read ? { id: profile.id } : denied
  if (table === "skills" || table === "payment_methods") return read ? { is_active: true } : denied
  if (profile.role === "student") {
    if (table === "courses") return read ? { status: "published" } : denied
    if (table === "enrollments" || table === "payment_submissions") return read ? { student_id: profile.id } : denied
  }
  if (table === "notifications") return read ? { recipient_id: profile.id } : denied
  let courseIds: string[] = []
  if (profile.role === "instructor") {
    const assignments = await db.collection("instructor_courses").find({ instructor_id: profile.id }, options).toArray()
    courseIds = assignments.map(row => row.course_id as string)
    if (operation !== "select" && session && courseIds.length) await db.collection("instructor_courses").updateMany({ instructor_id: profile.id }, { $inc: { access_version: 1 } }, options)
  } else if (profile.role === "student") {
    const now = new Date().toISOString()
    const enrollments = await db.collection("enrollments").find({ student_id: profile.id, status: "active", $and: [
      { $or: [{ starts_at: null }, { starts_at: { $lte: now } }] },
      { $or: [{ expires_at: null }, { expires_at: { $gt: now } }] },
    ] }, options).toArray()
    const published = await db.collection("courses").find({ id: { $in: enrollments.map(row => row.course_id) }, status: "published" }, options).toArray()
    courseIds = published.map(row => row.id as string)
  }
  const instructor = profile.role === "instructor"
  if (table === "courses") return read ? instructor ? { id: { $in: courseIds } } : { status: "published" } : denied
  if (table === "instructor_courses") return read && instructor ? { instructor_id: profile.id } : denied
  if (table === "enrollments") return read ? instructor ? { course_id: { $in: courseIds } } : { student_id: profile.id } : denied
  if (table === "payment_submissions") return read && !instructor ? { student_id: profile.id } : denied
  if (table === "live_classes" || table === "course_recordings") {
    if (!read && !instructor) return denied
    return { course_id: { $in: courseIds }, ...(!instructor ? table === "live_classes" ? { status: { $in: ["scheduled", "live"] } } : { is_published: true } : {}) }
  }
  if (table === "announcements") return read ? { is_published: true, $or: [{ course_id: null }, { course_id: { $in: courseIds } }] } : denied
  if (!read) return denied
  if (table === "course_sections") return { course_id: { $in: courseIds } }
  const sections = await db.collection("course_sections").find({ course_id: { $in: courseIds } }, options).toArray()
  if (table === "lessons") return { section_id: { $in: sections.map(row => row.id) }, ...(!instructor ? { status: "published" } : {}) }
  const lessons = await db.collection("lessons").find({ section_id: { $in: sections.map(row => row.id) }, ...(!instructor ? { status: "published" } : {}) }, options).toArray()
  if (table === "lesson_resources") return { lesson_id: { $in: lessons.map(row => row.id) } }
  if (table === "lesson_progress" && !instructor) return { student_id: profile.id, lesson_id: { $in: lessons.map(row => row.id) } }
  return denied
}
