import { z } from "zod"

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value

const dateTimeToIso = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

export const courseSchema = z.object({
  title: z.string().min(3),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  short_description: z.string().min(12),
  description: z.string().min(20),
  thumbnail_url: z.preprocess(emptyToUndefined, z.string().url().or(z.string().startsWith("/")).optional()),
  category: z.string().min(2),
  level: z.string().min(2),
  duration_text: z.preprocess(emptyToUndefined, z.string().optional()),
  price: z.coerce.number().min(0),
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
  mux_asset_id: z.preprocess(emptyToUndefined, z.string().optional()),
  mux_playback_id: z.preprocess(emptyToUndefined, z.string().optional()),
  duration_seconds: z.coerce.number().int().min(0).default(0),
  position: z.coerce.number().int().min(0),
  is_preview: z.coerce.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]),
})

export const studentSchema = z.object({
  full_name: z.string().min(3),
  email: z.string().email(),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  whatsapp: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
})

export const assignCourseSchema = z.object({
  student_id: z.string().uuid(),
  course_id: z.string().uuid(),
  starts_at: z.preprocess(dateTimeToIso, z.string().datetime().optional()),
  expires_at: z.preprocess(dateTimeToIso, z.string().datetime().optional()),
  status: z.enum(["pending", "active", "suspended", "completed", "expired", "cancelled"]).default("active"),
})

export const paymentMethodSchema = z.object({
  method_type: z.enum(["bank_transfer", "easypaisa", "jazzcash"]),
  display_name: z.string().min(3),
  account_title: z.string().min(3),
  account_number: z.string().min(3),
  bank_name: z.preprocess(emptyToUndefined, z.string().optional()),
  instructions: z.preprocess(emptyToUndefined, z.string().optional()),
  is_active: z.coerce.boolean().default(true),
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
  full_name: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(7),
  whatsapp: z.preprocess(emptyToUndefined, z.string().optional()),
  city: z.string().min(2),
  course_id: z.string().uuid(),
  preferred_batch: z.string().min(2),
  experience_level: z.string().min(2),
  message: z.preprocess(emptyToUndefined, z.string().optional()),
  payment_method_id: z.string().uuid(),
  amount: z.coerce.number().min(0),
  transaction_reference: z.preprocess(emptyToUndefined, z.string().optional()),
  screenshot_path: z.preprocess(emptyToUndefined, z.string().optional()),
})

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
