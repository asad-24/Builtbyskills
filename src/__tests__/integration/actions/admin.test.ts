import { vi, describe, it, expect, beforeEach } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
import { AppForbiddenError } from "@/lib/errors"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: vi.fn(),
  requireProfile: vi.fn(),
  requireRole: vi.fn(),
  getCurrentProfile: vi.fn(),
  guardDashboard: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}))

vi.mock("@/lib/email/send", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({
    ok: true as const,
    skipped: false,
    message: "Email sent.",
    emailId: "test-email-id",
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendTransactionalEmail } from "@/lib/email/send"
import { revalidatePath } from "next/cache"
import {
  createCourseAction,
  updateCourseAction,
  deleteCourseAction,
  createSectionAction,
  createLessonAction,
  createStudentAction,
  assignCourseAction,
  createPaymentMethodAction,
  reviewPaymentAction,
  createLiveClassAction,
  createAnnouncementAction,
  updateContactStatusAction,
} from "@/actions/admin"

function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }
  return formData
}

const adminProfile = { id: "admin-1", role: "super_admin", status: "active" }

describe("admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(adminProfile as any)
  })

  describe("createCourseAction", () => {
    it("returns ok message when course is created", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("courses")
      tableChains.get("courses")!.chain.single.mockResolvedValue({ data: { id: "course-1" }, error: null })
      tableChains.get("courses")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        title: "Shopify Mastery",
        slug: "shopify-mastery",
        short_description: "Learn Shopify from scratch to advanced.",
        description: "A comprehensive Shopify course covering all aspects.",
        category: "E-commerce",
        level: "Beginner",
        price: "5000",
        status: "draft",
        featured: "false",
        outcomes: "Build stores\nDrive sales",
        requirements: "Basic computer skills",
      })

      const result = await createCourseAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Course created." })
      expect(mock.from("courses").insert).toHaveBeenCalled()
      expect(mock.from("audit_logs").insert).toHaveBeenCalledWith({
        actor_id: "admin-1",
        action: "course.created",
        entity_type: "course",
        entity_id: "course-1",
        metadata: { title: "Shopify Mastery" },
      })
      expect(revalidatePath).toHaveBeenCalledWith("/admin/courses")
    })

    it("returns fail message when not admin", async () => {
      vi.mocked(requireAdmin).mockRejectedValue(new AppForbiddenError())

      const formData = createFormData({
        title: "Course",
        slug: "course",
        short_description: "This is a course description.",
        description: "A longer course description.",
        category: "Tech",
        level: "Beginner",
        price: "1000",
        status: "draft",
        featured: "false",
        outcomes: "",
        requirements: "",
      })

      const result = await createCourseAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "You do not have permission to perform this action." })
    })
  })

  describe("updateCourseAction", () => {
    it("returns ok message when course is updated", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("courses")
      tableChains.get("courses")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        id: "course-1",
        title: "Updated Course",
        slug: "updated-course",
        short_description: "Updated description.",
        description: "A longer updated description.",
        category: "Tech",
        level: "Intermediate",
        price: "6000",
        status: "published",
        featured: "true",
        outcomes: "",
        requirements: "",
      })

      const result = await updateCourseAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Course updated." })
      expect(mock.from("courses").update).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith("/admin/courses")
      expect(revalidatePath).toHaveBeenCalledWith("/admin/course-builder/course-1")
    })
  })

  describe("deleteCourseAction", () => {
    it("deletes course without throwing on success", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("courses")
      tableChains.get("courses")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        id: "course-1",
      })

      await expect(deleteCourseAction(formData)).resolves.toBeUndefined()
      expect(mock.from("courses").delete).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith("/admin/courses")
    })
  })

  describe("createSectionAction", () => {
    it("returns ok message when section is created", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("course_sections")
      tableChains.get("course_sections")!.chain.single.mockResolvedValue({ data: { id: "section-1" }, error: null })
      tableChains.get("course_sections")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Introduction",
        position: "0",
      })

      const result = await createSectionAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Section created." })
      expect(revalidatePath).toHaveBeenCalledWith("/admin/course-builder/550e8400-e29b-41d4-a716-446655440000")
    })
  })

  describe("createLessonAction", () => {
    it("returns ok message when lesson is created", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("lessons")
      tableChains.get("lessons")!.chain.single.mockResolvedValue({ data: { id: "lesson-1", course_sections: { course_id: "course-1" } }, error: null })
      tableChains.get("lessons")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        section_id: "550e8400-e29b-41d4-a716-446655440001",
        title: "Getting Started",
        slug: "getting-started",
        lesson_type: "video",
        duration_seconds: "300",
        position: "0",
        is_preview: "false",
        status: "draft",
      })

      const result = await createLessonAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Lesson created." })
      expect(revalidatePath).toHaveBeenCalledWith("/admin/course-builder/course-1")
    })
  })

  describe("createStudentAction", () => {
    it("returns ok message and sends activation email when no profile or auth user exists", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: null, error: null })
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "new-profile-1" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: "new-user-1" } },
        error: null,
      })
      mock.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: "https://example.supabase.co/auth/v1/verify?token=test&type=recovery",
          },
        },
        error: null,
      })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "New Student",
        email: "newstudent@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: true,
        message: "Student created and activation email queued.",
      })
      expect(mock.auth.admin.createUser).toHaveBeenCalledWith({
        email: "newstudent@example.com",
        email_confirm: true,
        user_metadata: { full_name: "New Student", role: "student" },
      })
      expect(mock.auth.admin.generateLink).toHaveBeenCalledWith({
        type: "recovery",
        email: "newstudent@example.com",
      })
      expect(mock.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
      expect(mock.from("profiles").upsert).toHaveBeenCalled()
      expect(sendTransactionalEmail).toHaveBeenCalled()
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.to).toBe("newstudent@example.com")
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.subject).toBe("Activate your Builtbyskills account")
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.html).toContain("auth/v1/verify?token=test&type=recovery&redirect_to=")
    })

    it("returns 'Student already registered' when profile already exists", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: { id: "existing-profile" }, error: null })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "New Student",
        email: "existing@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Student already registered" })
      expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
      expect(mock.auth.admin.generateLink).not.toHaveBeenCalled()
      expect(sendTransactionalEmail).not.toHaveBeenCalled()
    })

    it("returns 'Student already registered' when profile exists even if auth user does not", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: { id: "existing-profile" }, error: null })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "New Student",
        email: "existing@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Student already registered" })
      expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
    })

    it("reuses existing auth user and creates profile when auth user exists but profile does not", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "new-profile-1" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        error: { code: "email_exists", message: "Auth user already exists" },
      })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "existing-auth-user", email: "existing@example.com" }],
        headers: new Headers(),
      } as Response)
      vi.stubGlobal("fetch", fetchMock)
      mock.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: "https://example.supabase.co/auth/v1/verify?token=test&type=recovery",
          },
        },
        error: null,
      })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Existing Auth User",
        email: "existing@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: true,
        message: "Student created and activation email queued.",
      })
      expect(mock.auth.admin.createUser).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/auth/v1/admin/users?page=1&per_page=50"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Bearer "),
          }),
        })
      )
      expect(mock.auth.admin.generateLink).toHaveBeenCalled()
      expect(mock.from("profiles").upsert).toHaveBeenCalled()
      expect(sendTransactionalEmail).toHaveBeenCalled()
    })

    it("reuses existing auth user found via direct fetch lookup with exact Supabase duplicate error", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "new-profile-1" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        error: { code: "email_exists", message: "A user with this email address has already been registered" },
      })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "existing-auth-user", email: "existing@example.com" }],
        headers: new Headers(),
      } as Response)
      vi.stubGlobal("fetch", fetchMock)
      mock.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: "https://example.supabase.co/auth/v1/verify?token=test&type=recovery",
          },
        },
        error: null,
      })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Existing Auth User",
        email: "existing@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: true,
        message: "Student created and activation email queued.",
      })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/auth/v1/admin/users?page=1&per_page=50"),
        expect.anything()
      )
    })

    it("reuses existing auth user beyond first page when listing users via fetch", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "new-profile-1" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        error: { code: "email_exists", message: "A user with this email address has already been registered" },
      })
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => Array.from({ length: 50 }, (_, i) => ({ id: `user-${i}`, email: `user${i}@example.com` })),
          headers: new Headers({
            "x-total-count": "100",
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: "existing-auth-user", email: "existing@example.com" }],
          headers: new Headers(),
        } as Response)
      vi.stubGlobal("fetch", fetchMock)
      mock.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: "https://example.supabase.co/auth/v1/verify?token=test&type=recovery",
          },
        },
        error: null,
      })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Existing Auth User",
        email: "existing@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: true,
        message: "Student created and activation email queued.",
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/auth/v1/admin/users?page=1&per_page=50"), expect.anything())
      expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/auth/v1/admin/users?page=2&per_page=50"), expect.anything())
    })

    it("returns failure when auth user does not exist after scanning all pages via fetch", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: null, error: null })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
        headers: new Headers(),
      } as Response)
      vi.stubGlobal("fetch", fetchMock)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      mock.auth.admin.createUser.mockResolvedValue({
        error: { code: "email_exists", message: "A user with this email address has already been registered" },
      })

      const formData = createFormData({
        full_name: "New Student",
        email: "newstudent@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: false,
        message: "User already exists but could not be found in Auth.",
      })
    })

    it("handles fetch auth lookup error explicitly", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: null, error: null })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as unknown as Response)
      vi.stubGlobal("fetch", fetchMock)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      mock.auth.admin.createUser.mockResolvedValue({
        error: { code: "email_exists", message: "A user with this email address has already been registered" },
      })

      const formData = createFormData({
        full_name: "New Student",
        email: "newstudent@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: false,
        message: "Unable to verify existing auth user. Please try again.",
      })
    })

    it("handles object response shape with users property from fetch lookup", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "new-profile-1" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        error: { code: "email_exists", message: "A user with this email address has already been registered" },
      })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ users: [{ id: "existing-auth-user", email: "existing@example.com" }], aud: "authenticated" }),
        headers: new Headers(),
      } as Response)
      vi.stubGlobal("fetch", fetchMock)
      mock.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: "https://example.supabase.co/auth/v1/verify?token=test&type=recovery",
          },
        },
        error: null,
      })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Existing Auth User",
        email: "existing@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: true,
        message: "Student created and activation email queued.",
      })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/auth/v1/admin/users?page=1&per_page=50"),
        expect.anything()
      )
    })

    it("detects duplicate email with uppercase and spaces", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: { id: "existing-profile" }, error: null })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "New Student",
        email: "  EXISTING@EXAMPLE.COM  ",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Student already registered" })
      expect(mock.auth.admin.createUser).not.toHaveBeenCalled()
    })

    it("returns 'Student already registered' when both auth user and profile exist after createUser duplicate", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValueOnce({ data: { id: "existing-profile" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        error: { code: "email_exists", message: "A user with this email address has already been registered" },
      })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "existing-auth-user", email: "existing@example.com" }],
        headers: new Headers(),
      } as Response)
      vi.stubGlobal("fetch", fetchMock)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Existing Student",
        email: "existing@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Student already registered" })
    })

    it("returns failure when Resend email sending fails", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: null, error: null })
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "new-profile-1" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: "new-user-1" } },
        error: null,
      })
      mock.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: "https://example.supabase.co/auth/v1/verify?token=test&type=recovery",
          },
        },
        error: null,
      })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const sendTransactionalEmailError = new Error("Resend API error")
      vi.mocked(sendTransactionalEmail).mockResolvedValueOnce({
        ok: false,
        skipped: false,
        message: sendTransactionalEmailError.message,
        emailId: null,
      })

      const formData = createFormData({
        full_name: "New Student",
        email: "newstudent@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: false,
        message: "Resend API error",
      })
    })

    it("returns failure when Resend is not configured", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("profiles")
      tableChains.get("profiles")!.chain.maybeSingle.mockResolvedValue({ data: null, error: null })
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "new-profile-1" }, error: null })
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      mock.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: "new-user-1" } },
        error: null,
      })
      mock.auth.admin.generateLink.mockResolvedValue({
        data: {
          properties: {
            action_link: "https://example.supabase.co/auth/v1/verify?token=test&type=recovery",
          },
        },
        error: null,
      })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      vi.mocked(sendTransactionalEmail).mockResolvedValueOnce({
        ok: false,
        skipped: true,
        message: "Resend is not configured.",
        emailId: null,
      })

      const formData = createFormData({
        full_name: "New Student",
        email: "newstudent@example.com",
        phone: "03001234567",
        status: "active",
      })

      const result = await createStudentAction(undefined, formData)

      expect(result).toEqual({
        ok: false,
        message: "Email service is not configured.",
      })
    })
  })

  describe("assignCourseAction", () => {
    it("returns ok message when course is assigned", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("enrollments")
      tableChains.get("enrollments")!.chain.single.mockResolvedValue({ data: { id: "enrollment-1" }, error: null })
      tableChains.get("enrollments")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        student_id: "550e8400-e29b-41d4-a716-446655440010",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        status: "active",
      })

      const result = await assignCourseAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Course assignment saved." })
      expect(revalidatePath).toHaveBeenCalledWith("/admin/students")
      expect(revalidatePath).toHaveBeenCalledWith("/admin/enrollments")
    })
  })

  describe("createPaymentMethodAction", () => {
    it("returns ok message when payment method is created", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_methods")
      tableChains.get("payment_methods")!.chain.single.mockResolvedValue({ data: { id: "pm-1" }, error: null })
      tableChains.get("payment_methods")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        method_type: "bank_transfer",
        display_name: "Habib Bank",
        account_title: "Acme Corp",
        account_number: "1234567890",
        is_active: "true",
      })

      const result = await createPaymentMethodAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Payment method created." })
      expect(revalidatePath).toHaveBeenCalledWith("/admin/payment-settings")
    })
  })

  describe("reviewPaymentAction", () => {
    it("returns ok message on approved payment and sends email", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: { id: "payment-1", courses: { title: "Shopify" }, profiles: { full_name: "Ali", email: "ali@example.com" } }, error: null })
      tableChains.get("payment_submissions")!.chain.setResolveWith(null, null)
      mock.from("enrollment_requests")
      tableChains.get("enrollment_requests")!.chain.maybeSingle.mockResolvedValue({ data: { id: "er-1", full_name: "Ali", email: "ali@example.com", course_id: "course-1" }, error: null })
      tableChains.get("enrollment_requests")!.chain.setResolveWith(null, null)
      mock.from("profiles")
      tableChains.get("profiles")!.chain.single.mockResolvedValue({ data: { id: "profile-1" }, error: null })
      tableChains.get("profiles")!.chain.setResolveWith(null, null)
      mock.from("enrollments")
      tableChains.get("enrollments")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        payment_id: "550e8400-e29b-41d4-a716-446655440000",
        status: "approved",
      })

      const result = await reviewPaymentAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Payment review saved." })
      expect(sendTransactionalEmail).toHaveBeenCalled()
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.subject).toBe("Builtbyskills payment approved")
    })

    it("returns ok message on rejected payment and sends email", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: { id: "payment-1", courses: { title: "Shopify" } }, error: null })
      tableChains.get("payment_submissions")!.chain.setResolveWith(null, null)
      mock.from("enrollment_requests")
      tableChains.get("enrollment_requests")!.chain.maybeSingle.mockResolvedValue({ data: { id: "er-1", full_name: "Ali", email: "ali@example.com" }, error: null })
      tableChains.get("enrollment_requests")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        payment_id: "550e8400-e29b-41d4-a716-446655440000",
        status: "rejected",
        rejection_reason: "Screenshot unclear",
      })

      const result = await reviewPaymentAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Payment review saved." })
      expect(sendTransactionalEmail).toHaveBeenCalled()
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.subject).toBe("Builtbyskills payment review update")
    })
  })

  describe("createLiveClassAction", () => {
    it("returns ok message when live class is created", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("live_classes")
      tableChains.get("live_classes")!.chain.single.mockResolvedValue({ data: { id: "live-1" }, error: null })
      tableChains.get("live_classes")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Live Session 1",
        meeting_provider: "zoom",
        meeting_url: "https://zoom.us/j/123",
        starts_at: "2025-01-01T10:00:00Z",
        status: "scheduled",
      })

      const result = await createLiveClassAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Live class created." })
      expect(revalidatePath).toHaveBeenCalledWith("/admin/live-classes")
    })
  })

  describe("createAnnouncementAction", () => {
    it("returns ok message when announcement is created", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("announcements")
      tableChains.get("announcements")!.chain.single.mockResolvedValue({ data: { id: "announcement-1" }, error: null })
      tableChains.get("announcements")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        title: "New Course Released",
        content: "We have released a new course on digital marketing.",
        is_published: "false",
      })

      const result = await createAnnouncementAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Announcement created." })
      expect(revalidatePath).toHaveBeenCalledWith("/admin/announcements")
    })
  })

  describe("updateContactStatusAction", () => {
    it("updates contact status without throwing", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("contact_submissions")
      tableChains.get("contact_submissions")!.chain.setResolveWith(null, null)
      mock.from("audit_logs")
      tableChains.get("audit_logs")!.chain.setResolveWith({ id: "audit-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        id: "contact-1",
        status: "resolved",
      })

      await expect(updateContactStatusAction(formData)).resolves.toBeUndefined()
      expect(mock.from("contact_submissions").update).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith("/admin/contact-submissions")
    })
  })
})
