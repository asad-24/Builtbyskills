import { vi } from "vitest"

const gsapMock = {
  registerPlugin: vi.fn(),
  to: vi.fn(() => gsapMock),
  fromTo: vi.fn(() => gsapMock),
  timeline: vi.fn(() => ({
    to: vi.fn(() => gsapMock),
    fromTo: vi.fn(() => gsapMock),
    set: vi.fn(() => gsapMock),
    play: vi.fn(() => gsapMock),
    pause: vi.fn(() => gsapMock),
    kill: vi.fn(),
  })),
  context: vi.fn(() => ({
    add: vi.fn(),
    kill: vi.fn(),
  })),
  utils: {
    toArray: vi.fn(() => []),
  },
  set: vi.fn(() => gsapMock),
}

vi.mock("gsap", () => gsapMock)

vi.mock("gsap/ScrollTrigger", () => ({
  default: {
    registerPlugin: vi.fn(),
    create: vi.fn(() => ({
      kill: vi.fn(),
      refresh: vi.fn(),
      update: vi.fn(),
    })),
    getById: vi.fn(),
    getAll: vi.fn(),
    killAll: vi.fn(),
    refreshAll: vi.fn(),
    revertAll: vi.fn(),
  },
}))

export { gsapMock }
