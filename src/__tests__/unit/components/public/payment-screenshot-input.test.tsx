import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@/test/utils/render"

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: vi.fn(),
      })),
    },
  })),
}))

import { PaymentScreenshotInput } from "@/components/public/payment-screenshot-input"

describe("PaymentScreenshotInput", () => {
  it("renders file input with correct accept attribute", () => {
    render(<PaymentScreenshotInput />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.accept).toBe("image/png,image/jpeg,image/webp,application/pdf")
  })

  it("renders label text", () => {
    render(<PaymentScreenshotInput />)
    expect(screen.getByText("Payment screenshot")).toBeInTheDocument()
  })
})
