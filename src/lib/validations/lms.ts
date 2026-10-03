import { z } from "zod"

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value

const dateTimeToIso = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

export const courseSchema = z.object({
  title: z.string().trim().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  short_description: z.string().trim().min(1),
  description: z.string().trim().min(1),
  thumbnail_url: z.preprocess(emptyToUndefined, z.string().url().or(z.string().startsWith("/")).optional()),
  category: z.string().trim().default(""),
  level: z.string().trim().default(""),
  duration_text: z.preprocess(emptyToUndefined, z.string().optional()),
  price: z.preprocess(value => typeof value === "string" && !value.trim() ? NaN : value, z.coerce.number().min(0)),
  currency: z.string().min(3).max(3).default("PKR"),
  status: z.enum(["draft", "published", "unpublished", "archived"]),
  featured: z.coerce.boolean().default(false),
  instructor_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  outcomes: z.string().optional(),
  requirements: z.string().optional(),
})

export const sectionSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().min(3),
  description: z.preprocess(emptyToUndefined, z.string().optional()),
  position: z.coerce.number().int().min(0),
})

export const lessonSchema = z.object({
  section_id: z.string().uuid(),
  title: z.string().min(3),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  description: z.preprocess(emptyToUndefined, z.string().optional()),
  lesson_type: z.enum(["video", "text", "pdf_resource", "live_class", "external_resource"]),
  duration_seconds: z.coerce.number().int().min(0).default(0),
  position: z.coerce.number().int().min(0),
  is_preview: z.coerce.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]),
})

export const studentSchema = z.object({
  full_name: z.string().min(3),
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().email()
  ),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  whatsapp: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
})

export const updateStudentSchema = studentSchema.omit({ email: true }).extend({
  id: z.string().uuid(),
})

export const updateStudentStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "inactive"]),
})

export const deleteStudentSchema = z.object({
  id: z.string().uuid(),
})

export const instructorSchema = z.object({
  full_name: z.string().min(3),
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().email()
  ),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
})

export const assignCourseSchema = z.object({
  student_id: z.string().uuid(),
  course_id: z.string().uuid(),
  starts_at: z.preprocess(dateTimeToIso, z.string().datetime().optional()),
  expires_at: z.preprocess(dateTimeToIso, z.string().datetime().optional()),
  status: z.enum(["pending", "active", "suspended", "completed", "expired", "cancelled"]).default("active"),
})

const ibanMessage = "Enter only the IBAN value, starting with two country letters and two digits. Do not include the word IBAN. Spaces are allowed."

export const paymentMethodSchema = z.object({
  method_type: z.enum(["bank_transfer", "easypaisa", "jazzcash"], { error: "Choose Bank Transfer, EasyPaisa, or JazzCash." }),
  display_name: z.string().trim().min(3, "Display name must contain at least 3 characters."),
  account_title: z.string().trim().min(3, "Account title must contain at least 3 characters."),
  account_number: z.string().trim().min(3, "Account number must contain at least 3 characters."),
  iban_number: z.preprocess(
    (value) => typeof value === "string" ? value.replace(/\s/g, "").toUpperCase() || undefined : value,
    z.string({ error: ibanMessage }).min(15, ibanMessage).max(34, ibanMessage).regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/, ibanMessage).optional(),
  ),
  bank_name: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  instructions: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  is_active: z.preprocess(
    value => value === undefined ? false : value === "true" ? true : value === "false" ? false : value,
    z.boolean({ error: "Choose whether this method is available for enrollment." }),
  ),
})

export const paymentMethodIdentitySchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().min(1),
})

export const paymentMethodStatusSchema = paymentMethodIdentitySchema.extend({
  is_active: z.enum(["true", "false"]).transform(value => value === "true"),
})

export const paymentReviewSchema = z.object({
  payment_id: z.string().uuid(),
  status: z.enum(["under_review", "approved", "rejected", "refunded"]),
  rejection_reason: z.preprocess(emptyToUndefined, z.string().optional()),
})

export const liveClassSchema = z.object({
  course_id: z.string().uuid(),
  instructor_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  title: z.string().min(3),
  description: z.preprocess(emptyToUndefined, z.string().optional()),
  meeting_provider: z.enum(["zoom", "google_meet", "other"]),
  meeting_url: z.string().url(),
  starts_at: z.preprocess(dateTimeToIso, z.string().datetime()),
  ends_at: z.preprocess(dateTimeToIso, z.string().datetime().optional()),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).default("scheduled"),
})

export const announcementSchema = z.object({
  course_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  title: z.string().min(3),
  content: z.string().min(10),
  is_published: z.coerce.boolean().default(false),
})

export const enrollmentRequestSchema = z.object({
  full_name: z.string({ error: "Please enter your name." }).trim().min(1, "Please enter your name."),
  email: z.string({ error: "Please enter a valid email." }).trim().email("Please enter a valid email."),
  phone: z.string({ error: "Please enter your phone number." }).trim().min(1, "Please enter your phone number.").min(7, "Please enter a valid phone number."),
  whatsapp: z.preprocess(emptyToUndefined, z.string({ error: "Please enter a valid WhatsApp number." }).trim().min(7, "Please enter a valid WhatsApp number.").optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  course_id: z.string({ error: "Please select a course." }).uuid("Please select a course."),
  preferred_batch: z.preprocess(emptyToUndefined, z.string().optional()),
  experience_level: z.preprocess(emptyToUndefined, z.string().optional()),
  message: z.preprocess(emptyToUndefined, z.string().optional()),
  payment_method_id: z.string({ error: "Please select a payment method." }).uuid("Please select a payment method."),
  transaction_reference: z.preprocess(emptyToUndefined, z.string().optional()),
  screenshot_path: z.string({ error: "Please upload your payment screenshot." }).trim().min(1, "Please upload your payment screenshot."),
  screenshot_upload_status: z.preprocess(emptyToUndefined, z.enum(["none", "uploading", "failed", "uploaded"], { error: "Please upload your payment screenshot again." }).optional()),
}).refine(
  (data) => data.screenshot_upload_status === "uploaded" && Boolean(data.screenshot_path),
  { message: "Please finish uploading your payment screenshot before submitting.", path: ["screenshot_path"] }
)

export const contactSchema = z.object({
  full_name: z.string().min(3),
  email: z.string().email(),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  subject: z.preprocess(emptyToUndefined, z.string().optional()),
  message: z.string().min(10),
})

export function splitLines(value?: string) {
  return value
    ?.split("\n")
    .map((item) => item.trim())
    .filter(Boolean) ?? []
}
