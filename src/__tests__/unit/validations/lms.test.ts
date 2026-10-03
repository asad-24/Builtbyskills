import { describe, it, expect } from "vitest"
import { contactSchema, enrollmentRequestSchema, paymentMethodSchema, splitLines } from "@/lib/validations/lms"

describe("paymentMethodSchema IBAN support", () => {
  const method = {
    method_type: "bank_transfer",
    display_name: "Bank transfer",
    account_title: "Builtbyskills",
    account_number: "1234567890",
  }

  it.each(["bank_transfer", "easypaisa", "jazzcash"])("preserves %s without an IBAN", (method_type) => {
    const parsed = paymentMethodSchema.parse({ ...method, method_type })
    expect(parsed.account_number).toBe(method.account_number)
    expect(parsed.iban_number).toBeUndefined()
  })

  it("normalizes IBAN independently of account number", () => {
    const parsed = paymentMethodSchema.parse({ ...method, iban_number: "pk36 scbl 0000 0011 2345 6702" })
    expect(parsed.iban_number).toBe("PK36SCBL0000001123456702")
    expect(parsed.account_number).toBe(method.account_number)
  })

  it("accepts a blank optional IBAN", () => {
    expect(paymentMethodSchema.parse({ ...method, iban_number: "   " }).iban_number).toBeUndefined()
  })

  it.each(["invalid", "PKXXSCBL0000001123456702", "PK36SCBL!000001123456702"])("rejects malformed IBAN %s", (iban_number) => {
    expect(paymentMethodSchema.safeParse({ ...method, iban_number }).success).toBe(false)
  })

  it("still requires account number when IBAN is provided", () => {
    expect(paymentMethodSchema.safeParse({ ...method, account_number: "", iban_number: "PK36SCBL0000001123456702" }).success).toBe(false)
  })
})

describe("contactSchema", () => {
  it("accepts valid contact data", () => {
    const result = contactSchema.parse({
      full_name: "John Doe",
      email: "john@example.com",
      message: "Hello, I have a question about courses.",
    })
    expect(result.full_name).toBe("John Doe")
    expect(result.email).toBe("john@example.com")
    expect(result.message).toBe("Hello, I have a question about courses.")
  })

  it("rejects invalid email", () => {
    expect(() =>
      contactSchema.parse({
        full_name: "John Doe",
        email: "not-an-email",
        message: "Hello.",
      })
    ).toThrow()
  })

  it("rejects short message", () => {
    expect(() =>
      contactSchema.parse({
        full_name: "John Doe",
        email: "john@example.com",
        message: "Hi",
      })
    ).toThrow()
  })
})

describe("enrollmentRequestSchema", () => {
  it.each([
    {},
    { preferred_batch: "", experience_level: "   " },
    { preferred_batch: "Weekend", experience_level: "Beginner" },
  ])("accepts enrollment without a student-supplied amount and optional legacy fields: %j", (legacyFields) => {
    const result = enrollmentRequestSchema.parse({
      full_name: "Jane Smith",
      email: "jane@example.com",
      phone: "03001234567",
      whatsapp: "03001234567",
      screenshot_path: "public-enrollment/receipt.png",
      screenshot_upload_status: "uploaded",
      city: "Karachi",
      course_id: "550e8400-e29b-41d4-a716-446655440000",
      ...legacyFields,
      transaction_reference: "TXN123",
      payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
    })
    expect(result.full_name).toBe("Jane Smith")
    expect(result.city).toBe("Karachi")
    expect(result).not.toHaveProperty("amount")
    expect(result.preferred_batch).toBe(legacyFields.preferred_batch || undefined)
    expect(result.experience_level).toBe(legacyFields.experience_level?.trim() ? legacyFields.experience_level : undefined)
  })

  it("rejects missing required fields", () => {
    expect(() =>
      enrollmentRequestSchema.parse({
        email: "jane@example.com",
        city: "Karachi",
        course_id: "c1",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        payment_method_id: "pm1",
      })
    ).toThrow()
  })
})

describe("splitLines", () => {
  it("splits non-empty lines", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"])
  })

  it("trims and removes blank lines", () => {
    expect(splitLines("  a  \n\nb\n")).toEqual(["a", "b"])
  })

  it("returns empty array for empty input", () => {
    expect(splitLines("")).toEqual([])
    expect(splitLines(undefined)).toEqual([])
  })
})
