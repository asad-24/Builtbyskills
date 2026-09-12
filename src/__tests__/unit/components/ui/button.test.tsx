import { describe, it, expect, afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import { render, screen } from "@/test/utils/render"
import { Button } from "@/components/ui/button"
import { gsapMock } from "@/test/mocks/gsap"

describe("Button", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders with default variant", () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole("button", { name: "Click me" })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute("data-variant", "default")
    expect(button).toHaveAttribute("data-size", "default")
  })

  it("renders with outline variant", () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole("button", { name: "Outline" })
    expect(button).toHaveAttribute("data-variant", "outline")
  })

  it("renders with secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>)
    const button = screen.getByRole("button", { name: "Secondary" })
    expect(button).toHaveAttribute("data-variant", "secondary")
  })

  it("renders with ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole("button", { name: "Ghost" })
    expect(button).toHaveAttribute("data-variant", "ghost")
  })

  it("renders with destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole("button", { name: "Delete" })
    expect(button).toHaveAttribute("data-variant", "destructive")
  })

  it("renders with link variant", () => {
    render(<Button variant="link">Link</Button>)
    const button = screen.getByRole("button", { name: "Link" })
    expect(button).toHaveAttribute("data-variant", "link")
  })

  it("renders with xs size", () => {
    render(<Button size="xs">Small</Button>)
    const button = screen.getByRole("button", { name: "Small" })
    expect(button).toHaveAttribute("data-size", "xs")
  })

  it("renders with sm size", () => {
    render(<Button size="sm">Small</Button>)
    const button = screen.getByRole("button", { name: "Small" })
    expect(button).toHaveAttribute("data-size", "sm")
  })

  it("renders with lg size", () => {
    render(<Button size="lg">Large</Button>)
    const button = screen.getByRole("button", { name: "Large" })
    expect(button).toHaveAttribute("data-size", "lg")
  })

  it("renders with icon size", () => {
    render(<Button size="icon">Icon</Button>)
    const button = screen.getByRole("button", { name: "Icon" })
    expect(button).toHaveAttribute("data-size", "icon")
  })

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>)
    const button = screen.getByRole("button", { name: "Custom" })
    expect(button).toHaveClass("custom-class")
  })

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole("button", { name: "Disabled" })
    expect(button).toBeDisabled()
  })
})
