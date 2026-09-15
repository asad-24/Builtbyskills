import "server-only"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { requireRole } from "@/lib/auth/session"
import { enrollmentIsActive } from "@/lib/permissions"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AppResult } from "@/types/lms"

function appError(error: unknown): AppResult<never> {
  if (error instanceof MissingEnvironmentError) {
    return { ok: false, reason: "missing_env", message: `Configure ${error.keys.join(", ")} to connect Supabase.` }
  }
  if (error instanceof AppAuthError) return { ok: false, reason: "unauthorized", message: error.message }
  if (error instanceof AppForbiddenError) return { ok: false, reason: "forbidden", message: error.message }
  return { ok: false, reason: "error", message: error instanceof Error ? error.message : "Unable to load dashboard." }
}

export async function getStudentDashboardData() {
  try {
    const profile = await requireRole(["student"])
    const supabase = createSupabaseAdminClient()
    const [enrollments, progress, payments] = await Promise.all([
      supabase
        .from("enrollments")
        .select("*, course:courses(*)")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase.from("lesson_progress").select("*").eq("student_id", profile.id),
      supabase.from("payment_submissions").select("*, course:courses(title)").eq("student_id", profile.id),
    ])

    const historyError = [enrollments, progress, payments].find((result) => result.error)
    if (historyError?.error) throw historyError.error

    // Service-role queries bypass RLS. Derive access from this student's own
    // enrollments using the same status/time-window rules as lesson access.
    const authorizedCourseIds = [...new Set(
      (enrollments.data ?? []).filter(enrollmentIsActive).map((enrollment) => enrollment.course_id as string)
    )]
    const announcementQuery = supabase
      .from("announcements")
      .select("*, course:courses(title)")
      .eq("is_published", true)
    const scopedAnnouncements = authorizedCourseIds.length
      ? announcementQuery.or(`course_id.is.null,course_id.in.(${authorizedCourseIds.join(",")})`)
      : announcementQuery.is("course_id", null)

    const [liveClasses, announcements, sections] = await Promise.all([
      authorizedCourseIds.length ? supabase
        .from("live_classes")
        .select("*, course:courses(title)")
        .in("course_id", authorizedCourseIds)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(10) : { data: [], error: null },
      scopedAnnouncements
        .order("published_at", { ascending: false })
        .limit(10),
      authorizedCourseIds.length ? supabase
        .from("course_sections")
        .select("*, lessons(*)")
        .in("course_id", authorizedCourseIds) : { data: [], error: null },
    ])

    const failed = [liveClasses, announcements, sections].find((result) => result.error)
    if (failed?.error) throw failed.error

    return {
      ok: true as const,
      data: {
        profile,
        enrollments: (enrollments.data ?? []).map((enrollment) => ({
          ...enrollment,
          course: enrollment.course ? {
            ...enrollment.course,
            course_sections: (sections.data ?? []).filter((section) => section.course_id === enrollment.course_id),
          } : null,
        })),
        progress: progress.data ?? [],
        liveClasses: liveClasses.data ?? [],
        announcements: announcements.data ?? [],
        payments: payments.data ?? [],
      },
    }
  } catch (error) {
    return appError(error)
  }
}
