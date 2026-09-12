import { describe, it, expect, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useIsMobile } from "@/hooks/use-is-mobile"

describe("useIsMobile", () => {
  it("returns false by default", () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it("returns true when viewport matches mobile breakpoint", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    window.matchMedia = mockMatchMedia

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("uses custom breakpoint", () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    window.matchMedia = mockMatchMedia

    renderHook(() => useIsMobile(1024))
    expect(mockMatchMedia).toHaveBeenCalledWith("(max-width: 1023px)")
  })
})
