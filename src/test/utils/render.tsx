import { render as rtlRender, screen, waitFor, cleanup } from "@testing-library/react"

export { render as rtlRender, screen, waitFor, cleanup }

export function render(ui: React.ReactElement) {
  cleanup()
  return rtlRender(ui)
}
