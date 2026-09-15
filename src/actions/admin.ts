"use server"

import { revalidatePath } from "next/cache"

import { emailTemplates } from "@/emails/templates"
import { requireAdmin } from "@/lib/auth/session"
import { approvePayment } from "@/lib/payments/approve"
import { getOptionalServerEnv } from "@/lib/env"
import { sendTransactionalEmail } from "@/lib/email/send"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  announcementSchema,
  assignCourseSchema,
  courseSchema,
  instructorSchema,
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

async function findAuthUserByEmail(
  email: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ id: string } | null> {
  const baseUrl = supabaseUrl.replace(/\/$/, "")
  const perPage = 50
  let page = 1
  let lastPage = 1

  while (page <= lastPage) {
    const url = `${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    let response
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Auth lookup failed: ${response.status} ${text}`)
    }

    const json = await response.json()
    const users = Array.isArray(json) ? json : Array.isArray(json?.users) ? json.users : []
    const found = users.find((u: { email?: string }) => (u.email ?? "").toLowerCase() === email)
    if (found) {
      return { id: found.id }
    }

    const total = Number(response.headers.get("x-total-count") ?? "0")
    if (total > 0 && perPage > 0) {
      lastPage = Math.max(1, Math.ceil(total / perPage))
    }

    page++
  }

  return null
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

    const normalizedEmail = parsed.email.trim().toLowerCase()

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (profileError) return fail(profileError.message)

    if (existingProfile) {
      return fail("Student already registered")
    }

    let userId: string | null = null

    const createUserResult = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: { full_name: parsed.full_name, role: "student" },
    })

    if (createUserResult.error) {
      if (createUserResult.error.code === "email_exists") {
        const env = getOptionalServerEnv()

        if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
          return fail("Unable to verify existing auth user. Please try again.")
        }

        let existing: { id: string } | null = null
        try {
          existing = await findAuthUserByEmail(normalizedEmail, env.supabaseUrl, env.supabaseServiceRoleKey)
        } catch {
          return fail("Unable to verify existing auth user. Please try again.")
        }

        if (!existing) {
          return fail("User already exists but could not be found in Auth.")
        }

        userId = existing.id
      } else {
        return fail(createUserResult.error.message)
      }
    } else {
      userId = createUserResult.data.user.id
    }

    const { data: profileAfterAuth, error: profileAfterAuthError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (profileAfterAuthError) return fail(profileAfterAuthError.message)

    if (profileAfterAuth) {
      return fail("Student already registered")
    }

    const linkResult = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${env.siteUrl}/auth/callback` },
    })

    if (linkResult.error) return fail(linkResult.error.message)

    const inviteLink = linkResult.data.properties.action_link

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: userId,
          full_name: parsed.full_name,
          email: normalizedEmail,
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
    await audit("student.created", "profile", data.id, { email: normalizedEmail })
    const emailResult = await sendTransactionalEmail({
      to: normalizedEmail,
      subject: "Activate your Builtbyskills account",
      html: emailTemplates.accountActivation({ name: parsed.full_name, actionUrl: inviteLink }),
    })

    if (!emailResult.ok) {
      revalidatePath("/admin/students")
      return ok("Student account was created, but the activation email was not sent or delivery could not be confirmed. The student can use Forgot Password to set their password.")
    }

    revalidatePath("/admin/students")
    return ok("Student created and activation email queued.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Student creation failed.")
  }
}

export async function createInstructorAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = instructorSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const env = getOptionalServerEnv()

    const normalizedEmail = parsed.email.trim().toLowerCase()

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (profileError) return fail(profileError.message)

    if (existingProfile) {
      return fail("Instructor already registered")
    }

    let userId: string | null = null

    const createUserResult = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: { full_name: parsed.full_name, role: "instructor" },
    })

    if (createUserResult.error) {
      if (createUserResult.error.code === "email_exists") {
        const env = getOptionalServerEnv()

        if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
          return fail("Unable to verify existing auth user. Please try again.")
        }

        let existing: { id: string } | null = null
        try {
          existing = await findAuthUserByEmail(normalizedEmail, env.supabaseUrl, env.supabaseServiceRoleKey)
        } catch {
          return fail("Unable to verify existing auth user. Please try again.")
        }

        if (!existing) {
          return fail("User already exists but could not be found in Auth.")
        }

        userId = existing.id
      } else {
        return fail(createUserResult.error.message)
      }
    } else {
      userId = createUserResult.data.user.id
    }

    const { data: profileAfterAuth, error: profileAfterAuthError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (profileAfterAuthError) return fail(profileAfterAuthError.message)

    if (profileAfterAuth) {
      return fail("Instructor already registered")
    }

    const linkResult = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${env.siteUrl}/auth/callback` },
    })

    if (linkResult.error) return fail(linkResult.error.message)

    const inviteLink = linkResult.data.properties.action_link

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: userId,
          full_name: parsed.full_name,
          email: normalizedEmail,
          role: "instructor",
          status: parsed.status,
        },
        { onConflict: "email" }
      )
      .select("id")
      .single()

    if (error) return fail(error.message)
    await audit("instructor.created", "profile", data.id, { email: normalizedEmail })
    const emailResult = await sendTransactionalEmail({
      to: normalizedEmail,
      subject: "Activate your Builtbyskills account",
      html: emailTemplates.accountActivation({ name: parsed.full_name, actionUrl: inviteLink }),
    })

    if (!emailResult.ok) {
      revalidatePath("/admin/instructors")
      return ok("Instructor account was created, but the activation email was not sent or delivery could not be confirmed. The instructor can use Forgot Password to set their password.")
    }

    revalidatePath("/admin/instructors")
    return ok("Instructor created and activation email queued.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Instructor creation failed.")
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
    const parsedResult = paymentReviewSchema.safeParse(formObject(formData))
    if (!parsedResult.success) return fail("Choose a valid payment and review status.")
    const parsed = parsedResult.data
    const supabase = createSupabaseAdminClient()
    if (parsed.status === "approved") {
      const result = await approvePayment(supabase, parsed.payment_id, admin.id)
      revalidatePath("/admin/payments")
      revalidatePath("/admin/enrollments")
      revalidatePath("/admin/students")
      return result
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payment_submissions").select("id, status").eq("id", parsed.payment_id).single()
    if (paymentError || !payment) return fail("Payment not found.")
    if (payment.status === parsed.status) return ok("Payment already has this status.")
    // Keep existing review/refund operations, but never race an approval into a
    // rejected/under-review state or reopen a refunded payment.
    const allowed = parsed.status === "refunded"
      ? payment.status === "approved"
      : ["pending", "under_review", "rejected"].includes(payment.status)
    if (!allowed) return fail("Invalid payment status transition.")

    const request = await supabase.from("enrollment_requests").select("*")
      .eq("payment_submission_id", parsed.payment_id).maybeSingle()
    if (request.error) return fail("Unable to read the enrollment request.")
    const { data: updated, error } = await supabase.from("payment_submissions").update({
      status: parsed.status,
      rejection_reason: parsed.status === "rejected" ? parsed.rejection_reason ?? "Payment rejected." : null,
      reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    }).eq("id", parsed.payment_id).eq("status", payment.status).select("id").maybeSingle()
    if (error || !updated) return fail("Payment changed during review or could not be saved. Refresh and retry.")

    let warning = ""
    if (parsed.status === "rejected" && request.data) {
      // A delayed rejection must not overwrite a request activated by a later approval.
      const { error: requestError } = await supabase.from("enrollment_requests")
        .update({ status: "pending" }).eq("id", request.data.id).eq("status", "pending")
      if (requestError) warning = " Request status could not be updated."
      try {
        const email = await sendTransactionalEmail({
          to: request.data.email,
          subject: "Builtbyskills payment review update",
          html: emailTemplates.paymentRejected({ name: request.data.full_name, reason: parsed.rejection_reason }),
        })
        if (!email.ok) warning += " Review email could not be delivered."
      } catch { warning += " Review email could not be delivered." }
    }
    try {
      const { error: auditError } = await supabase.from("audit_logs").insert({
        actor_id: admin.id, action: "payment.reviewed", entity_type: "payment_submission",
        entity_id: parsed.payment_id, metadata: parsed,
      })
      if (auditError) warning += " Audit entry could not be saved."
    } catch { warning += " Audit entry could not be saved." }
    revalidatePath("/admin/payments")
    revalidatePath("/admin/enrollments")
    return ok("Payment review saved." + warning)
  } catch {
    return fail("Payment review failed. Confirm you are signed in as an active administrator and retry.")
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

export async function updateContactStatusAction(formData: FormData) {
  try {
    await requireAdmin()
    const id = String(formData.get("id"))
    const status = String(formData.get("status") ?? "").trim()
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase
      .from("contact_submissions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw new Error(error.message)
    await audit("contact.status_updated", "contact_submission", id, { status })
    revalidatePath("/admin/contact-submissions")
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Contact status update failed.")
  }
}
