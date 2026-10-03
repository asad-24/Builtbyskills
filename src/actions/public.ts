"use server"

import { revalidatePath } from "next/cache"

import { emailTemplates } from "@/emails/templates"
import { sendTransactionalEmail } from "@/lib/email/send"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { contactSchema, enrollmentRequestSchema } from "@/lib/validations/lms"

type ActionState = {
  ok: boolean
  message: string
  fieldErrors?: Record<string, string>
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
    const validation = enrollmentRequestSchema.safeParse(formObject(formData))
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of validation.error.issues) {
        const field = issue.path[0] === "screenshot_upload_status" ? "screenshot_path" : String(issue.path[0])
        fieldErrors[field] ??= issue.message
      }
      return { ok: false, message: "Please check the highlighted fields.", fieldErrors }
    }
    const parsed = validation.data
    const supabase = createSupabaseAdminClient()
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("title, price, currency")
      .eq("id", parsed.course_id)
      .eq("status", "published")
      .single()

    if (courseError || !course) return fail("Selected course is unavailable. Please select a published course.")

    const { data: method, error: methodError } = await supabase.from("payment_methods")
      .select("id").eq("id", parsed.payment_method_id).eq("is_active", true).maybeSingle()
    if (methodError || !method) return fail("This payment method is no longer available. Refresh the page and select another method.")

    // The submitted upload status is only a UX hint. Confirm the object exists
    // in private Storage before creating any payment/enrollment records.
    const { data: screenshot, error: screenshotError } = await supabase.storage
      .from("payment-screenshots").info(parsed.screenshot_path)
    if (screenshotError || !screenshot) return {
      ok: false, message: "Please upload your payment screenshot.",
      fieldErrors: { screenshot_path: "Please upload your payment screenshot." },
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payment_submissions")
      .insert({
        course_id: parsed.course_id,
        payment_method_id: parsed.payment_method_id,
        amount: course.price,
        currency: course.currency,
        transaction_reference: parsed.transaction_reference ?? null,
        screenshot_path: parsed.screenshot_path ?? null,
        status: "pending",
      })
      .select("id")
      .single()

    if (paymentError || !payment) return fail("Could not save your payment. Please try again.")

    const { error } = await supabase.from("enrollment_requests").insert({
      payment_submission_id: payment.id,
      full_name: parsed.full_name,
      email: parsed.email,
      phone: parsed.phone,
      whatsapp: parsed.whatsapp ?? null,
      city: parsed.city ?? "",
      course_id: parsed.course_id,
      // Keep legacy NOT NULL columns compatible without requiring these form fields.
      preferred_batch: parsed.preferred_batch ?? "",
      experience_level: parsed.experience_level ?? "",
      message: parsed.message ?? null,
      status: "pending",
    })

    if (error) return fail("Could not save your enrollment. Please try again.")

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
  } catch {
    return fail("Could not submit your enrollment. Please try again.")
  }
}
