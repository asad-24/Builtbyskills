import { NextRequest, NextResponse } from "next/server"

import { requireRole } from "@/lib/auth/session"
import { createMuxPlaybackToken } from "@/lib/mux/server"
import { enrollmentIsActive } from "@/lib/permissions"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get("lessonId")
  if (!lessonId) return NextResponse.json({ error: "Missing lessonId." }, { status: 400 })

  const profile = await requireRole(["student"])
  const supabase = createSupabaseAdminClient()
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, mux_playback_id, section:course_sections(course_id)")
    .eq("id", lessonId)
    .single()

  if (lessonError || !lesson?.mux_playback_id) {
    return NextResponse.json({ error: "Lesson video is unavailable." }, { status: 404 })
  }

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

  return NextResponse.json({ token: createMuxPlaybackToken(lesson.mux_playback_id) })
}
