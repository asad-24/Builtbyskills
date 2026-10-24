import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRole } from "@/lib/auth/session"
import { requireCourseAccess } from "@/lib/courses/portal-access"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { safeExternalUrl } from "@/lib/validations/course-builder"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"

export async function openStudentCourseLink(kind: "class" | "recording", id: string) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }
  try {
    await requireRole(["student"])
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "Link not found." }, { status: 404, headers })
    const supabase = await createSupabaseServerClient()
    const { data, error } = kind === "class"
      ? await supabase.from("live_classes").select("course_id,meeting_url,status").eq("id", id).in("status", ["scheduled", "live"]).maybeSingle()
      : await supabase.from("course_recordings").select("course_id,recording_url,is_published").eq("id", id).eq("is_published", true).maybeSingle()
    if (error || !data) throw new AppForbiddenError()
    await requireCourseAccess(data.course_id, "student")
    const url = safeExternalUrl(String("meeting_url" in data ? data.meeting_url : data.recording_url))
    if (!url) throw new AppForbiddenError()
    return new NextResponse(null, { status: 303, headers: { ...headers, Location: new URL(url).href } })
  } catch (error) {
    return NextResponse.json({ message: "This link is not available for your account." }, {
      status: error instanceof AppAuthError ? 401 : error instanceof AppForbiddenError ? 403 : 503, headers,
    })
  }
}
