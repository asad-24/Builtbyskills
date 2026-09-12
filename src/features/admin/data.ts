import "server-only"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AdminStats, AppResult, Course, CourseWithCurriculum, Profile, SectionWithLessons, Skill } from "@/types/lms"

type PersonRef = Pick<Profile, "id" | "full_name" | "email"> & Partial<Pick<Profile, "status">>
type CourseRow = Course & { instructor?: PersonRef | null }
type StudentRow = Profile
type InstructorRow = Profile
type EnrollmentRow = Record<string, unknown> & {
  id: string
  status: string
  starts_at: string | null
  expires_at: string | null
  created_at: string
  student?: PersonRef | null
  course?: Pick<Course, "title" | "slug"> | null
}
type PaymentRow = Record<string, unknown> & {
  id: string
  amount: number
  currency: string
  transaction_reference: string | null
  screenshot_path: string | null
  status: string
  submitted_at: string
  course?: Pick<Course, "title" | "slug"> | null
  student?: PersonRef | null
}
type PaymentMethodRow = Record<string, unknown> & {
  id: string
  method_type: string
  display_name: string
  account_title: string
  account_number: string
  bank_name: string | null
  instructions: string | null
  is_active: boolean
}
type LiveClassRow = Record<string, unknown> & {
  id: string
  title: string
  meeting_provider: string
  status: string
  starts_at: string
  course?: Pick<Course, "title"> | null
  instructor?: PersonRef | null
}
type AnnouncementRow = Record<string, unknown> & {
  id: string
  title: string
  is_published: boolean
  created_at: string
  published_at: string | null
  course?: Pick<Course, "title"> | null
  author?: PersonRef | null
}
type ContactRow = Record<string, unknown> & {
  id: string
  full_name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  status: string
  created_at: string
}
type AuditLogRow = Record<string, unknown> & {
  id: string
  action: string
  entity_type: string
  metadata: Record<string, unknown>
  created_at: string
  actor?: PersonRef | null
}

export type AdminWorkspaceData = {
  stats: AdminStats
  courses: CourseRow[]
  instructors: InstructorRow[]
  students: StudentRow[]
  enrollments: EnrollmentRow[]
  payments: PaymentRow[]
  paymentMethods: PaymentMethodRow[]
  liveClasses: LiveClassRow[]
  announcements: AnnouncementRow[]
  contacts: ContactRow[]
  auditLogs: AuditLogRow[]
}

export type CourseBuilderData = {
  course: Course
  instructors: PersonRef[]
  sections: SectionWithLessons[]
}

function appError(error: unknown): AppResult<never> {
  if (error instanceof MissingEnvironmentError) {
    return {
      ok: false,
      reason: "missing_env",
      message: `Configure ${error.keys.join(", ")} to connect Builtbyskills to Supabase.`,
    }
  }
  if (error instanceof AppAuthError) {
    return { ok: false, reason: "unauthorized", message: error.message }
  }
  if (error instanceof AppForbiddenError) {
    return { ok: false, reason: "forbidden", message: error.message }
  }
  return {
    ok: false,
    reason: "error",
    message: error instanceof Error ? error.message : "Unable to load admin data.",
  }
}

