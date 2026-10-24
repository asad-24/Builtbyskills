import { z } from "zod"
import { safeExternalUrlSchema } from "@/lib/validations/course-builder"
import { liveClassSchema } from "@/lib/validations/lms"

const optional = (value: unknown) => typeof value === "string" && !value.trim() ? undefined : value
const classTime = z.preprocess(value => {
  if (typeof value !== "string" || !value.trim()) return undefined
  const date = new Date(`${value}+05:00`)
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value) && !Number.isNaN(date.getTime()) ? date.toISOString() : value
}, z.string().datetime({ offset: true }))
const identity = { id: z.preprocess(optional, z.string().uuid().optional()), updated_at: z.preprocess(optional, z.string().datetime({ offset: true }).optional()) }
export const classEditorSchema = liveClassSchema.omit({ instructor_id: true }).extend({
  ...identity,
  title: z.string().trim().min(3).max(200),
  meeting_url: safeExternalUrlSchema,
  starts_at: classTime,
  ends_at: z.preprocess(optional, classTime.optional()),
}).refine(value => !value.ends_at || Date.parse(value.ends_at) > Date.parse(value.starts_at), "The end time must be after the start time.")
  .refine(value => !value.id || Boolean(value.updated_at), "Refresh the class before editing it.")
export const recordingEditorSchema = z.object({
  ...identity,
  course_id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  recording_url: safeExternalUrlSchema,
  is_published: z.enum(["true", "false"]).transform(value => value === "true"),
}).refine(value => !value.id || Boolean(value.updated_at), "Refresh the recording before editing it.")
export type PortalClass = {
  id: string; course_id: string; instructor_id: string | null; title: string; description: string | null
  meeting_provider: "zoom" | "google_meet" | "other"; meeting_url: string; starts_at: string; ends_at: string | null
  status: "scheduled" | "live" | "completed" | "cancelled"; updated_at: string
}
export type CourseRecording = {
  id: string; course_id: string; author_id: string | null; title: string; description: string | null
  recording_url: string; is_published: boolean; updated_at: string; created_at: string
}
