import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireRole } from "@/lib/auth/session"
import { enrollmentIsActive } from "@/lib/permissions"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const progressSchema = z.object({
  lessonId: z.string().uuid(),
  progressSeconds: z.number().int().min(0),
  completed: z.boolean().default(false),
})

export async function POST(request: NextRequest) {
  const body = progressSchema.parse(await request.json())
  const profile = await requireRole(["student"])
  const supabase = createSupabaseAdminClient()
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, duration_seconds, section:course_sections(course_id)")
    .eq("id", body.lessonId)
    .single()

  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 })

  const section = lesson.section as { course_id?: string } | { course_id?: string }[] | null
  const courseId = Array.isArray(section) ? section[0]?.course_id : section?.course_id
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("*")
    .eq("student_id", profile.id)
    .eq("course_id", courseId)
    .single()

  if (!enrollment || !enrollmentIsActive(enrollment)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const completionPercentage = body.completed
    ? 100
    : lesson.duration_seconds > 0
      ? Math.min(100, Math.round((body.progressSeconds / lesson.duration_seconds) * 100))
      : 0

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      student_id: profile.id,
      lesson_id: lesson.id,
      enrollment_id: enrollment.id,
      progress_seconds: body.progressSeconds,
      completion_percentage: completionPercentage,
      is_completed: body.completed,
      last_watched_at: new Date().toISOString(),
      completed_at: body.completed ? new Date().toISOString() : null,
    },
    { onConflict: "student_id,lesson_id" }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
