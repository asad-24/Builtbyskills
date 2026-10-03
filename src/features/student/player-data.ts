import "server-only"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"
import { requireStudentLesson } from "@/lib/lessons/access"
import type { AppResult, CourseWithCurriculum, LessonWithResources } from "@/types/lms"

export async function getStudentLessonData(lessonId: string) {
  try {
    const { profile, supabase, lesson, enrollment, courseId } = await requireStudentLesson(lessonId)
    const [courseResult, resources, progress] = await Promise.all([
      supabase.from("courses").select("*, course_sections(*, lessons(*))").eq("id", courseId).single(),
      supabase.from("lesson_resources").select("*").eq("lesson_id", lessonId).order("position"),
      supabase.from("lesson_progress").select("*").eq("student_id", profile.id).eq("lesson_id", lessonId).maybeSingle(),
    ])
    if (courseResult.error || !courseResult.data || resources.error || progress.error) throw new Error("Unable to load lesson")
    if (courseResult.data.status !== "published") throw new AppForbiddenError()
    const course = courseResult.data as CourseWithCurriculum
    course.course_sections = (course.course_sections ?? []).sort((a, b) => a.position - b.position).map(section => ({
      ...section, lessons: (section.lessons ?? []).filter(item => item.status === "published").sort((a, b) => a.position - b.position),
    }))
    return { ok: true as const, data: {
      profile, lesson: { ...lesson, lesson_resources: resources.data ?? [] } as LessonWithResources,
      course, enrollment, progress: progress.data,
    } }
  } catch (error) {
    const reason = error instanceof AppAuthError ? "unauthorized" : error instanceof AppForbiddenError ? "forbidden" : "error"
    return { ok: false, reason, message: reason === "error" ? "We could not load this lesson. Please try again." : "This lesson is not available for your account." } as AppResult<never>
  }
}
