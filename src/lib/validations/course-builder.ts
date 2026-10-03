import { z } from "zod"

const optionalText = z.preprocess(value => typeof value === "string" && !value.trim() ? undefined : value, z.string().trim().optional())
export const lessonEditorSchema = z.object({
  section_id: z.string().uuid(),
  title: z.string().trim().min(3, "Enter a lesson title with at least 3 characters.").max(200, "Keep the title under 200 characters."),
  description: optionalText,
  lesson_type: z.enum(["video", "text", "pdf_resource", "live_class", "external_resource"]),
  status: z.enum(["draft", "published", "archived"]),
})
export const sectionEditorSchema = z.object({
  course_id: z.string().uuid(),
  title: z.string().trim().min(3, "Enter a section title with at least 3 characters."),
  description: optionalText,
})
export const lessonEditIdentitySchema = z.object({ id: z.string().uuid(), updated_at: z.string().min(1) })
export const safeExternalUrlSchema = z.string().trim().url().refine(value => {
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}, "Enter a complete http:// or https:// link without a username or password.")

export function safeExternalUrl(value: string) {
  const result = safeExternalUrlSchema.safeParse(value)
  return result.success ? result.data : null
}