async function countRows(supabase: ReturnType<typeof createSupabaseAdminClient>, table: string, filters: Record<string, unknown> = {}) {
  let query = supabase.from(table).select("id", { count: "exact", head: true })
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value)
  })
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function getAdminWorkspaceData(): Promise<AppResult<AdminWorkspaceData>> {
  try {
    await requireAdmin()
    const supabase = createSupabaseAdminClient()
    const now = new Date().toISOString()

    const [
      totalStudents,
      activeStudents,
      pendingEnrollments,
      pendingPayments,
      underReviewPayments,
      publishedCourses,
      upcomingLiveClasses,
      completedLessons,
      courses,
      instructors,
      students,
      enrollments,
      payments,
      paymentMethods,
      liveClasses,
      announcements,
      contacts,
      auditLogs,
    ] = await Promise.all([
      countRows(supabase, "profiles", { role: "student" }),
      countRows(supabase, "profiles", { role: "student", status: "active" }),
      countRows(supabase, "enrollments", { status: "pending" }),
      countRows(supabase, "payment_submissions", { status: "pending" }),
      countRows(supabase, "payment_submissions", { status: "under_review" }),
      countRows(supabase, "courses", { status: "published" }),
      supabase
        .from("live_classes")
        .select("id", { count: "exact", head: true })
        .gte("starts_at", now)
        .then(({ count, error }) => {
          if (error) throw error
          return count ?? 0
        }),
      countRows(supabase, "lesson_progress", { is_completed: true }),
      supabase
        .from("courses")
        .select("*, instructor:profiles!courses_instructor_id_fkey(id, full_name, email)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "instructor")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("enrollments")
        .select("*, student:profiles!enrollments_student_id_fkey(full_name,email,status), course:courses(title,slug)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payment_submissions")
        .select("*, course:courses(title,slug), student:profiles!payment_submissions_student_id_fkey(full_name,email)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payment_methods")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("live_classes")
        .select("*, course:courses(title), instructor:profiles(full_name,email)")
        .order("starts_at", { ascending: true })
        .limit(50),
      supabase
        .from("announcements")
        .select("*, course:courses(title), author:profiles(full_name,email)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("audit_logs")
        .select("*, actor:profiles(full_name,email)")
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    const queryResults = [
      courses,
      instructors,
      students,
      enrollments,
      payments,
      paymentMethods,
      liveClasses,
      announcements,
      contacts,
      auditLogs,
    ]

    const failed = queryResults.find((result) => result.error)
    if (failed?.error) throw failed.error

    return {
      ok: true,
      data: {
        stats: {
          totalStudents,
          activeStudents,
          pendingEnrollments,
          pendingPayments: pendingPayments + underReviewPayments,
          publishedCourses,
          upcomingLiveClasses,
          completedLessons,
        },
        courses: (courses.data ?? []) as CourseRow[],
        instructors: (instructors.data ?? []) as InstructorRow[],
        students: (students.data ?? []) as StudentRow[],
        enrollments: (enrollments.data ?? []) as EnrollmentRow[],
        payments: (payments.data ?? []) as PaymentRow[],
        paymentMethods: (paymentMethods.data ?? []) as PaymentMethodRow[],
        liveClasses: (liveClasses.data ?? []) as LiveClassRow[],
        announcements: (announcements.data ?? []) as AnnouncementRow[],
        contacts: (contacts.data ?? []) as ContactRow[],
        auditLogs: (auditLogs.data ?? []) as AuditLogRow[],
      },
    }
  } catch (error) {
    return appError(error)
  }
}

export async function getCourseBuilderData(courseId: string): Promise<AppResult<CourseBuilderData>> {
  try {
    await requireAdmin()
    const supabase = createSupabaseAdminClient()
    const [course, instructors, sections] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
      supabase.from("profiles").select("id, full_name, email").eq("role", "instructor"),
      supabase
        .from("course_sections")
        .select("*, lessons(*, lesson_resources(*))")
        .eq("course_id", courseId)
        .order("position", { ascending: true })
        .order("position", { referencedTable: "lessons", ascending: true }),
    ])

    if (course.error) throw course.error
    if (instructors.error) throw instructors.error
    if (sections.error) throw sections.error

    return {
      ok: true as const,
      data: {
        course: course.data as Course,
        instructors: (instructors.data ?? []) as PersonRef[],
        sections: (sections.data ?? []) as SectionWithLessons[],
      },
    }
  } catch (error) {
    return appError(error)
  }
}

export async function getPublicCourses() {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("title", { ascending: true })

    if (error) throw error
    return { ok: true as const, data: (data ?? []) as Course[] }
  } catch (error) {
    return appError(error)
  }
}

export async function getPublicCourseBySlug(slug: string) {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("courses")
      .select("*, course_sections(*, lessons(*))")
      .eq("slug", slug)
      .eq("status", "published")
      .single()

    if (error) throw error
    return { ok: true as const, data: data as CourseWithCurriculum }
  } catch (error) {
    return appError(error)
  }
}

export async function getEnrollmentPageData() {
  try {
    const supabase = createSupabaseAdminClient()
    const [courses, paymentMethods] = await Promise.all([
      supabase
        .from("courses")
        .select("id, title, price, currency")
        .eq("status", "published")
        .order("title"),
      supabase.from("payment_methods").select("*").eq("is_active", true).order("display_name"),
    ])

    if (courses.error) throw courses.error
    if (paymentMethods.error) throw paymentMethods.error

    return {
      ok: true as const,
      data: {
        courses: courses.data ?? [],
        paymentMethods: paymentMethods.data ?? [],
      },
    }
  } catch (error) {
    return appError(error)
  }
}

export async function getAdminSkills() {
  try {
    await requireAdmin()
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("skills")
      .select("*")
      .order("position", { ascending: true })
      .order("name", { ascending: true })

    if (error) throw error
    return { ok: true as const, data: (data ?? []) as Skill[] }
  } catch (error) {
    return appError(error)
  }
}

export async function getPublicSkills() {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("skills")
      .select("*")
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("name", { ascending: true })

    if (error) throw error
    return { ok: true as const, data: (data ?? []) as Skill[] }
  } catch (error) {
    return appError(error)
  }
}
