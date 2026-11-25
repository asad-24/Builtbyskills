import "server-only"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { requireAdmin } from "@/lib/auth/session"
import { createDatabaseAdminClient } from "@/lib/database/admin"
import type { AppResult, Course, CourseWithCurriculum, Profile, SectionWithLessons } from "@/types/lms"

export type PersonRef = Pick<Profile, "id" | "full_name" | "email"> & Partial<Pick<Profile, "status">>
type BuilderVideoAsset = { id: string; state: string; original_name: string; retired_at: string | null; created_at: string; lesson_video_uploads: { id: string; initiated_by: string; state: string } | null }
type BuilderSection = Omit<SectionWithLessons, "lessons"> & { lessons?: (NonNullable<SectionWithLessons["lessons"]>[number] & { video_assets?: BuilderVideoAsset[] })[] }
export type CourseRow = Course & { instructor?: PersonRef | null }
export type StudentRow = Profile
export type InstructorRow = Profile
export type EnrollmentRow = Record<string, unknown> & {
  student_id: string
  course_id: string
  id: string
  status: string
  starts_at: string | null
  expires_at: string | null
  created_at: string
  student?: PersonRef | null
  course?: Pick<Course, "title" | "slug"> | null
}
export type PaymentRow = Record<string, unknown> & {
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
export type PaymentMethodRow = Record<string, unknown> & {
  updated_at: string
  id: string
  method_type: string
  display_name: string
  account_title: string
  account_number: string
  iban_number: string | null
  bank_name: string | null
  instructions: string | null
  is_active: boolean
}
export type LiveClassRow = Record<string, unknown> & {
  id: string
  title: string
  meeting_provider: string
  status: string
  starts_at: string
  course?: Pick<Course, "title"> | null
  instructor?: PersonRef | null
}
export type AnnouncementRow = Record<string, unknown> & {
  id: string
  title: string
  is_published: boolean
  created_at: string
  published_at: string | null
  course?: Pick<Course, "title"> | null
  author?: PersonRef | null
}
export type ContactRow = Record<string, unknown> & {
  updated_at: string
  id: string
  full_name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  status: string
  created_at: string
}
export type AuditLogRow = Record<string, unknown> & {
  id: string
  action: string
  entity_type: string
  metadata: Record<string, unknown>
  created_at: string
  actor?: PersonRef | null
}

export type CourseBuilderData = {
  course: Course
  instructors: PersonRef[]
  sections: SectionWithLessons[]
}

function getSetupErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) {
      if (message.toLowerCase().includes("invalid api key")) {
        return "Database credentials are invalid. Update MONGODB_URI in Vercel and redeploy."
      }
      return message
    }
  }

  return "Unable to load enrollment data. Check the MongoDB connection in Vercel."
}

function appError(error: unknown): AppResult<never> {
  if (error instanceof MissingEnvironmentError) {
    return {
      ok: false,
      reason: "missing_env",
      message: `Configure ${error.keys.join(", ")} to connect Builtbyskills to MongoDB.`,
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
    message: getSetupErrorMessage(error),
  }
}

export async function getCourseBuilderData(courseId: string): Promise<AppResult<CourseBuilderData>> {
  try {
    const admin = await requireAdmin()
    const supabase = createDatabaseAdminClient()
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

    let builderSections = (sections.data ?? []) as BuilderSection[]
    // SELECT * exposes these columns only after the R2 migration. Before then,
    // keep curriculum loading independent of its new tables and relationships.
    const hasR2Schema = builderSections.some(section => (section.lessons ?? []).some(lesson =>
      Object.hasOwn(lesson, "video_asset_id") && Object.hasOwn(lesson, "video_source"),
    ))
    if (hasR2Schema) {
      const enrichedSections = await supabase
        .from("course_sections")
        .select("*, lessons(*, lesson_resources(*), video_assets:lesson_video_assets!lesson_video_assets_lesson_id_fkey(id, state, original_name, retired_at, created_at, lesson_video_uploads(id, initiated_by, state)))")
        .eq("course_id", courseId)
        .order("position", { ascending: true })
        .order("position", { referencedTable: "lessons", ascending: true })
      if (enrichedSections.error) throw enrichedSections.error
      builderSections = (enrichedSections.data ?? []) as BuilderSection[]
    }

    return {
      ok: true as const,
      data: {
        course: course.data as Course,
        instructors: (instructors.data ?? []) as PersonRef[],
        sections: builderSections.map(section => ({ ...section, lessons: (section.lessons ?? []).map(lesson => {
          const candidates = (lesson.video_assets ?? []).filter(asset => !asset.retired_at && asset.id !== lesson.video_asset_id && !["deleted", "deleting"].includes(asset.state))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
          const pending = candidates.find(asset => asset.lesson_video_uploads?.initiated_by === admin.id && asset.lesson_video_uploads.state !== "canceled")
          const upload = pending?.lesson_video_uploads
          const { video_assets: _assets, ...safeLesson } = lesson
          void _assets
          return { ...safeLesson, ...(pending && upload ? { video_upload: { id: upload.id, state: pending.state === "ready" ? "ready" : upload.state, name: pending.original_name } } : {}) }
        }) })) as SectionWithLessons[],
      },
    }
  } catch (error) {
    return appError(error)
  }
}

export async function getPublicCourses() {
  try {
    const supabase = createDatabaseAdminClient()
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
    const supabase = createDatabaseAdminClient()
    const { data, error } = await supabase
      .from("courses")
      .select("*, course_sections(*, lessons(id,title,lesson_type,status,position,is_preview))")
      .eq("slug", slug)
      .eq("status", "published")
      .single()

    if (error) throw error
    const course = data as CourseWithCurriculum
    course.course_sections = (course.course_sections ?? []).sort((a, b) => a.position - b.position).map(section => ({
      ...section, lessons: (section.lessons ?? []).filter(lesson => lesson.status === "published").sort((a, b) => a.position - b.position),
    }))
    return { ok: true as const, data: course }
  } catch (error) {
    return appError(error)
  }
}

export async function getEnrollmentPageData() {
  try {
    const supabase = createDatabaseAdminClient()
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

    if ((courses.data ?? []).length === 0) {
      return { ok: false as const, reason: "error" as const, message: "Add at least one published course before opening enrollment." }
    }

    if ((paymentMethods.data ?? []).length === 0) {
      return { ok: false as const, reason: "error" as const, message: "Add at least one active payment method before opening enrollment." }
    }

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
