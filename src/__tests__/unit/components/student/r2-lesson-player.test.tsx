import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { R2LessonPlayer } from "@/components/student/r2-lesson-player"
const lessonId = "550e8400-e29b-41d4-a716-446655440001"
const props = { lessonId, title: "Private lesson", watermark: "For Ali", startTime: 120 }
function ready() {
  const { container, unmount } = render(<R2LessonPlayer {...props} />)
  const video = container.querySelector("video")!
  Object.defineProperties(video, { duration: { value: 300, configurable: true }, readyState: { value: 1, configurable: true } })
  fireEvent.loadedMetadata(video)
  return { video, container, unmount }
}
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true })); vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe("BuiltbySkills private MP4 player", () => {
  it("deters context-menu saving and video dragging while retaining native mobile controls", () => {
    const { video } = ready()
    const band = screen.getByTestId("video-watermark")
    expect(fireEvent.contextMenu(video)).toBe(false)
    expect(fireEvent.contextMenu(band)).toBe(false)
    expect(fireEvent.contextMenu(screen.getByRole("button", { name: "Fullscreen" }))).toBe(false)
    expect(fireEvent.contextMenu(document.body)).toBe(true)
    expect(video).toHaveAttribute("controlslist", "nodownload")
    expect(video).toHaveAttribute("disablepictureinpicture")
    expect(video).toHaveAttribute("draggable", "false")
    expect(fireEvent.dragStart(video)).toBe(false)
    expect(video).toHaveAttribute("controls")
    expect(video).toHaveAttribute("playsinline")
    expect(fireEvent.touchStart(video)).toBe(true)
    expect(fireEvent.touchEnd(video)).toBe(true)
  })
  it("blocks save shortcuts only inside the player and leaves playback/navigation keys alone", () => {
    const { video } = ready()
    const fullscreen = screen.getByRole("button", { name: "Fullscreen" })
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      expect(fireEvent.keyDown(video, { key: "s", ...modifier })).toBe(false)
      expect(fireEvent.keyDown(fullscreen, { key: "S", shiftKey: true, ...modifier })).toBe(false)
      expect(fireEvent.keyDown(document.body, { key: "s", ...modifier })).toBe(true)
      expect(fireEvent.keyDown(screen.getByRole("button", { name: "Mark lesson complete" }), { key: "s", ...modifier })).toBe(true)
    }
    for (const key of [" ", "k", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "f", "Escape", "Tab", "s"]) {
      expect(fireEvent.keyDown(video, { key })).toBe(true)
    }
    expect(fireEvent.keyDown(video, { key: "s", ctrlKey: true, altKey: true })).toBe(true)
  })
  it("reloads the video after playback failure and resumes at the last saved position", async () => {
    const { video } = ready()
    const load = vi.spyOn(video, "load").mockImplementation(() => {})
    video.currentTime = 175
    fireEvent.pause(video)
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    fireEvent.error(video)
    fireEvent.click(screen.getByRole("button", { name: "Retry video" }))
    expect(load).toHaveBeenCalledOnce()
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(175)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    load.mockRestore()
  })
  it("tracks browser fullscreen changes and provides an accessible exit toggle", async () => {
    ready()
    const wrapper = screen.getByTestId("video-watermark").parentElement!
    const enter = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(wrapper, "requestFullscreen", { value: enter })
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit })
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }))
    expect(enter).toHaveBeenCalledOnce()
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: wrapper })
    fireEvent(document, new Event("fullscreenchange"))
    const button = screen.getByRole("button", { name: "Exit Fullscreen" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(button)
    expect(exit).toHaveBeenCalledOnce()
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null })
    fireEvent(document, new Event("fullscreenchange"))
    expect(screen.getByRole("button", { name: "Fullscreen" })).toHaveAttribute("aria-pressed", "false")
  })
  it("uses only the authenticated website media route with inline native controls and resume", () => {
    const { video, container } = ready()
    expect(video.currentTime).toBe(120); expect(video).toHaveAttribute("src", `/api/student/videos/${lessonId}`)
    expect(video).toHaveAttribute("playsinline"); expect(video).toHaveAttribute("controls")
    expect(container.outerHTML).not.toMatch(/youtube|r2\.dev|cloudflarestorage|X-Amz/i)
    expect(screen.getByTestId("video-watermark")).toHaveTextContent("For Ali")
    expect(fetch).not.toHaveBeenCalled()
  })
  it("clamps historical resume seconds when the replacement is shorter", () => {
    const { container } = render(<R2LessonPlayer {...props} startTime={900} initiallyCompleted />)
    const video = container.querySelector("video")!
    Object.defineProperty(video, "duration", { value: 90 })
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(89.75); expect(screen.getByRole("button", { name: "Lesson completed" })).toBeDisabled()
  })
  it("preserves the five-second sampling/15-second save threshold", async () => {
    vi.useFakeTimers()
    const { video } = ready()
    Object.defineProperty(video, "paused", { value: false })
    video.currentTime = 130
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(fetch).not.toHaveBeenCalled()
    video.currentTime = 140
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ lessonId, progressSeconds: 140, completed: false })
  })
  it("saves seeking position on pause and completes only when explicitly requested or ended", async () => {
    const { video } = ready(); video.currentTime = 200
    fireEvent.pause(video)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).completed).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Mark lesson complete" }))
    expect(await screen.findByRole("button", { name: "Lesson completed" })).toBeDisabled()
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).completed).toBe(true)
  })
  it("keeps ended completion sticky for subsequent saves", async () => {
    const { video } = ready(); video.currentTime = 300
    fireEvent.ended(video)
    await screen.findByRole("button", { name: "Lesson completed" })
    fireEvent.pause(video)
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(vi.mocked(fetch).mock.calls.every(call => JSON.parse(call[1]!.body as string).completed)).toBe(true)
  })
  it("offers retry without claiming completion when saving fails", async () => {
    ready(); vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
    fireEvent.click(screen.getByRole("button", { name: "Mark lesson complete" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("save your progress")
    expect(screen.queryByRole("button", { name: "Lesson completed" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry saving progress" }))
    expect(await screen.findByRole("button", { name: "Lesson completed" })).toBeDisabled()
  })
  it("requests fullscreen for the wrapper containing the watermark", async () => {
    ready(); const wrapper = screen.getByTestId("video-watermark").parentElement!
    const fullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(wrapper, "requestFullscreen", { value: fullscreen })
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }))
    expect(fullscreen).toHaveBeenCalled()
  })
  it("surfaces playback failure without source links", () => {
    const { video } = ready(); fireEvent.error(video)
    expect(screen.getByRole("alert")).toHaveTextContent("cannot play")
    expect(screen.getByRole("button", { name: "Retry video" })).toBeEnabled()
  })
  it("cleans up sampling timers on navigation", async () => {
    vi.useFakeTimers(); const { unmount } = ready()
    unmount(); await act(async () => {})
    expect(vi.getTimerCount()).toBe(0)
  })
})
