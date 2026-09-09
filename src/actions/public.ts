"use server"

import { revalidatePath } from "next/cache"

import { emailTemplates } from "@/emails/templates"
import { sendTransactionalEmail } from "@/lib/email/send"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { contactSchema, enrollmentRequestSchema } from "@/lib/validations/lms"

type ActionState = {
  ok: boolean
  message: string
}

const ok = (message: string): ActionState => ({ ok: true, message })
const fail = (message: string): ActionState => ({ ok: false, message })

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

export async function submitContactAction(_: ActionState | undefined, formData: FormData) {
  try {
    const parsed = contactSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from("contact_submissions").insert(parsed)
    if (error) return fail(error.message)
    revalidatePath("/admin/contact-submissions")
    return ok("Thanks. Your message has been received.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Contact submission failed.")
  }
}

export async function submitEnrollmentAction(_: ActionState | undefined, formData: FormData) {
  try {
    const parsed = enrollmentRequestSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data: payment, error: paymentError } = await supabase
      .from("payment_submissions")
      .insert({
        course_id: parsed.course_id,
        payment_method_id: parsed.payment_method_id,
        amount: parsed.amount,
        currency: "PKR",
        transaction_reference: parsed.transaction_reference ?? null,
        screenshot_path: parsed.screenshot_path ?? null,
        status: "pending",
      })
      .select("id")
      .single()

    if (paymentError) return fail(paymentError.message)

    const { data: course } = await supabase
      .from("courses")
      .select("title")
      .eq("id", parsed.course_id)
      .single()

    const { error } = await supabase.from("enrollment_requests").insert({
      payment_submission_id: payment.id,
      full_name: parsed.full_name,
      email: parsed.email,
      phone: parsed.phone,
      whatsapp: parsed.whatsapp ?? null,
      city: parsed.city,
      course_id: parsed.course_id,
      preferred_batch: parsed.preferred_batch,
      experience_level: parsed.experience_level,
      message: parsed.message ?? null,
      status: "pending",
    })

    if (error) return fail(error.message)

    await sendTransactionalEmail({
      to: parsed.email,
      subject: "Builtbyskills enrollment received",
      html: emailTemplates.enrollmentReceived({
        name: parsed.full_name,
        courseTitle: course?.title,
      }),
    })

    revalidatePath("/admin/enrollments")
    revalidatePath("/admin/payments")
    return ok("Enrollment submitted. Your payment is pending admin review.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Enrollment submission failed.")
  }
}
