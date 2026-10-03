import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRole } from "@/lib/auth/session"
import { requireStudentLesson } from "@/lib/lessons/access"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { lessonHttpError, privateHeaders } from "@/lib/lessons/http"
import { safeExternalUrl } from "@/lib/validations/course-builder"

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  try {
    await requireRole(["student"])
    const { resourceId } = await params
    if (!z.string().uuid().safeParse(resourceId).success) return NextResponse.json({ error: "Resource unavailable." }, { status: 404 })
    const db = createSupabaseAdminClient()
    const { data: resource, error } = await db.from("lesson_resources").select("*").eq("id", resourceId).single()
    if (error || !resource) return NextResponse.json({ error: "Resource unavailable." }, { status: 404 })
    await requireStudentLesson(resource.lesson_id)
    if (resource.resource_type === "external_link") {
      const url = safeExternalUrl(resource.file_path)
      if (!url) return NextResponse.json({ error: "This link is unavailable." }, { status: 404 })
      return NextResponse.redirect(url, { status: 307, headers: privateHeaders })
    }
    const { data, error: signingError } = await db.storage.from("lesson-resources").createSignedUrl(resource.file_path, 60, { download: resource.title })
    if (signingError || !data?.signedUrl) throw new Error("Download unavailable")
    return NextResponse.redirect(data.signedUrl, { status: 307, headers: privateHeaders })
  } catch (error) { return lessonHttpError(error, "We could not open this resource. Please try again.") }
}
