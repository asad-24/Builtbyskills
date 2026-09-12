import { describe, it, expect, vi } from "vitest"

vi.mock("@/actions/public", () => ({
  submitContactAction: vi.fn(),
}))

import { render, screen } from "@/test/utils/render"
import ContactPage from "@/app/contact/page"

describe("ContactPage", () => {
  it("renders contact form with all fields", () => {
    render(<ContactPage />)
    expect(screen.getByRole("heading", { name: "Contact Builtbyskills" })).toBeInTheDocument()
    expect(screen.getByLabelText("Full name")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Phone")).toBeInTheDocument()
    expect(screen.getByLabelText("Subject")).toBeInTheDocument()
    expect(screen.getByLabelText("Message")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument()
  })
})
