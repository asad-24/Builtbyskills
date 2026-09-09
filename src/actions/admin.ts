"use server"

import { revalidatePath } from "next/cache"

import { emailTemplates } from "@/emails/templates"
import { requireAdmin } from "@/lib/auth/session"
import { getOptionalServerEnv } from "@/lib/env"
import { sendTransactionalEmail } from "@/lib/email/send"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  announcementSchema,
  assignCourseSchema,
  courseSchema,
  lessonSchema,
  liveClassSchema,
  paymentMethodSchema,
  paymentReviewSchema,
  sectionSchema,
  splitLines,
  studentSchema,
} from "@/lib/validations/lms"

type ActionState = {
  ok: boolean
  message: string
}

const ok = (message: string): ActionState => ({ ok: true, message })
const fail = (message: string): ActionState => ({ ok: false, message })

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

async function audit(action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  const actor = await requireAdmin()
  const supabase = createSupabaseAdminClient()
  await supabase.from("audit_logs").insert({
    actor_id: actor.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  })
}

export async function createCourseAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = courseSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("courses")
      .insert({
        ...parsed,
        thumbnail_url: parsed.thumbnail_url ?? null,
        duration_text: parsed.duration_text ?? null,
        instructor_id: parsed.instructor_id ?? null,
        outcomes: splitLines(parsed.outcomes),
        requirements: splitLines(parsed.requirements),
      })
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("course.created", "course", data.id, { title: parsed.title })
    revalidatePath("/admin/courses")
    return ok("Course created.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Course creation failed.")
  }
}

export async function updateCourseAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const id = String(formData.get("id"))
    const parsed = courseSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase
      .from("courses")
      .update({
        ...parsed,
        thumbnail_url: parsed.thumbnail_url ?? null,
        duration_text: parsed.duration_text ?? null,
        instructor_id: parsed.instructor_id ?? null,
        outcomes: splitLines(parsed.outcomes),
        requirements: splitLines(parsed.requirements),
      })
      .eq("id", id)

    if (error) return fail(error.message)
    await audit("course.updated", "course", id, { title: parsed.title, status: parsed.status })
    revalidatePath("/admin/courses")
    revalidatePath(`/admin/course-builder/${id}`)
    return ok("Course updated.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Course update failed.")
  }
}

export async function deleteCourseAction(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get("id"))
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("courses").delete().eq("id", id)
  if (error) throw new Error(error.message)
  await audit("course.deleted", "course", id)
  revalidatePath("/admin/courses")
}

export async function createSectionAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = sectionSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("course_sections")
      .insert({ ...parsed, description: parsed.description ?? null })
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("section.created", "course_section", data.id, { course_id: parsed.course_id })
    revalidatePath(`/admin/course-builder/${parsed.course_id}`)
    return ok("Section created.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Section creation failed.")
  }
}

export async function createLessonAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = lessonSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        ...parsed,
        description: parsed.description ?? null,
        mux_asset_id: parsed.mux_asset_id ?? null,
        mux_playback_id: parsed.mux_playback_id ?? null,
      })
      .select("id, course_sections(course_id)")
      .single()

    if (error) return fail(error.message)
    await audit("lesson.created", "lesson", data.id, { section_id: parsed.section_id })
    const courseSection = data.course_sections as { course_id?: string } | { course_id?: string }[] | null
    const courseId = Array.isArray(courseSection)
      ? courseSection[0]?.course_id
      : courseSection?.course_id
    if (courseId) revalidatePath(`/admin/course-builder/${courseId}`)
    return ok("Lesson created.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Lesson creation failed.")
  }
}

export async function createStudentAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = studentSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const env = getOptionalServerEnv()
    const invite = await supabase.auth.admin.inviteUserByEmail(parsed.email, {
      data: { full_name: parsed.full_name, role: "student" },
      redirectTo: `${env.siteUrl}/forgot-password`,
    })

    if (invite.error && !invite.error.message.toLowerCase().includes("already")) {
      return fail(invite.error.message)
    }

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: invite.data.user?.id ?? null,
          full_name: parsed.full_name,
          email: parsed.email,
          phone: parsed.phone ?? null,
          whatsapp: parsed.whatsapp ?? null,
          role: "student",
          status: parsed.status,
        },
        { onConflict: "email" }
      )
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("student.created", "profile", data.id, { email: parsed.email })
    await sendTransactionalEmail({
      to: parsed.email,
      subject: "Activate your Builtbyskills account",
      html: emailTemplates.accountActivation({ name: parsed.full_name, actionUrl: `${env.siteUrl}/forgot-password` }),
    })
    revalidatePath("/admin/students")
    return ok("Student created and activation email queued.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Student creation failed.")
  }
}

