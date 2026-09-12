import { vi } from "vitest"

export const redirectCalls: string[] = []

export const mockRedirect = vi.fn((url: string) => {
  redirectCalls.push(url)
  throw new Error(`REDIRECT:${url}`)
})

export function clearNavigationMocks() {
  redirectCalls.length = 0
}
