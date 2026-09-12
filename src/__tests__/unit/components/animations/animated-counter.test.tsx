import { describe, it, expect, vi } from "vitest"

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: vi.fn(() => true),
}))

import { render, screen } from "@/test/utils/render"
import { AnimatedCounter } from "@/components/animations/animated-counter"

describe("AnimatedCounter", () => {
  it("renders target value", () => {
    render(<AnimatedCounter value={100} />)
    expect(screen.getByText("100")).toBeInTheDocument()
  })

  it("renders prefix and suffix", () => {
    render(<AnimatedCounter value={50} suffix="+" />)
    expect(screen.getByText("50+")).toBeInTheDocument()
  })
})
