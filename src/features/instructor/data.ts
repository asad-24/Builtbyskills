import "server-only"

import { AppAuthError, AppForbiddenError, MissingEnvironmentError } from "@/lib/errors"
import { requireRole } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
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
    const supabase = await createSupabaseServerClient()
    const assigned = await supabase.from("instructor_courses")
      .select("*, course:courses(*, enrollments(*), course_sections(*, lessons(*)))").eq("instructor_id", profile.id)
    if (assigned.error) throw assigned.error
    const ids = (assigned.data ?? []).map(item => item.course_id as string)
    const [liveClasses, announcements] = await Promise.all([
      ids.length ? supabase.from("live_classes").select("*, course:courses(title)").in("course_id", ids).order("starts_at") : { data: [], error: null },
      ids.length ? supabase.from("announcements").select("*, course:courses(title)").in("course_id", ids).order("created_at", { ascending: false }) : { data: [], error: null },
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
