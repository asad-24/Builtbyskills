import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@/test/utils/render"
import { PublicNotice } from "@/components/public/public-ui"

describe("PublicNotice", () => {
  it("renders title and message", () => {
    render(<PublicNotice title="Heads up" message="Something to know" />)
    expect(screen.getByText("Heads up")).toBeInTheDocument()
    expect(screen.getByText("Something to know")).toBeInTheDocument()
  })
})
