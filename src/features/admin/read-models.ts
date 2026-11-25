import "server-only"
import type { Document } from "mongodb"
import { requireAdminRead } from "@/lib/auth/session"
import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { mongoDb } from "@/lib/database/connection"
import { ensureDatabaseReady } from "@/lib/database/schema"
import { databaseError } from "@/lib/database/query"
import type { AdminStats, AppResult, Profile } from "@/types/lms"
import type { CourseRow, EnrollmentRow, PaymentRow, PaymentMethodRow, LiveClassRow, AnnouncementRow, ContactRow, AuditLogRow } from "./data"

type Pagination = { page: number; hasNext: boolean }
type Option = { value: string; label: string }
const newest = { created_at: -1, id: -1 } as const
const profileFields = { _id: 0, id: 1, auth_user_id: 1, full_name: 1, email: 1, phone: 1, whatsapp: 1, avatar_url: 1, role: 1, status: 1, created_at: 1, updated_at: 1 }
const relation = (from: string, field: string, as: string, fields: Record<string, number>): Document[] => [
  { $lookup: { from, localField: field, foreignField: "id", pipeline: [{ $project: { _id: 0, ...fields } }], as } },
  { $set: { [as]: { $ifNull: [{ $arrayElemAt: [`$${as}`, 0] }, null] } } },
]
const course = () => relation("courses", "course_id", "course", { title: 1, slug: 1 })
const person = (field: string, as: string) => relation("profiles", field, as, { full_name: 1, email: 1, status: 1 })
const pageNumber = (input?: string) => { const n = Number(input ?? 1); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1 }

async function rows<T extends Document>(table: string, pipeline: Document[]): Promise<T[]> {
  return mongoDb().collection(table).aggregate<T>([...pipeline, { $project: { _id: 0 } }]).toArray()
}
function list<T extends Document>(table: string, joins: Document[] = [], limit = 50, sort: Document = newest, filter: Document = {}) {
  return rows<T>(table, [{ $match: filter }, { $sort: sort }, { $limit: limit }, ...joins])
}
async function paged<T extends Document>(table: string, input?: string, filter: Document = {}, joins: Document[] = []) {
  const page = pageNumber(input)
  const items = await rows<T>(table, [{ $match: filter }, { $sort: newest }, { $skip: (page - 1) * 50 }, { $limit: 51 }, ...joins])
  return { items: items.slice(0,50), pagination: { page, hasNext: items.length > 50 } satisfies Pagination }
}
async function load<T>(read: () => Promise<T>): Promise<AppResult<T>> {
  try {
    await requireAdminRead()
    await ensureDatabaseReady()
    return { ok: true, data: await read() }
  } catch (error) {
    if (error instanceof AppAuthError) return { ok: false, reason: "unauthorized", message: error.message }
    if (error instanceof AppForbiddenError) return { ok: false, reason: "forbidden", message: error.message }
    if (error instanceof MissingEnvironmentError) return { ok: false, reason: "missing_env", message: "Database configuration is incomplete." }
    return { ok: false, reason: "error", message: databaseError(error, { operation: "select" }).message }
  }
}

// Selectors are independent of a paginated table and include older records.
async function courseOptions() {
  return rows<Pick<CourseRow,"id"|"title">>("courses", [{ $sort: { title: 1, id: 1 } }, { $project: { id: 1, title: 1 } }])
}
async function peopleOptions(role: "student" | "instructor"): Promise<Option[]> {
  const options: Option[] = []
  for (let offset = 0; ; offset += 500) {
    const page = await rows<Pick<Profile,"id"|"full_name"|"email"|"status">>("profiles", [
      { $match: { role } }, { $sort: { id: 1 } }, { $skip: offset }, { $limit: 500 },
      { $project: { id: 1, full_name: 1, email: 1, status: 1 } },
    ])
    options.push(...page.map(p => ({ value: p.id, label: `${p.full_name} (${p.email}) · ${p.status}` })))
    if (page.length < 500) return options
  }
}

