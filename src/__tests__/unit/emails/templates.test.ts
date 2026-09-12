import { describe, it, expect } from "vitest"
import { emailTemplates } from "@/emails/templates"

describe("emailTemplates", () => {
  it("renders enrollmentReceived with name and courseTitle", () => {
    const html = emailTemplates.enrollmentReceived({ name: "Alice", courseTitle: "Shopify" })
    expect(html).toContain("Alice")
    expect(html).toContain("Shopify")
  })

  it("renders paymentApproved with courseTitle", () => {
    const html = emailTemplates.paymentApproved({ name: "Bob", courseTitle: "Digital Marketing" })
    expect(html).toContain("Bob")
    expect(html).toContain("Digital Marketing")
    expect(html).toContain("approved")
  })

  it("renders paymentRejected with reason", () => {
    const html = emailTemplates.paymentRejected({ name: "Carol", reason: "Invalid screenshot" })
    expect(html).toContain("Carol")
    expect(html).toContain("Invalid screenshot")
  })

  it("renders accountActivation with actionUrl", () => {
    const html = emailTemplates.accountActivation({ name: "Dave", actionUrl: "http://localhost:3000/auth/callback" })
    expect(html).toContain("Dave")
    expect(html).toContain("http://localhost:3000/auth/callback")
  })

  it("renders passwordReset with fallback when no actionUrl", () => {
    const html = emailTemplates.passwordReset({})
    expect(html).toContain("Supabase")
  })
})
