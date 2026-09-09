import "server-only"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { requireRole } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { enrollmentIsActive } from "@/lib/permissions"
import type { AppResult } from "@/types/lms"

function appError(error: unknown): AppResult<never> {
  if (error instanceof MissingEnvironmentError) {
    return { ok: false, reason: "missing_env", message: `Configure ${error.keys.join(", ")} to connect Supabase.` }
  }
  if (error instanceof AppAuthError) return { ok: false, reason: "unauthorized", message: error.message }
  if (error instanceof AppForbiddenError) return { ok: false, reason: "forbidden", message: error.message }
  return { ok: false, reason: "error", message: error instanceof Error ? error.message : "Unable to load lesson." }
}

export async function getStudentLessonData(lessonId: string) {
  try {
    const profile = await requireRole(["student"])
    const supabase = createSupabaseAdminClient()
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("*, lesson_resources(*), section:course_sections(*, course:courses(*, course_sections(*, lessons(*))))")
      .eq("id", lessonId)
      .single()

    if (lessonError || !lesson) throw lessonError ?? new Error("Lesson not found.")

    const courseId = lesson.section?.course_id
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("*")
      .eq("student_id", profile.id)
      .eq("course_id", courseId)
      .single()

    if (enrollmentError || !enrollment || !enrollmentIsActive(enrollment)) {
      throw new AppForbiddenError("This lesson is not available for your account.")
    }

    const { data: progress } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("student_id", profile.id)
      .eq("lesson_id", lesson.id)
      .maybeSingle()

    return {
      ok: true as const,
      data: {
        profile,
        lesson,
        course: lesson.section.course,
        enrollment,
        progress,
      },
    }
  } catch (error) {
    return appError(error)
  }
}
