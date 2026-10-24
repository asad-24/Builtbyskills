"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function manageInstructorAssignmentAction(_: { ok: boolean; message: string } | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = z.object({ course_id: z.string().uuid(), instructor_id: z.string().uuid(), assigned: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, message: "Choose a course and instructor." }
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc("manage_course_instructor", {
      p_course_id: parsed.data.course_id, p_instructor_id: parsed.data.instructor_id, p_assigned: parsed.data.assigned === "true",
    })
    if (error) return { ok: false, message: "Unable to change assignment. Check that the instructor is active and refresh the page." }
    for (const path of ["/admin/instructors", "/admin/courses", "/instructor", "/instructor/courses", `/instructor/courses/${parsed.data.course_id}`]) revalidatePath(path)
    return { ok: true, message: parsed.data.assigned === "true" ? "Instructor assigned to this course." : "Instructor access removed from this course." }
  } catch { return { ok: false, message: "Only active administrators can manage instructor assignments." } }
}
