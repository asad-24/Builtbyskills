import "server-only"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { requireRole } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { AppResult } from "@/types/lms"

function appError(error: unknown): AppResult<never> {
  if (error instanceof MissingEnvironmentError) {
    return { ok: false, reason: "missing_env", message: `Configure ${error.keys.join(", ")} to connect Supabase.` }
  }
  if (error instanceof AppAuthError) return { ok: false, reason: "unauthorized", message: error.message }
  if (error instanceof AppForbiddenError) return { ok: false, reason: "forbidden", message: error.message }
  return { ok: false, reason: "error", message: error instanceof Error ? error.message : "Unable to load instructor dashboard." }
}

export async function getInstructorDashboardData() {
  try {
    const profile = await requireRole(["instructor"])
    const supabase = createSupabaseAdminClient()
    const [assigned, liveClasses, announcements] = await Promise.all([
      supabase
        .from("instructor_courses")
        .select("*, course:courses(*, enrollments(*), course_sections(*, lessons(*)))")
        .eq("instructor_id", profile.id),
      supabase
        .from("live_classes")
        .select("*, course:courses(title)")
        .eq("instructor_id", profile.id)
        .order("starts_at"),
      supabase
        .from("announcements")
        .select("*, course:courses(title)")
        .eq("author_id", profile.id)
        .order("created_at", { ascending: false }),
    ])

    const failed = [assigned, liveClasses, announcements].find((result) => result.error)
    if (failed?.error) throw failed.error

    return {
      ok: true as const,
      data: {
        profile,
        assignedCourses: assigned.data ?? [],
        liveClasses: liveClasses.data ?? [],
        announcements: announcements.data ?? [],
      },
    }
  } catch (error) {
    return appError(error)
  }
}
