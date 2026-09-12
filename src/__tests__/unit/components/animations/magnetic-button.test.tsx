import { describe, it, expect } from "vitest"
import { render, screen } from "@/test/utils/render"
import { MagneticButton } from "@/components/animations/magnetic-button"

describe("MagneticButton", () => {
  it("renders as a link with correct href", () => {
    render(<MagneticButton href="/get-started">Get Started</MagneticButton>)
    const link = screen.getByRole("link", { name: "Get Started" })
    expect(link).toHaveAttribute("href", "/get-started")
  })

  it("renders children", () => {
    render(<MagneticButton href="/get-started">Get Started</MagneticButton>)
    expect(screen.getByText("Get Started")).toBeInTheDocument()
  })
})