export async function assignCourseAction(_: ActionState | undefined, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const parsed = assignCourseSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("enrollments")
      .upsert(
        {
          ...parsed,
          assigned_by: admin.id,
          enrolled_at: parsed.status === "active" ? new Date().toISOString() : null,
          starts_at: parsed.starts_at ?? null,
          expires_at: parsed.expires_at ?? null,
        },
        { onConflict: "student_id,course_id" }
      )
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("enrollment.assigned", "enrollment", data.id, parsed)
    revalidatePath("/admin/students")
    revalidatePath("/admin/enrollments")
    return ok("Course assignment saved.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Course assignment failed.")
  }
}

export async function createPaymentMethodAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = paymentMethodSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ ...parsed, bank_name: parsed.bank_name ?? null, instructions: parsed.instructions ?? null })
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("payment_method.created", "payment_method", data.id, { display_name: parsed.display_name })
    revalidatePath("/admin/payment-settings")
    return ok("Payment method created.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Payment method creation failed.")
  }
}

export async function reviewPaymentAction(_: ActionState | undefined, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const parsed = paymentReviewSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data: payment, error: paymentError } = await supabase
      .from("payment_submissions")
      .select("*, courses(title), profiles(full_name,email)")
      .eq("id", parsed.payment_id)
      .single()

    if (paymentError || !payment) return fail(paymentError?.message ?? "Payment not found.")
    const { error } = await supabase
      .from("payment_submissions")
      .update({
        status: parsed.status,
        rejection_reason: parsed.status === "rejected" ? parsed.rejection_reason ?? "Payment rejected." : null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", parsed.payment_id)

    if (error) return fail(error.message)

    const request = await supabase
      .from("enrollment_requests")
      .select("*")
      .eq("payment_submission_id", parsed.payment_id)
      .maybeSingle()

    if (parsed.status === "approved" && request.data) {
      const { data: profile } = await supabase
        .from("profiles")
        .upsert(
          {
            full_name: request.data.full_name,
            email: request.data.email,
            phone: request.data.phone,
            whatsapp: request.data.whatsapp,
            role: "student",
            status: "active",
          },
          { onConflict: "email" }
        )
        .select("id")
        .single()

      if (profile) {
        await supabase.from("enrollments").upsert(
          {
            student_id: profile.id,
            course_id: request.data.course_id,
            status: "active",
            enrolled_at: new Date().toISOString(),
            starts_at: new Date().toISOString(),
            assigned_by: admin.id,
          },
          { onConflict: "student_id,course_id" }
        )
        await supabase
          .from("enrollment_requests")
          .update({ status: "active" })
          .eq("id", request.data.id)
      }
    }

    if (parsed.status === "rejected" && request.data) {
      await supabase
        .from("enrollment_requests")
        .update({ status: "pending" })
        .eq("id", request.data.id)
      await sendTransactionalEmail({
        to: request.data.email,
        subject: "Builtbyskills payment review update",
        html: emailTemplates.paymentRejected({ name: request.data.full_name, reason: parsed.rejection_reason }),
      })
    }

    await audit("payment.reviewed", "payment_submission", parsed.payment_id, parsed)
    revalidatePath("/admin/payments")
    revalidatePath("/admin/enrollments")
    return ok("Payment review saved.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Payment review failed.")
  }
}

export async function createLiveClassAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = liveClassSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("live_classes")
      .insert({
        ...parsed,
        instructor_id: parsed.instructor_id ?? null,
        description: parsed.description ?? null,
        ends_at: parsed.ends_at ?? null,
      })
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("live_class.created", "live_class", data.id, { title: parsed.title })
    revalidatePath("/admin/live-classes")
    return ok("Live class created.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Live class creation failed.")
  }
}

export async function createAnnouncementAction(_: ActionState | undefined, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const parsed = announcementSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        ...parsed,
        course_id: parsed.course_id ?? null,
        author_id: admin.id,
        published_at: parsed.is_published ? new Date().toISOString() : null,
      })
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("announcement.created", "announcement", data.id, { title: parsed.title })
    revalidatePath("/admin/announcements")
    return ok("Announcement created.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Announcement creation failed.")
  }
}
