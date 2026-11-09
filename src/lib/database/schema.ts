import "server-only"
import { mongoDb } from "./connection"

export const tables = ["profiles", "courses", "course_sections", "lessons", "lesson_resources", "instructor_courses", "enrollments", "lesson_progress", "payment_methods", "payment_submissions", "enrollment_requests", "live_classes", "course_recordings", "announcements", "contact_submissions", "notifications", "audit_logs", "skills", "lesson_video_assets", "lesson_video_uploads"] as const
export type Table = typeof tables[number]

let initialized: Promise<void> | undefined
export function ensureIndexes() {
  if (!initialized) initialized = initialize().catch(error => { initialized = undefined; throw error })
  return initialized
}
async function initialize() {
  const db = mongoDb()
  for (const table of tables) await db.collection(table).createIndex({ id: 1 }, { unique: true })
  for (const [table, keys] of [
    ["profiles", { email: 1 }], ["courses", { slug: 1 }],
    ["course_sections", { course_id: 1, position: 1 }],
    ["lessons", { section_id: 1, position: 1 }], ["lessons", { section_id: 1, slug: 1 }],
    ["instructor_courses", { instructor_id: 1, course_id: 1 }],
    ["enrollments", { student_id: 1, course_id: 1 }],
    ["lesson_progress", { student_id: 1, lesson_id: 1 }],
    ["lesson_video_uploads", { asset_id: 1 }],
  ] as const) await db.collection(table).createIndex(keys, { unique: true })
  await db.collection("profiles").createIndex({ auth_user_id: 1 }, { unique: true, partialFilterExpression: { auth_user_id: { $type: "string" } } })
  for (const table of ["live_classes", "course_recordings", "announcements"]) await db.collection(table).createIndex({ course_id: 1 })
  await db.collection("instructor_courses").createIndex({ course_id: 1 })
  await db.collection("enrollment_requests").createIndex({ payment_submission_id: 1 }, { unique: true })
  await db.collection("user").createIndex({ email: 1 }, { unique: true })
  await db.collection("session").createIndex({ token: 1 }, { unique: true })
  await db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true })
  await db.collection("verification").createIndex({ identifier: 1 })
  await db.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("file_grants").createIndex({ token: 1 }, { unique: true })
  await db.collection("file_grants").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("file_chunks").createIndex({ fileId: 1, index: 1 }, { unique: true })
  await db.collection("file_chunks").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("files").createIndex({ bucket: 1, path: 1 }, { unique: true })
}
