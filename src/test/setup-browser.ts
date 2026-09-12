import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

const matchMediaMock = () => ({
  matches: false,
  media: "",
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMediaMock,
})

afterEach(() => {
  cleanup()
})
