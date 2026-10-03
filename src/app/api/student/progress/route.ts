import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireStudentLesson } from "@/lib/lessons/access"
import { lessonHttpError, privateHeaders } from "@/lib/lessons/http"
import { isYouTubeVideoId } from "@/lib/lessons/youtube"

const progressSchema = z.object({
  lessonId: z.string().uuid(),
  progressSeconds: z.number().int().min(0),
  completed: z.boolean().default(false),
  // Client-reported like playback position; never used for authorization.
  durationSeconds: z.number().int().min(1).max(86400).optional(),
})

export async function POST(request: NextRequest) {
  const parsed = progressSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "We could not save progress. Refresh and try again." }, { status: 400 })
  try {
    const body = parsed.data
    const { profile, supabase, lesson, enrollment } = await requireStudentLesson(body.lessonId)
    const { data: existing, error: progressError } = await supabase.from("lesson_progress")
      .select("is_completed, completed_at").eq("student_id", profile.id).eq("lesson_id", lesson.id).maybeSingle()
    if (progressError) return NextResponse.json({ error: "We could not save progress. Please try again." }, { status: 500, headers: privateHeaders })
    const completed = body.completed || !!existing?.is_completed
    const duration = !lesson.video_asset_id && lesson.lesson_type === "video" && isYouTubeVideoId(lesson.youtube_video_id)
      ? body.durationSeconds ?? lesson.duration_seconds : lesson.duration_seconds
    const completionPercentage = completed
      ? 100
      : duration > 0
        ? Math.min(100, Math.round((body.progressSeconds / duration) * 100))
        : 0

    const { error } = await supabase.from("lesson_progress").upsert(
      {
        student_id: profile.id,
        lesson_id: lesson.id,
        enrollment_id: enrollment.id,
        progress_seconds: body.progressSeconds,
        completion_percentage: completionPercentage,
        is_completed: completed,
        last_watched_at: new Date().toISOString(),
        completed_at: completed ? existing?.completed_at ?? new Date().toISOString() : null,
      },
      { onConflict: "student_id,lesson_id" }
    )

    if (error) return NextResponse.json({ error: "We could not save progress. Please try again." }, { status: 500 })
    return NextResponse.json({ ok: true }, { headers: privateHeaders })
  } catch (error) { return lessonHttpError(error, "We could not save progress. Please try again.") }
}
