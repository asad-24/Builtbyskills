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
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: "550e8400-e29b-41d4-a716-446655440001" }, error: null })
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
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: "550e8400-e29b-41d4-a716-446655440001" }, error: null })
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
    const enrollmentFields = {
      full_name: "Ali Khan", email: "ali@example.com", phone: "03001234567", whatsapp: "03001234567", screenshot_path: "public-enrollment/receipt.png", screenshot_upload_status: "uploaded", city: "Karachi",
      course_id: "550e8400-e29b-41d4-a716-446655440000",
      payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
    }

    it.each([
      ["full_name", "   ", "Please enter your name."],
      ["email", "invalid", "Please enter a valid email."],
      ["phone", "", "Please enter your phone number."],
      ["phone", "1", "Please enter a valid phone number."],
      ["whatsapp", "1", "Please enter a valid WhatsApp number."],
      ["course_id", "", "Please select a course."],
      ["payment_method_id", "", "Please select a payment method."],
      ["screenshot_path", "", "Please upload your payment screenshot."],
    ])("rejects invalid %s on the server before creating a client", async (field, value, message) => {
      const result = await submitEnrollmentAction(undefined, createFormData({ ...enrollmentFields, [field]: value }))
      expect(result.ok).toBe(false)
      expect(result.fieldErrors?.[field]).toBe(message)
      expect(result.message).toBe("Please check the highlighted fields.")
      expect(createSupabaseAdminClient).not.toHaveBeenCalled()
      expect(sendTransactionalEmail).not.toHaveBeenCalled()
    })

    it.each(["full_name", "email", "phone", "course_id", "payment_method_id", "screenshot_path", "screenshot_upload_status"])(
      "rejects omitted %s even when client validation is bypassed", async field => {
        const data = createFormData(enrollmentFields)
        data.delete(field)
        expect((await submitEnrollmentAction(undefined, data)).ok).toBe(false)
        expect(createSupabaseAdminClient).not.toHaveBeenCalled()
      })

    it.each([{ data: null, error: null }, { data: null, error: { message: '{"private":"storage failure"}' } }])(
      "rejects an unverified Storage object despite submitted uploaded status", async storageResult => {
        const { mock } = createSupabaseMock()
        mock.from("courses").single.mockResolvedValue({ data: { title: "Course", price: 5000, currency: "PKR" }, error: null })
        mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: enrollmentFields.payment_method_id }, error: null })
        mock.storage.info.mockResolvedValue(storageResult)
        vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
        const result = await submitEnrollmentAction(undefined, createFormData(enrollmentFields))
        expect(result).toEqual({ ok: false, message: "Please upload your payment screenshot.", fieldErrors: { screenshot_path: "Please upload your payment screenshot." } })
        expect(mock.storage.from).toHaveBeenCalledWith("payment-screenshots")
        expect(mock.storage.info).toHaveBeenCalledWith(enrollmentFields.screenshot_path)
        expect(mock.from).not.toHaveBeenCalledWith("payment_submissions")
        expect(mock.from).not.toHaveBeenCalledWith("enrollment_requests")
        expect(sendTransactionalEmail).not.toHaveBeenCalled()
      })

    it.each([undefined, "", "   ", " 0300-1234567 "])("accepts optional WhatsApp %j without changing payment/enrollment creation", async whatsapp => {
      const { mock } = createSupabaseMock()
      mock.from("courses").single.mockResolvedValue({ data: { title: "Course", price: 5000, currency: "PKR" }, error: null })
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: enrollmentFields.payment_method_id }, error: null })
      mock.from("payment_submissions").single.mockResolvedValue({ data: { id: "payment-1" }, error: null })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
      const data = createFormData(enrollmentFields)
      if (whatsapp === undefined) data.delete("whatsapp")
      else data.set("whatsapp", whatsapp)
      expect((await submitEnrollmentAction(undefined, data)).ok).toBe(true)
      expect(mock.from("enrollment_requests").insert).toHaveBeenCalledWith(expect.objectContaining({
        whatsapp: whatsapp?.trim() || null, phone: enrollmentFields.phone,
        payment_submission_id: "payment-1", status: "pending",
      }))
      expect(mock.from("payment_submissions").insert).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000, currency: "PKR", status: "pending" }))
      expect(sendTransactionalEmail).toHaveBeenCalled()
    })

    it("accepts a trimmed one-character name and absent optional details without changing the workflow", async () => {
      const { mock } = createSupabaseMock()
      mock.from("courses").single.mockResolvedValue({ data: { title: "Course", price: 5000, currency: "PKR" }, error: null })
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: enrollmentFields.payment_method_id }, error: null })
      mock.from("payment_submissions").single.mockResolvedValue({ data: { id: "payment-1" }, error: null })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
      const data = createFormData({ ...enrollmentFields, full_name: " A ", email: " ali@example.com " })
      data.delete("city")
      expect((await submitEnrollmentAction(undefined, data)).ok).toBe(true)
      expect(mock.from("enrollment_requests").insert).toHaveBeenCalledWith(expect.objectContaining({
        full_name: "A", email: "ali@example.com", city: "", message: null,
        preferred_batch: "", experience_level: "", payment_submission_id: "payment-1", status: "pending",
      }))
      expect(mock.from("payment_submissions").insert).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000, currency: "PKR", status: "pending" }))
    })

    it.each([
      { data: null, error: null },
      { data: null, error: { message: "internal lookup details" } },
    ])("rejects unavailable or inactive methods before writing payment records", async methodResult => {
      const { mock } = createSupabaseMock()
      mock.from("courses").single.mockResolvedValue({ data: { title: "Course", price: 5000, currency: "PKR" }, error: null })
      mock.from("payment_methods").maybeSingle.mockResolvedValue(methodResult)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never)
      const result = await submitEnrollmentAction(undefined, createFormData(enrollmentFields))
      expect(result).toEqual({ ok: false, message: "This payment method is no longer available. Refresh the page and select another method." })
      expect(mock.from("payment_methods").eq).toHaveBeenCalledWith("is_active", true)
      expect(mock.from).not.toHaveBeenCalledWith("payment_submissions")
      expect(mock.from).not.toHaveBeenCalledWith("enrollment_requests")
      expect(sendTransactionalEmail).not.toHaveBeenCalled()
    })

    it.each([
      { screenshot_upload_status: "uploading", screenshot_path: "" },
      { screenshot_upload_status: "failed", screenshot_path: "" },
      { screenshot_upload_status: "failed", screenshot_path: "public-enrollment/stale.png" },
      { screenshot_upload_status: "uploaded", screenshot_path: "" },
      { screenshot_upload_status: "none", screenshot_path: "" },
      { screenshot_upload_status: "unexpected", screenshot_path: "public-enrollment/receipt.png" },
    ])("does not save a payment when screenshot upload is incomplete: %j", async (uploadFields) => {
      const result = await submitEnrollmentAction(undefined, createFormData({ ...enrollmentFields, ...uploadFields }))
      expect(result.ok).toBe(false)
      expect(result.fieldErrors?.screenshot_path).toBeTruthy()
      expect(createSupabaseAdminClient).not.toHaveBeenCalled()
      expect(sendTransactionalEmail).not.toHaveBeenCalled()
    })

    it.each([
      {},
      { transaction_reference: "" },
      { screenshot_upload_status: "uploaded", screenshot_path: "public-enrollment/receipt.png" },
      { screenshot_path: "legacy/receipt.jpg", transaction_reference: "HISTORICAL-TXN" },
    ])("supports optional references and associates the screenshot with the enrollment payment: %j", async (optionalFields) => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: "550e8400-e29b-41d4-a716-446655440001" }, error: null })
      mock.from("courses").single.mockResolvedValue({ data: { title: "Shopify", price: 5000, currency: "PKR" }, error: null })
      mock.from("payment_submissions").single.mockResolvedValue({ data: { id: "receipt-payment" }, error: null })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)
      const formData = createFormData(enrollmentFields)
      for (const [key, value] of Object.entries(optionalFields)) {
        if (value !== undefined) formData.set(key, value)
      }
      const result = await submitEnrollmentAction(undefined, formData)
      expect(result.ok).toBe(true)
      expect(tableChains.get("payment_submissions")!.chain.insert).toHaveBeenCalledWith(expect.objectContaining({
        screenshot_path: optionalFields.screenshot_path || enrollmentFields.screenshot_path,
        transaction_reference: optionalFields.transaction_reference || null,
        amount: 5000,
      }))
      expect(tableChains.get("enrollment_requests")!.chain.insert).toHaveBeenCalledWith(expect.objectContaining({ payment_submission_id: "receipt-payment" }))
    })

    it.each([
      { amount: undefined, preferred_batch: undefined, experience_level: undefined },
      { amount: "1", preferred_batch: "", experience_level: "   " },
      { amount: "1", preferred_batch: "Weekend", experience_level: "Beginner" },
    ])("uses course price and sends email with optional legacy fields: %j", async ({ amount, preferred_batch, experience_level }) => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: "550e8400-e29b-41d4-a716-446655440001" }, error: null })
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: { id: "payment-1" }, error: null })
      tableChains.get("payment_submissions")!.chain.setResolveWith(null, null)
      mock.from("courses")
      tableChains.get("courses")!.chain.single.mockResolvedValue({ data: { title: "Shopify Mastery", price: 7500, currency: "USD" }, error: null })
      mock.from("enrollment_requests")
      tableChains.get("enrollment_requests")!.chain.setResolveWith({ id: "enrollment-1" }, null)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Ali Khan",
        email: "ali@example.com",
        phone: "03001234567",
        whatsapp: "03001234567",
        screenshot_upload_status: "uploaded",
        screenshot_path: "public-enrollment/receipt.png",
        city: "Karachi",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
        transaction_reference: "TXN123",
      })

      formData.delete("preferred_batch")
      formData.delete("experience_level")
      if (preferred_batch !== undefined) formData.set("preferred_batch", preferred_batch)
      if (experience_level !== undefined) formData.set("experience_level", experience_level)
      if (amount !== undefined) formData.set("amount", amount)
      const result = await submitEnrollmentAction(undefined, formData)

      expect(result).toEqual({
        ok: true,
        message: "Enrollment submitted. Your payment is pending admin review.",
      })
      expect(mock.from("payment_submissions").insert).toHaveBeenCalledWith(expect.objectContaining({
        amount: 7500, currency: "USD", status: "pending",
        transaction_reference: "TXN123", screenshot_path: "public-enrollment/receipt.png",
      }))
      expect(tableChains.get("courses")!.chain.eq).toHaveBeenCalledWith("id", "550e8400-e29b-41d4-a716-446655440000")
      expect(tableChains.get("courses")!.chain.eq).toHaveBeenCalledWith("status", "published")
      expect(mock.from("enrollment_requests").insert).toHaveBeenCalledWith(expect.objectContaining({
        payment_submission_id: "payment-1",
        preferred_batch: preferred_batch || "",
        experience_level: experience_level?.trim() ? experience_level : "",
        status: "pending",
      }))
      expect(revalidatePath).toHaveBeenCalledWith("/admin/enrollments")
      expect(revalidatePath).toHaveBeenCalledWith("/admin/payments")
      expect(sendTransactionalEmail).toHaveBeenCalled()
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.to).toBe("ali@example.com")
      expect((sendTransactionalEmail as any).mock.calls[0]?.[0]?.subject).toBe("Builtbyskills enrollment received")
    })

    it.each([
      { data: null, error: null },
      { data: null, error: { message: "Course lookup failed" } },
    ])("does not create payment or enrollment when the course is unavailable: %j", async (courseResult) => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: "550e8400-e29b-41d4-a716-446655440001" }, error: null })
      mock.from("courses")
      tableChains.get("courses")!.chain.single.mockResolvedValue(courseResult)
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const result = await submitEnrollmentAction(undefined, createFormData({
        full_name: "Ali Khan",
        email: "ali@example.com",
        phone: "03001234567",
        whatsapp: "03001234567",
        screenshot_upload_status: "uploaded",
        screenshot_path: "public-enrollment/receipt.png",
        city: "Karachi",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
      }))

      expect(result.ok).toBe(false)
      expect(mock.from).not.toHaveBeenCalledWith("payment_submissions")
      expect(mock.from).not.toHaveBeenCalledWith("enrollment_requests")
      expect(sendTransactionalEmail).not.toHaveBeenCalled()
    })

    it("returns fail message when payment submission fails", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: "550e8400-e29b-41d4-a716-446655440001" }, error: null })
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: null, error: { message: "Payment error" } })
      mock.from("courses")
      tableChains.get("courses")!.chain.single.mockResolvedValue({ data: { title: "Shopify", price: 5000, currency: "PKR" }, error: null })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Ali",
        email: "ali@example.com",
        phone: "03001234567",
        whatsapp: "03001234567",
        screenshot_upload_status: "uploaded",
        screenshot_path: "public-enrollment/receipt.png",
        city: "Karachi",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
      })

      const result = await submitEnrollmentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Could not save your payment. Please try again." })
    })

    it("returns fail message when enrollment request insertion fails", async () => {
      const { mock, tableChains } = createSupabaseMock()
      mock.from("payment_methods").maybeSingle.mockResolvedValue({ data: { id: "550e8400-e29b-41d4-a716-446655440001" }, error: null })
      mock.from("payment_submissions")
      tableChains.get("payment_submissions")!.chain.single.mockResolvedValue({ data: { id: "payment-1" }, error: null })
      tableChains.get("payment_submissions")!.chain.setResolveWith(null, null)
      mock.from("courses")
      tableChains.get("courses")!.chain.single.mockResolvedValue({ data: { title: "Shopify", price: 5000, currency: "PKR" }, error: null })
      mock.from("enrollment_requests")
      tableChains.get("enrollment_requests")!.chain.setResolveWith(null, { message: "Enrollment error" })
      vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as any)

      const formData = createFormData({
        full_name: "Ali",
        email: "ali@example.com",
        phone: "03001234567",
        whatsapp: "03001234567",
        screenshot_upload_status: "uploaded",
        screenshot_path: "public-enrollment/receipt.png",
        city: "Karachi",
        course_id: "550e8400-e29b-41d4-a716-446655440000",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
      })

      const result = await submitEnrollmentAction(undefined, formData)

      expect(result).toEqual({ ok: false, message: "Could not save your enrollment. Please try again." })
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
