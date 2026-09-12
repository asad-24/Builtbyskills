import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

describe("useReducedMotion", () => {
  it("returns false by default", () => {
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it("updates when matchMedia changes", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    window.matchMedia = mockMatchMedia

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })
})
