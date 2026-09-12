import { describe, it, expect } from "vitest"
import { contactSchema, enrollmentRequestSchema, splitLines } from "@/lib/validations/lms"

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
  it("accepts valid enrollment data", () => {
    const result = enrollmentRequestSchema.parse({
      full_name: "Jane Smith",
      email: "jane@example.com",
      phone: "03001234567",
      city: "Karachi",
      course_id: "550e8400-e29b-41d4-a716-446655440000",
      preferred_batch: "Weekend",
      experience_level: "Beginner",
      amount: 5000,
      transaction_reference: "TXN123",
      payment_method_id: "550e8400-e29b-41d4-a716-446655440001",
    })
    expect(result.full_name).toBe("Jane Smith")
    expect(result.city).toBe("Karachi")
    expect(result.amount).toBe(5000)
  })

  it("rejects missing required fields", () => {
    expect(() =>
      enrollmentRequestSchema.parse({
        email: "jane@example.com",
        city: "Karachi",
        course_id: "c1",
        preferred_batch: "Weekend",
        experience_level: "Beginner",
        amount: 5000,
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
