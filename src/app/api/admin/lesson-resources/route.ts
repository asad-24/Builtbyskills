import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { lessonHttpError, privateHeaders } from "@/lib/lessons/http"
import { RESOURCE_TYPES, RESOURCE_MAX_SIZE } from "@/lib/lessons/resources"
import { safeExternalUrlSchema } from "@/lib/validations/course-builder"

const identity = z.object({ lessonId: z.string().uuid() })
const titleSchema = z.string().trim().min(1).max(200)
const uploadSchema = identity.extend({ contentType: z.enum(RESOURCE_TYPES as [string, ...string[]]), size: z.number().int().positive().max(RESOURCE_MAX_SIZE) })
const attachSchema = identity.extend({ path: z.string(), title: titleSchema })
const linkSchema = identity.extend({ title: titleSchema, url: safeExternalUrlSchema, resourceId: z.string().uuid().optional() })

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin()
    const payload = await request.json().catch(() => null)
    const parsed = identity.safeParse(payload)
    if (!parsed.success) return NextResponse.json({ error: "Choose a saved lesson first." }, { status: 400 })
    const db = createSupabaseAdminClient()
    const { data: lesson, error } = await db.from("lessons").select("id, section:course_sections(course_id)").eq("id", parsed.data.lessonId).single()
    if (error || !lesson) return NextResponse.json({ error: "This lesson is unavailable." }, { status: 404 })
    const bucket = db.storage.from("lesson-resources")
    if (payload.operation === "upload") {
      const upload = uploadSchema.safeParse(payload)
      if (!upload.success) return NextResponse.json({ error: "Choose a PDF, image, ZIP, or text file up to 25 MB." }, { status: 400 })
      const path = `${lesson.id}/${admin.id}/${crypto.randomUUID()}`
      const { data, error: uploadError } = await bucket.createSignedUploadUrl(path, { upsert: false })
      if (uploadError || !data) throw new Error("Upload unavailable")
      return NextResponse.json({ path, token: data.token }, { headers: privateHeaders })
    }
    if (payload.operation === "attach") {
      const attached = attachSchema.safeParse(payload)
      if (!attached.success) return NextResponse.json({ error: "Enter a resource title and upload a supported file." }, { status: 400 })
      const parts = attached.data.path.split("/")
      if (parts.length !== 3 || parts[0] !== lesson.id || parts[1] !== admin.id || !z.string().uuid().safeParse(parts[2]).success) return NextResponse.json({ error: "Upload this file again before attaching it." }, { status: 400 })
      // Verify storage metadata after upload. Browser claims alone cannot bind a file.
      const { data: info, error: infoError } = await bucket.info(attached.data.path)
      if (infoError || !info || !info.size || info.size > RESOURCE_MAX_SIZE || !RESOURCE_TYPES.includes(info.contentType ?? "")) return NextResponse.json({ error: "The upload is incomplete or unsupported. Please upload the file again." }, { status: 400 })
      const { error: saveError } = await db.from("lesson_resources").insert({ id: parts[2], lesson_id: lesson.id, title: attached.data.title, file_path: attached.data.path, resource_type: info.contentType, position: 0 })
      if (saveError && saveError.code !== "23505") throw new Error("Attachment unavailable")
      if (saveError) {
        const { data: existing, error: lookupError } = await db.from("lesson_resources").select("id")
          .eq("id", parts[2]).eq("lesson_id", lesson.id).eq("file_path", attached.data.path).maybeSingle()
        if (lookupError || !existing) throw new Error("Attachment unavailable")
      }
    } else if (payload.operation === "link") {
      const link = linkSchema.safeParse(payload)
      if (!link.success) return NextResponse.json({ error: "Enter a title and a complete http:// or https:// link without a username or password." }, { status: 400 })
      const values = { title: link.data.title, file_path: link.data.url, resource_type: "external_link" }
      if (link.data.resourceId) {
        const { data, error: saveError } = await db.from("lesson_resources").update(values).eq("id", link.data.resourceId).eq("lesson_id", lesson.id).eq("resource_type", "external_link").select("id").maybeSingle()
        if (saveError || !data) throw new Error("Link unavailable")
      } else {
        const { error: saveError } = await db.from("lesson_resources").insert({ ...values, lesson_id: lesson.id, position: 0 })
        if (saveError) throw new Error("Link unavailable")
      }
    } else return NextResponse.json({ error: "Choose a supported resource action." }, { status: 400 })
    const section = Array.isArray(lesson.section) ? lesson.section[0] : lesson.section
    if (section?.course_id) revalidatePath(`/admin/course-builder/${section.course_id}`)
    return NextResponse.json({ ok: true }, { headers: privateHeaders })
  } catch (error) { return lessonHttpError(error, "We could not attach your resource. Please try again.") }
}
