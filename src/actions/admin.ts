"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"

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
  deleteStudentSchema,
  instructorSchema,
  liveClassSchema,
  paymentMethodSchema,
  paymentMethodIdentitySchema,
  paymentMethodStatusSchema,
  paymentReviewSchema,
  splitLines,
  studentSchema,
  updateStudentStatusSchema,
  updateStudentSchema,
} from "@/lib/validations/lms"

import { lessonEditorSchema, sectionEditorSchema, lessonEditIdentitySchema, safeExternalUrlSchema } from "@/lib/validations/course-builder"
import { parseYouTubeUrl, isYouTubeVideoId } from "@/lib/lessons/youtube"
import { appendPosition } from "@/lib/lessons/ordering"

type ActionState = {
  ok: boolean
  message: string
  nextHref?: string
}

const ok = (message: string): ActionState => ({ ok: true, message })
const fail = (message: string): ActionState => ({ ok: false, message })

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

function courseValidationMessage(issues: ReadonlyArray<{ path: PropertyKey[] }>) {
  const messages: Record<string, string> = {
    title: "Course name is required.",
    slug: "Course address must use lowercase letters, numbers, and single hyphens between words.",
    short_description: "Brief summary is required.",
    description: "About this course is required.",
    thumbnail_url: "Thumbnail must be an uploaded image, a valid image link, or a site image path.",
    category: "Enter a category, or leave it blank.",
    level: "Enter who this course is for, or leave it blank.",
    duration_text: "Duration must be text, or left blank.",
    price: "Price must be a number greater than or equal to zero.",
    currency: "Currency must be a 3-letter code, such as PKR.",
    status: "Status must be draft, published, unpublished, or archived.",
    instructor_id: "Instructor must be selected from the list, or left as No instructor.",
    featured: "Choose whether this is a featured course.",
    outcomes: "Enter what students will learn as text.",
    requirements: "Enter requirements as text, one per line.",
  }
  return [...new Set(issues.map(issue => messages[String(issue.path[0])] ?? "Check the course details and try again."))].join(" ")
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
    const raw = formObject(formData)
    // Truncation can land on a separator, so strip edge hyphens afterwards.
    const base = String(raw.title ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-/, "").slice(0, 80).replace(/-$/, "") || "course"
    const result = courseSchema.safeParse({ ...raw, status: raw.status ?? "draft", slug: raw.slug || `${base}-${crypto.randomUUID().slice(0, 8)}`, featured: formData.get("featured") === "true" })
    if (!result.success) return fail(courseValidationMessage(result.error.issues))
    const parsed = result.data
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

    if (error) return builderFailure(error)
    await audit("course.created", "course", data.id, { title: parsed.title })
    revalidatePath("/admin/courses")
    return { ...ok("Course created."), nextHref: `/admin/course-builder/${data.id}` }
  } catch (error) {
    return builderFailure(error)
  }
}

export async function updateCourseAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const identity = z.string().uuid().safeParse(formData.get("id"))
    if (!identity.success) return fail("This course could not be identified. Refresh the page and try again.")
    const id = identity.data
    // A missing control means no change. Only explicitly submitted fields are validated/written.
    const raw = formObject(formData)
    if (formData.has("featured")) raw.featured = formData.get("featured") === "true" ? "true" : ""
    const result = courseSchema.partial().safeParse(raw)
    if (!result.success) return fail(courseValidationMessage(result.error.issues))
    const parsed = result.data
    const changes = Object.fromEntries(Object.entries(parsed).filter(([key]) => formData.has(key)))
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase
      .from("courses")
      .update({
        ...changes,
        ...(formData.has("thumbnail_url") ? { thumbnail_url: parsed.thumbnail_url ?? null } : {}),
        ...(formData.has("duration_text") ? { duration_text: parsed.duration_text ?? null } : {}),
        ...(formData.has("instructor_id") ? { instructor_id: parsed.instructor_id ?? null } : {}),
        ...(formData.has("outcomes") ? { outcomes: splitLines(parsed.outcomes) } : {}),
        ...(formData.has("requirements") ? { requirements: splitLines(parsed.requirements) } : {}),
      })
      .eq("id", id)

    if (error) return builderFailure(error)
    await audit("course.updated", "course", id, { title: parsed.title, status: parsed.status })
    revalidatePath("/admin/courses")
    revalidatePath(`/admin/course-builder/${id}`)
    revalidatePath("/courses", "layout")
    revalidatePath("/enroll")
    return ok("Course updated.")
  } catch (error) {
    return builderFailure(error)
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

function builderFailure(error: unknown) {
  return fail(error instanceof AppAuthError || error instanceof AppForbiddenError
    ? "You do not have permission to manage course content."
    : "We could not save your changes. Please try again.")
}

export async function createCourseDraftAction(state: ActionState | undefined, formData: FormData) {
  formData.set("status", "draft")
  formData.delete("slug")
  return createCourseAction(state, formData)
}

export async function updateCoursePublicationAction(state: ActionState | undefined, formData: FormData) {
  const data = new FormData()
  const status = courseSchema.shape.status.safeParse(formData.get("status"))
  if (!status.success) return fail("Choose Publish, Unpublish, Save as draft, or Archive.")
  data.set("id", String(formData.get("id") ?? ""))
  data.set("status", status.data)
  return updateCourseAction(state, data)
}

function refreshBuilder(courseId?: string) {
  if (courseId) revalidatePath(`/admin/course-builder/${courseId}`)
  revalidatePath("/student", "layout")
  revalidatePath("/courses", "layout")
}

export async function createSectionAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const result = sectionEditorSchema.safeParse(formObject(formData))
    if (!result.success) return fail("Enter a section title with at least 3 characters and select a course.")
    const parsed = result.data
    const supabase = createSupabaseAdminClient()
    for (let attempt = 0; attempt < 4; attempt++) {
      const position = await appendPosition(supabase, "course_sections", "course_id", parsed.course_id)
      const { data, error } = await supabase.from("course_sections")
        .insert({ ...parsed, description: parsed.description ?? null, position }).select("id").single()
      if (error?.code === "23505") continue
      if (error || !data) return builderFailure(error)
      await audit("section.created", "course_section", data.id, { course_id: parsed.course_id })
      refreshBuilder(parsed.course_id)
      return ok("Section created.")
    }
    return fail("Another section was added at the same time. Please try again.")
  } catch (error) { return builderFailure(error) }
}

