import "server-only"
import { requireRole } from "@/lib/auth/session"
import { AppForbiddenError } from "@/lib/errors"
import { enrollmentIsActive } from "@/lib/permissions"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Service-role callers must enforce the same published + enrollment rules as RLS.
export async function requireStudentLesson(lessonId: string) {
  const profile = await requireRole(["student"])
  const supabase = createSupabaseAdminClient()
  const { data: lesson, error } = await supabase.from("lessons")
    .select("*, section:course_sections(course_id)").eq("id", lessonId).eq("status", "published").single()
  if (error || !lesson || lesson.status !== "published") throw new AppForbiddenError("This lesson is not available for your account.")
  const section = Array.isArray(lesson.section) ? lesson.section[0] : lesson.section
  if (!section?.course_id) throw new AppForbiddenError()
  const { data: course, error: courseError } = await supabase.from("courses")
    .select("id, status").eq("id", section.course_id).eq("status", "published").single()
  if (courseError || !course || course.status !== "published") throw new AppForbiddenError("This course is not available for your account.")
  const { data: enrollment, error: enrollmentError } = await supabase.from("enrollments")
    .select("*").eq("student_id", profile.id).eq("course_id", section.course_id).single()
  if (enrollmentError || !enrollment || !enrollmentIsActive(enrollment)) throw new AppForbiddenError("This lesson is not available for your account.")
  return { profile, supabase, lesson, enrollment, courseId: section.course_id as string }
}