async function stats(): Promise<AdminStats> {
  const db = mongoDb(), now = new Date().toISOString()
  const [profiles, payments, pendingEnrollments, publishedCourses, upcomingLiveClasses, completedLessons] = await Promise.all([
    rows<{ total: number; active: number }>("profiles", [{ $match: { role: "student" } }, { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } } } }]),
    db.collection("payment_submissions").countDocuments({ status: { $in: ["pending", "under_review"] } }),
    db.collection("enrollments").countDocuments({ status: "pending" }),
    db.collection("courses").countDocuments({ status: "published" }),
    db.collection("live_classes").countDocuments({ starts_at: { $gte: now } }),
    db.collection("lesson_progress").countDocuments({ is_completed: true }),
  ])
  return { totalStudents: profiles[0]?.total ?? 0, activeStudents: profiles[0]?.active ?? 0, pendingEnrollments, pendingPayments: payments, publishedCourses, upcomingLiveClasses, completedLessons }
}

export const getAdminOverviewData = () => load(async () => {
  const [summary, payments, liveClasses, auditLogs] = await Promise.all([
    stats(), list<PaymentRow>("payment_submissions", course(), 6),
    list<LiveClassRow>("live_classes", course(), 6, { starts_at: 1, id: 1 }),
    list<AuditLogRow>("audit_logs", person("actor_id", "actor"), 8),
  ])
  return { stats: summary, payments, liveClasses, auditLogs }
})
export const getAdminReportsData = () => load(async () => ({ stats: await stats() }))
export const getAdminCoursesData = (page?: string) => load(async () => {
  const [courses, instructors] = await Promise.all([
    paged<CourseRow>("courses", page),
    rows<Profile>("profiles", [{ $match: { role: "instructor" } }, { $sort: { full_name: 1, id: 1 } }, { $project: profileFields }]),
  ])
  return { courses: courses.items, pagination: courses.pagination, instructors }
})
export const getAdminCourseIndexData = () => load(async () => ({ courses: await list<CourseRow>("courses") }))
export const getAdminStudentsData = (page?: string) => load(async () => {
  const [students, courses] = await Promise.all([paged<Profile>("profiles", page, { role: "student" }, [{ $project: profileFields }]), courseOptions()])
  return { students: students.items, pagination: students.pagination, courses }
})
export const getAdminInstructorsData = (page?: string) => load(async () => {
  const [instructors, courses, instructorOptions] = await Promise.all([
    paged<Profile & { assignments: { course: { title: string } | null }[] }>("profiles", page, { role: "instructor" }, [
      { $project: profileFields },
      { $lookup: { from: "instructor_courses", localField: "id", foreignField: "instructor_id", pipeline: [...course(), { $project: { _id: 0, course: 1 } }], as: "assignments" } },
    ]), courseOptions(), peopleOptions("instructor"),
  ])
  return { instructors: instructors.items, pagination: instructors.pagination, courses, instructorOptions }
})
export const getAdminEnrollmentsData = (page?: string) => load(async () => {
  const [enrollments, courses, studentOptions] = await Promise.all([
    paged<EnrollmentRow>("enrollments", page, {}, [...person("student_id", "student"), ...course()]), courseOptions(), peopleOptions("student"),
  ])
  return { enrollments: enrollments.items, pagination: enrollments.pagination, courses, studentOptions }
})
export const getAdminPaymentsData = () => load(async () => ({ payments: await list<PaymentRow>("payment_submissions", [...course(), ...person("student_id", "student")]) }))
export const getAdminPaymentSettingsData = () => load(async () => ({ paymentMethods: await rows<PaymentMethodRow>("payment_methods", [{ $sort: newest }]) }))
export const getAdminClassesData = () => load(async () => {
  const [liveClasses, courses, instructors] = await Promise.all([
    list<LiveClassRow>("live_classes", [...course(), ...person("instructor_id", "instructor")], 50, { starts_at: 1, id: 1 }), courseOptions(),
    rows<Profile>("profiles", [{ $match: { role: "instructor" } }, { $sort: { full_name: 1 } }, { $project: profileFields }]),
  ])
  return { liveClasses, courses, instructors }
})
export const getAdminAnnouncementsData = () => load(async () => {
  const [announcements, courses] = await Promise.all([list<AnnouncementRow>("announcements", course()), courseOptions()])
  return { announcements, courses }
})
export const getAdminContactsData = () => load(async () => ({ contacts: await list<ContactRow>("contact_submissions") }))
export const getAdminAuditData = () => load(async () => ({ auditLogs: await list<AuditLogRow>("audit_logs", person("actor_id", "actor")) }))