export async function updateSectionAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const identity = lessonEditIdentitySchema.safeParse(formObject(formData))
    const result = sectionEditorSchema.safeParse(formObject(formData))
    if (!identity.success || !result.success) return fail("Check the section title and refresh the page before saving.")
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.from("course_sections")
      .update({ title: result.data.title, description: result.data.description ?? null })
      .eq("id", identity.data.id).eq("course_id", result.data.course_id).eq("updated_at", identity.data.updated_at).select("id").maybeSingle()
    if (error) return builderFailure(error)
    if (!data) return fail("This section changed. Refresh the page before trying again.")
    await audit("section.updated", "course_section", data.id)
    refreshBuilder(result.data.course_id)
    return ok("Section saved.")
  } catch (error) { return builderFailure(error) }
}

export async function createLessonAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const result = lessonEditorSchema.safeParse(formObject(formData))
    if (!result.success) return fail("Enter a title with at least 3 characters and choose a section, content type, and visibility.")
    if (formData.get("mux_asset_id") || formData.get("mux_playback_id") || formData.get("video_asset_id") || formData.get("youtube_url")) return fail("Create a draft, then choose a private video from your device.")
    const parsed = result.data
    const video = parseYouTubeUrl(String(formData.get("youtube_url") ?? ""))
    if (parsed.lesson_type === "video" && String(formData.get("youtube_url") ?? "").trim() && !video) return fail("Enter a valid YouTube video link, such as youtube.com/watch?v=... or youtu.be/...")
    if (parsed.lesson_type === "video" && parsed.status === "published") return fail("Create as Draft, then upload and attach a Ready video before publishing.")
    if (parsed.status === "published" && [ "pdf_resource", "external_resource"].includes(parsed.lesson_type)) return fail("Save as Draft first, attach your content, then publish the lesson.")
    if (parsed.status === "published" && parsed.lesson_type === "text" && !parsed.description) return fail("Add lesson text before publishing.")
    const supabase = createSupabaseAdminClient()
    const slugBase = parsed.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "lesson"
    const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`
    for (let attempt = 0; attempt < 4; attempt++) {
      const position = await appendPosition(supabase, "lessons", "section_id", parsed.section_id)
      const { data, error } = await supabase.from("lessons").insert({
        ...parsed, description: parsed.description ?? null, slug, position,
        duration_seconds: 0, is_preview: false, youtube_video_id: parsed.lesson_type === "video" ? video?.videoId ?? null : null,
      }).select("id, course_sections(course_id)").single()
      if (error?.code === "23505") continue
      if (error || !data) return builderFailure(error)
      await audit("lesson.created", "lesson", data.id, { section_id: parsed.section_id })
      const section = Array.isArray(data.course_sections) ? data.course_sections[0] : data.course_sections
      refreshBuilder(section?.course_id)
      return ok("Lesson created.")
    }
    return fail("Another lesson was added at the same time. Please try again.")
  } catch (error) { return builderFailure(error) }
}

export async function updateLessonAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const identity = lessonEditIdentitySchema.safeParse(formObject(formData))
    const result = lessonEditorSchema.omit({ section_id: true }).safeParse(formObject(formData))
    if (!identity.success || !result.success) return fail("Check the title, content type, and visibility. Refresh the page if needed.")
    const supabase = createSupabaseAdminClient()
    const { data: lesson, error: loadError } = await supabase.from("lessons")
      .select("*, lesson_resources(*), section:course_sections(course_id)").eq("id", identity.data.id).single()
    if (loadError || !lesson) return fail("This lesson is unavailable. Refresh the page.")
    const parsed = result.data
    // Omitted input retains metadata; explicitly empty input removes the reference.
    const hasVideoInput = parsed.lesson_type === "video" && !lesson.video_asset_id && lesson.video_source !== "r2" && formData.has("youtube_url")
    const videoInput = String(formData.get("youtube_url") ?? "").trim()
    const video = parseYouTubeUrl(videoInput)
    if (hasVideoInput && videoInput && !video) return fail("Enter a valid YouTube video link, such as youtube.com/watch?v=... or youtu.be/...")
    const videoId = hasVideoInput ? video?.videoId ?? null : lesson.youtube_video_id ?? null
    if (parsed.status === "published") {
      if (parsed.lesson_type === "video") {
        if (lesson.video_asset_id) {
          const { data: asset, error: assetError } = await supabase.from("lesson_video_assets").select("id, state, retired_at, cleanup_after").eq("id", lesson.video_asset_id).eq("lesson_id", lesson.id).single()
          if (assetError || !asset || asset.state !== "ready" || asset.retired_at || asset.cleanup_after) return fail("Attach a Ready private video before publishing.")
        } else if (lesson.video_source === "r2" || !isYouTubeVideoId(videoId)) return fail("Attach a Ready private video before publishing. Existing YouTube video links are supported only during rollout.")
      }
      if (parsed.lesson_type === "text" && !parsed.description) return fail("Add lesson text before publishing.")
      if (parsed.lesson_type === "pdf_resource" && !(lesson.lesson_resources ?? []).some((resource: { resource_type: string }) => resource.resource_type !== "external_link")) return fail("Attach a file before publishing.")
      if (parsed.lesson_type === "external_resource" && !(lesson.lesson_resources ?? []).some((resource: { resource_type: string; file_path: string }) => resource.resource_type === "external_link" && safeExternalUrlSchema.safeParse(resource.file_path).success)) return fail("Add a valid external link before publishing.")
    }
    const { data, error } = await supabase.from("lessons")
      .update({ ...parsed, description: parsed.description ?? null, ...(hasVideoInput ? { youtube_video_id: videoId, ...(videoId !== lesson.youtube_video_id ? { duration_seconds: 0 } : {}) } : {}) })
      .eq("id", identity.data.id).eq("updated_at", identity.data.updated_at).select("id").maybeSingle()
    if (error) return builderFailure(error)
    if (!data) return fail("This lesson changed. Refresh the page before trying again.")
    await audit("lesson.updated", "lesson", data.id, { status: parsed.status })
    const section = Array.isArray(lesson.section) ? lesson.section[0] : lesson.section
    refreshBuilder(section?.course_id)
    return ok("Lesson saved.")
  } catch (error) { return builderFailure(error) }
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

export async function updateStudentAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = updateStudentSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.full_name,
        phone: parsed.phone ?? null,
        whatsapp: parsed.whatsapp ?? null,
        status: parsed.status,
      })
      .eq("id", parsed.id)
      .eq("role", "student")
      .select("id")
      .maybeSingle()

    if (error) return fail(error.message)
    if (!data) return fail("Student not found.")

    await audit("student.updated", "profile", parsed.id, {
      full_name: parsed.full_name,
      status: parsed.status,
    })
    revalidatePath("/admin/students")
    return ok("Student updated.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Student update failed.")
  }
}

export async function updateStudentStatusAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = updateStudentStatusSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("profiles")
      .update({ status: parsed.status })
      .eq("id", parsed.id)
      .eq("role", "student")
      .select("id")
      .maybeSingle()

    if (error) return fail(error.message)
    if (!data) return fail("Student not found.")

    await audit("student.status.updated", "profile", parsed.id, { status: parsed.status })
    revalidatePath("/admin/students")
    return ok("Student status updated.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Student status update failed.")
  }
}

export async function deleteStudentAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const parsed = deleteStudentSchema.parse(formObject(formData))
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", parsed.id)
      .eq("role", "student")
      .select("id")
      .maybeSingle()

    if (error) return fail(error.message)
    if (!data) return fail("Student not found.")

    await audit("student.deleted", "profile", parsed.id)
    revalidatePath("/admin/students")
    return ok("Student permanently deleted.")
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Student deletion failed.")
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
    const result = paymentMethodSchema.safeParse(formObject(formData))
    if (!result.success) return fail(paymentValidationMessage(result.error.issues))
    const parsed = result.data
    const supabase = createSupabaseAdminClient()
    const { data: duplicate, error: lookupError } = await supabase.from("payment_methods")
      .select("id").eq("method_type", parsed.method_type).eq("account_number", parsed.account_number).limit(1).maybeSingle()
    if (lookupError) return paymentSettingsFailure(lookupError)
    if (duplicate) return fail("This account already has a payment method. Edit or activate the existing method instead.")
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ ...parsed, iban_number: parsed.iban_number ?? null, bank_name: parsed.bank_name ?? null, instructions: parsed.instructions ?? null })
      .select("id")
      .single()

    if (error || !data) return paymentSettingsFailure(error)
    await audit("payment_method.created", "payment_method", data.id, { display_name: parsed.display_name })
    refreshPaymentSettings()
    return ok("Payment method created.")
  } catch (error) {
    return paymentSettingsFailure(error)
  }
}

// Allowlisted field messages keep validation and infrastructure details out of the UI.
function paymentValidationMessage(issues: { path: PropertyKey[] }[]) {
  const messages: Record<string, string> = {
    method_type: "Choose Bank Transfer, EasyPaisa, or JazzCash.",
    display_name: "Display name must contain at least 3 characters.",
    account_title: "Account title must contain at least 3 characters.",
    account_number: "Account number must contain at least 3 characters.",
    iban_number: "Enter only the IBAN value, starting with two country letters and two digits (15–34 characters). Do not include the word IBAN. Spaces are allowed.",
    bank_name: "Check the bank name, or leave it blank.",
    instructions: "Check the instructions, or leave them blank.",
    is_active: "Choose whether this method is available for enrollment.",
  }
  return messages[String(issues[0]?.path[0])] ?? "Check the payment details and try again."
}

function paymentSettingsFailure(error: unknown): ActionState {
  if (error instanceof AppAuthError || error instanceof AppForbiddenError) {
    return fail("You do not have permission to manage payment methods. Please sign in with an admin account.")
  }
  return fail("We could not save this payment method. Please try again.")
}

function refreshPaymentSettings() {
  revalidatePath("/admin/payment-settings")
  revalidatePath("/enroll")
}

export async function updatePaymentMethodAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const identity = paymentMethodIdentitySchema.safeParse(formObject(formData))
    if (!identity.success) return fail("Refresh the page before editing this payment method.")
    const result = paymentMethodSchema.omit({ is_active: true }).safeParse(formObject(formData))
    if (!result.success) return fail(paymentValidationMessage(result.error.issues))
    const parsed = result.data
    const supabase = createSupabaseAdminClient()
    const { data: duplicate, error: lookupError } = await supabase.from("payment_methods")
      .select("id").eq("method_type", parsed.method_type).eq("account_number", parsed.account_number)
      .not("id", "eq", identity.data.id).limit(1).maybeSingle()
    if (lookupError) return paymentSettingsFailure(lookupError)
    if (duplicate) return fail("Another method already uses this account. Edit that method instead.")
    const { data, error } = await supabase.from("payment_methods")
      .update({ ...parsed, iban_number: parsed.iban_number ?? null, bank_name: parsed.bank_name ?? null, instructions: parsed.instructions ?? null })
      .eq("id", identity.data.id).eq("updated_at", identity.data.updated_at).select("id").maybeSingle()
    if (error) return paymentSettingsFailure(error)
    if (!data) return fail("This method has changed or is no longer available. Refresh the page before trying again.")
    await audit("payment_method.updated", "payment_method", data.id, { display_name: parsed.display_name })
    refreshPaymentSettings()
    return ok("Payment details saved.")
  } catch (error) {
    return paymentSettingsFailure(error)
  }
}

export async function updatePaymentMethodStatusAction(_: ActionState | undefined, formData: FormData) {
  try {
    await requireAdmin()
    const result = paymentMethodStatusSchema.safeParse(formObject(formData))
    if (!result.success) return fail("Refresh the page before changing availability.")
    const { id, updated_at, is_active } = result.data
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.from("payment_methods").update({ is_active })
      .eq("id", id).eq("updated_at", updated_at).select("id").maybeSingle()
    if (error) return fail("We could not change availability. Please try again.")
    if (!data) return fail("This method has changed or is no longer available. Refresh the page before trying again.")
    await audit("payment_method.availability_changed", "payment_method", id, { is_active })
    refreshPaymentSettings()
    return ok(is_active ? "Payment method activated." : "Payment method deactivated. Previous payments are preserved.")
  } catch (error) {
    return paymentSettingsFailure(error)
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
