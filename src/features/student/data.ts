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
  return { ok: false, reason: "error", message: error instanceof Error ? error.message : "Unable to load dashboard." }
}

export async function getStudentDashboardData() {
  try {
    const profile = await requireRole(["student"])
    const supabase = createSupabaseAdminClient()
    const [enrollments, progress, liveClasses, announcements, payments] = await Promise.all([
      supabase
        .from("enrollments")
        .select("*, course:courses(*, course_sections(*, lessons(*)))")
        .eq("student_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase.from("lesson_progress").select("*").eq("student_id", profile.id),
      supabase
        .from("live_classes")
        .select("*, course:courses(title)")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(10),
      supabase
        .from("announcements")
        .select("*, course:courses(title)")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(10),
      supabase.from("payment_submissions").select("*, course:courses(title)").eq("student_id", profile.id),
    ])

    const failed = [enrollments, progress, liveClasses, announcements, payments].find((result) => result.error)
    if (failed?.error) throw failed.error

    return {
      ok: true as const,
      data: {
        profile,
        enrollments: enrollments.data ?? [],
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
