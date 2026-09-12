import { describe, it, expect } from "vitest"

import "@/test/mocks/next-link"

import { render, screen } from "@/test/utils/render"
import { PublicPageShell, PublicHeader } from "@/components/public/site-shell"

describe("PublicHeader", () => {
  it("renders logo and navigation links", () => {
    render(<PublicHeader />)
    expect(screen.getByRole("link", { name: /builtbyskills/i })).toBeInTheDocument()
  })

  it("renders CTA button", () => {
    render(<PublicHeader />)
    expect(screen.getByRole("link", { name: /join now/i })).toBeInTheDocument()
  })
})

describe("PublicPageShell", () => {
  it("renders header, children, and footer", () => {
    render(
      <PublicPageShell>
        <main>Page content</main>
      </PublicPageShell>
    )
    expect(screen.getByText("Page content")).toBeInTheDocument()
  })
})
