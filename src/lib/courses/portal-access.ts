import "server-only"
import { requireRole } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AppForbiddenError } from "@/lib/errors"
import { enrollmentIsActive } from "@/lib/permissions"
import type { CourseWithCurriculum } from "@/types/lms"
import type { CourseRecording, PortalClass } from "@/lib/courses/portal-schema"

export async function requireCourseAccess(courseId: string, audience: "instructor" | "student" | "manager") {
  const profile = await requireRole(audience === "manager" ? ["instructor", "super_admin"] : [audience])
  const supabase = await createSupabaseServerClient()
  if (profile.role === "instructor") {
    const { data, error } = await supabase.from("instructor_courses").select("id")
      .eq("course_id", courseId).eq("instructor_id", profile.id).maybeSingle()
    if (error || !data) throw new AppForbiddenError("This course is not assigned to you.")
  } else if (profile.role === "student") {
    const { data, error } = await supabase.from("enrollments").select("status,starts_at,expires_at")
      .eq("course_id", courseId).eq("student_id", profile.id).maybeSingle()
    if (error || !data || !enrollmentIsActive(data)) throw new AppForbiddenError("You do not have active access to this course.")
  }
  const { data: course, error } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle()
  if (error || !course || (profile.role === "student" && course.status !== "published")) throw new AppForbiddenError("This course is not available.")
  return { profile, supabase, course: course as CourseWithCurriculum }
}

export async function getCourseWorkspace(courseId: string, audience: "instructor" | "student" | "manager") {
  const access = await requireCourseAccess(courseId, audience)
  const { supabase, course, profile } = access
  // Session-bound clients preserve RLS even if a teacher assignment or student
  // enrollment is revoked between the initial check and these queries.
  const student = profile.role === "student"
  const [classes, recordings, sections] = await Promise.all([
    supabase.from("live_classes").select(student ? "id,course_id,title,description,meeting_provider,starts_at,ends_at,status,updated_at" : "*").eq("course_id", courseId).order("starts_at"),
    supabase.from("course_recordings").select(student ? "id,course_id,title,description,created_at,updated_at,is_published" : "*").eq("course_id", courseId).order("created_at", { ascending: false }),
    supabase.from("course_sections").select("id,title,description,position,lessons(id,title,status,position)").eq("course_id", courseId).order("position"),
  ])
  if (classes.error || recordings.error || sections.error) throw new Error("Unable to load course content. Confirm the portal migration has been applied.")
  return { course, classes: classes.data as unknown as PortalClass[], recordings: recordings.data as unknown as CourseRecording[], sections: sections.data ?? [] }
}
