import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { beginUpload, beginVideoSchema, cancelUpload, completeUpload, loadUpload, signPart } from "@/lib/r2/uploads"
import { requireVideoOrigin, videoError, videoJson, VideoRequestError } from "@/lib/r2/http"

export const runtime = "nodejs"
const identity = z.object({ lessonId: z.string().uuid(), uploadId: z.string().uuid() })
const requestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("begin"), lessonId: z.string().uuid(), input: beginVideoSchema }).strict(),
  z.object({ operation: z.literal("remove"), lessonId: z.string().uuid(), updatedAt: z.string().datetime({ offset: true }) }).strict(),
  identity.extend({ operation: z.literal("part"), partNumber: z.number().int().positive() }).strict(),
  identity.extend({ operation: z.enum(["complete", "cancel", "status"]) }).strict(),
  identity.extend({ operation: z.literal("attach"), updatedAt: z.string().datetime({ offset: true }) }).strict(),
])
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin()
    requireVideoOrigin(request)
    const raw = await request.json().catch(() => null)
    const requestBody = requestSchema.safeParse(raw)
    if (!requestBody.success) throw new VideoRequestError(400, "Choose a saved lesson and an MP4 video up to 1 GB. Refresh and retry.")
    const body = requestBody.data
    const db = createSupabaseAdminClient()
    if (body?.operation === "begin") {
      const parsed = beginVideoSchema.safeParse(body.input)
      if (!parsed.success) throw new VideoRequestError(400, "Choose an MP4 video up to 1 GB and save the lesson first.")
      if (body.lessonId !== parsed.data.lessonId) throw new VideoRequestError(400, "The upload lesson does not match.")
      return videoJson(await beginUpload(db, admin.id, parsed.data))
    }
    if (body?.operation === "remove") {
      const parsed = z.object({ lessonId: z.string().uuid(), updatedAt: z.string().datetime({ offset: true }) }).safeParse(body)
      if (!parsed.success) throw new VideoRequestError(400, "Save and refresh the lesson first.")
      const { error } = await db.rpc("remove_lesson_video", { target_lesson: parsed.data.lessonId, actor: admin.id, expected_version: parsed.data.updatedAt })
      if (error) throw new VideoRequestError(409, "This lesson changed. Refresh before removing the video.")
      revalidatePath("/admin/course-builder", "layout"); revalidatePath("/student", "layout")
      return videoJson({ ok: true })
    }
    const parsed = identity.safeParse(body)
    if (!parsed.success) throw new VideoRequestError(400, "Choose a saved video upload.")
    const { session, asset } = await loadUpload(db, parsed.data.uploadId, admin.id, parsed.data.lessonId)
    switch (body.operation) {
      case "part": {
        const part = z.number().int().positive().safeParse(body.partNumber)
        if (!part.success) throw new VideoRequestError(400, "Invalid video part.")
        return videoJson(await signPart(session, asset, part.data))
      }
      case "complete": return videoJson(await completeUpload(db, admin.id, session, asset))
      case "cancel": await cancelUpload(db, admin.id, session, asset); return videoJson({ ok: true })
      case "status": return videoJson({ state: asset.state, uploadState: session.state, name: asset.original_name, expired: Date.parse(session.expires_at) <= Date.now() })
      case "attach": {
        if (session.state !== "validating" || asset.state !== "ready" || asset.retired_at || asset.cleanup_after) throw new VideoRequestError(409, "This video is not Ready yet. Complete the upload first.")
        const version = z.string().datetime({ offset: true }).safeParse(body.updatedAt)
        if (!version.success) throw new VideoRequestError(400, "Refresh the lesson before attaching the video.")
        const { error } = await db.rpc("attach_lesson_video", { target_lesson: parsed.data.lessonId, target_asset: asset.id, actor: admin.id, expected_version: version.data })
        if (error) throw new VideoRequestError(409, "This lesson changed. Refresh before attaching the video.")
        revalidatePath("/admin/course-builder", "layout"); revalidatePath("/student", "layout")
        return videoJson({ ok: true })
      }
      default: throw new VideoRequestError(400, "Unsupported video action.")
    }
  } catch (error) { return videoError(error) }
}
