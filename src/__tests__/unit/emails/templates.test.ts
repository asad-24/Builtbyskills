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

describe("template escaping", () => {
  it.each(["enrollmentReceived", "paymentApproved", "paymentRejected", "accountActivation"] as const)("escapes dynamic text in %s", (template) => {
    const value = '<img src=x onerror="bad"> & \'text\''
    const html = emailTemplates[template]({ name: value, courseTitle: value, reason: value })
    expect(html).not.toContain(value)
    expect(html).toContain("&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; &#39;text&#39;")
  })
  it("preserves the decoded recovery URL while escaping attribute delimiters", () => {
    const url = 'https://auth.example/verify?token=abc&type=recovery&redirect_to=https%3A%2F%2Fexample.com%2Fauth%2Fcallback'
    const html = emailTemplates.accountActivation({ actionUrl: url })
    const doc = new DOMParser().parseFromString(html, "text/html")
    expect(doc.querySelector("a")?.getAttribute("href")).toBe(url)
    expect(html).toContain("&amp;type=recovery")
  })
})
