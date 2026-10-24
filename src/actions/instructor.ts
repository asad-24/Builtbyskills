"use server"

import { revalidatePath } from "next/cache"
import { requireCourseAccess } from "@/lib/courses/portal-access"
import { classEditorSchema, recordingEditorSchema } from "@/lib/courses/portal-schema"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"

type State = { ok: boolean; message: string }
function refresh(courseId: string) {
  for (const path of ["/instructor", "/instructor/courses", `/instructor/courses/${courseId}`, "/instructor/live-classes", "/admin/live-classes", `/admin/course-links/${courseId}`, "/student", "/student/live-classes", "/student/courses", `/student/courses/${courseId}`]) revalidatePath(path)
}
function failure(error: unknown): State {
  return { ok: false, message: error instanceof AppAuthError || error instanceof AppForbiddenError ? "You do not have permission to manage this course." : "Unable to save. Refresh the page and try again." }
}

export async function saveInstructorClassAction(_: State | undefined, formData: FormData): Promise<State> {
  try {
    const parsed = classEditorSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
    const { id, updated_at, ...values } = parsed.data
    const { supabase, profile } = await requireCourseAccess(values.course_id, "manager")
    const payload = { ...values, description: values.description ?? null, ends_at: values.ends_at ?? null }
    const query = id
      ? supabase.from("live_classes").update(payload).eq("id", id).eq("course_id", values.course_id).eq("updated_at", updated_at!)
      : supabase.from("live_classes").insert({ ...payload, instructor_id: profile.role === "instructor" ? profile.id : null })
    const { data, error } = await query.select("id").maybeSingle()
    if (error || !data) return { ok: false, message: "The class changed or access was revoked. Refresh before trying again." }
    refresh(values.course_id)
    return { ok: true, message: "Class saved. Students with active enrollment can see the updated link after refreshing." }
  } catch (error) { return failure(error) }
}

export async function saveInstructorRecordingAction(_: State | undefined, formData: FormData): Promise<State> {
  try {
    const parsed = recordingEditorSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
    const { id, updated_at, ...values } = parsed.data
    const { supabase, profile } = await requireCourseAccess(values.course_id, "manager")
    const query = id
      ? supabase.from("course_recordings").update(values).eq("id", id).eq("course_id", values.course_id).eq("updated_at", updated_at!)
      : supabase.from("course_recordings").insert({ ...values, author_id: profile.id })
    const { data, error } = await query.select("id").maybeSingle()
    if (error || !data) return { ok: false, message: "The recording changed or access was revoked. Refresh before trying again." }
    refresh(values.course_id)
    return { ok: true, message: values.is_published ? "Recording published to enrolled students." : "Recording saved as a draft." }
  } catch (error) { return failure(error) }
}
