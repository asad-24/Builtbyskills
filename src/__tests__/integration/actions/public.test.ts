import { vi, describe, it, expect, beforeEach } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}))

vi.mock("@/lib/email/send", () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({
    ok: true as const,
    skipped: false,
    message: "Email sent.",
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendTransactionalEmail } from "@/lib/email/send"
import { revalidatePath } from "next/cache"
import { submitContactAction, submitEnrollmentAction } from "@/actions/public"

function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }
  return formData
}

describe("public actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("submitContactAction", () => {
    it("returns ok message on valid contact submission", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("contact_submissions")
      tableChains.get("contact_submissions")!.chain.setResolveWith({ id: "contact-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "John Doe",
        email: "john@example.com",
        message: "Hello, I have a question about your courses.",
      })

      const result = await submitContactAction(undefined, formData)

      expect(result).toEqual({ ok: true, message: "Thanks. Your message has been received." })
      expect(mock.from("contact_submissions").insert).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith("/admin/contact-submissions")
    })

    it("returns fail message on database error", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("contact_submissions")
      tableChains.get("contact_submissions")!.chain.setResolveWith(null, { message: "Duplicate entry" })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Jane",
        email: "jane@example.com",
        message: "This is a longer message for the test.",
      })

      const result = await submitContactAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Duplicate entry" })
    })

    it("returns fail message on validation error", async () => {
      const formData = createFormData({
        full_name: "J",
        email: "not-an-email",
        message: "Hi",
      })

      const result = await submitContactAction(undefined, formData)

      expect(result.ok).toBe(false)
      expect(result.message.length).toBeGreaterThan(0)
    })
  })

  describe("submitEnrollmentAction", () => {
    it("returns ok message and sends email on valid enrollment", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: { id: "payment-1" }, error: null })
      tableChains.get("payment_submissions")!.chain.setResolveWith(null, null)
      mock.from("courses")
      tableChains.get("courses")!.chain.single.mockResolvedValue({ data: { title: "Shopify Mastery" }, error: null })
      mock.from("enrollment_requests")
      tableChains.get("enrollment_requests")!.chain.setResolveWith({ id: "enrollment-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Ali Khan",
        email: "ali@example.com",
        phone: "03001234567",
        city: "Karachi",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        amount: "5000",
        payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
        transaction_reference: "TXN123",
        screenshot_path: "/uploads/screenshot.png",
      })

      const result = await submitEnrollmentAction(undefined, formData)

      expect(result).toEqual({
        ok: true,
        message: "Enrollment submitted. Your payment is pending admin review.",
      })
      expect(mock.from("payment_submissions").insert).toHaveBeenCalled()
      expect(mock.from("enrollment_requests").insert).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith("/admin/enrollments")
      expect(revalidatePath).toHaveBeenCalledWith("/admin/payments")
      expect(sendTransactionalEmail).toHaveBeenCalled()
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.to).toBe("ali@example.com")
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.subject).toBe("Builtbyskills enrollment received")
    })

    it("returns fail message when payment submission fails", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: null, error: { message: "Payment error" } })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Ali",
        email: "ali@example.com",
        phone: "03001234567",
        city: "Karachi",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        amount: "5000",
        payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
      })

      const result = await submitEnrollmentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Payment error" })
    })

    it("returns fail message when enrollment request insertion fails", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: { id: "payment-1" }, error: null })
      tableChains.get("payment_submissions")!.chain.setResolveWith(null, null)
      mock.from("courses")
      tableChains.get("courses")!.chain.single.mockResolvedValue({ data: { title: "Shopify" }, error: null })
      mock.from("enrollment_requests")
      tableChains.get("enrollment_requests")!.chain.setResolveWith(null, { message: "Enrollment error" })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Ali",
        email: "ali@example.com",
        phone: "03001234567",
        city: "Karachi",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        amount: "5000",
        payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
      })

      const result = await submitEnrollmentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Enrollment error" })
    })

    it("returns fail message on validation error", async () => {
      const formData = createFormData({
        full_name: "A",
        email: "bad",
        phone: "1",
        city: "K",
        course_id: "bad",
        preferred_batch: "W",
        experience_level: "B",
        amount: "-1",
        payment_method_id: "bad",
      })

      const result = await submitEnrollmentAction(undefined, formData)

      expect(result.ok).toBe(false)
      expect(result.message.length).toBeGreaterThan(0)
    })
  })
})
