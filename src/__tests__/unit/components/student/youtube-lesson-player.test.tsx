import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { YouTubeLessonPlayer } from "@/components/student/youtube-lesson-player"
import { VideoWatermark } from "@/components/student/video-watermark"
import { loadYouTubePlayerApi, type YouTubePlayerOptions } from "@/lib/lessons/youtube-player-api"
vi.mock("@/lib/lessons/youtube-player-api", () => ({ loadYouTubePlayerApi: vi.fn() }))
let options: YouTubePlayerOptions
let seconds: number
const destroy = vi.fn()
const fetchMock = vi.fn()
const fakePlayer = {
  getCurrentTime: () => seconds, getDuration: () => 300, getPlayerState: () => 1,
  seekTo: vi.fn(), destroy, getIframe: () => document.querySelector("iframe")!,
}
const props = { lessonId: "lesson", videoId: "dQw4w9WgXcQ", title: "Training video", watermark: "For Ali", startTime: 120 }
async function mount() {
  const view = render(<YouTubeLessonPlayer {...props} />)
  await act(async () => {})
  return view
}
async function ready() { await act(async () => options.events.onReady({ target: fakePlayer })) }
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  seconds = 120
  fetchMock.mockResolvedValue({ ok: true })
  vi.stubGlobal("fetch", fetchMock)
  vi.mocked(loadYouTubePlayerApi).mockResolvedValue({ Player: class {
    constructor(element: HTMLElement, configuration: YouTubePlayerOptions) {
      options = configuration
      const iframe = document.createElement("iframe")
      iframe.src = `https://www.youtube.com/embed/${configuration.videoId}`
      element.replaceWith(iframe)
      return fakePlayer
    }
  } } as never)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe("embedded YouTube lesson player", () => {
  it("embeds with resume position, inline mobile playback, and personal watermark", async () => {
    const { container } = await mount()
    await ready()
    expect(options.videoId).toBe(props.videoId)
    expect(options.playerVars).toEqual({ start: 120, playsinline: 1, rel: 0, iv_load_policy: 3, controls: 1, disablekb: 0, fs: 1, origin: window.location.origin })
    expect(screen.getByTitle("Training video")).toBeInTheDocument()
    expect(screen.getByTestId("video-watermark")).toHaveTextContent("For Ali")
    expect(container.textContent).not.toMatch(/https:|Copy link|Open on YouTube|Share/)
    expect(container.querySelector('a[href*="youtube"]')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("keeps source URLs inside the iframe and exposes only lesson completion actions", async () => {
    const { container } = await mount(); await ready()
    const surroundingUi = container.cloneNode(true) as HTMLElement
    surroundingUi.querySelectorAll("iframe").forEach(iframe => iframe.remove())
    expect(surroundingUi.outerHTML).not.toMatch(/youtube\.com|youtu\.be|youtube-nocookie\.com/i)
    expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["Mark lesson complete"])
    expect(options.playerVars).not.toHaveProperty("modestbranding")
    expect(options.playerVars).not.toHaveProperty("showinfo")
  })
  it("retains a fluid player viewport and a separate watermark band", async () => {
    await mount(); await ready()
    const iframe = screen.getByTitle("Training video")
    const viewport = iframe.parentElement!
    expect(options.width).toBe("100%")
    expect(options.height).toBe("100%")
    expect(viewport).toHaveClass("aspect-video", "min-h-[200px]", "w-full")
    expect(iframe).toHaveClass("h-full", "w-full")
    const band = screen.getByTestId("video-watermark")
    expect(band.parentElement).toBe(viewport.parentElement)
    expect(band.nextElementSibling).toBe(viewport)
    expect(viewport).not.toContainElement(band)
  })
  it("gracefully handles legacy video records without calling retired APIs", async () => {
    render(<YouTubeLessonPlayer {...props} videoId={null} />)
    expect(screen.getByText(/video is not available yet/)).toBeVisible()
    expect(loadYouTubePlayerApi).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("reports periodic progress using the existing endpoint and actual duration", async () => {
    await mount(); await ready()
    seconds = 150
    await act(async () => vi.advanceTimersByTime(5000))
    expect(fetchMock).toHaveBeenCalledWith("/api/student/progress", expect.objectContaining({ body: JSON.stringify({ lessonId: "lesson", progressSeconds: 150, completed: false, durationSeconds: 300 }) }))
    expect(screen.getByRole("button", { name: "Mark lesson complete" })).toBeEnabled()
  })
  it("saves pause position and marks completed only on explicit completion or ended", async () => {
    await mount(); await ready()
    seconds = 133
    await act(async () => options.events.onStateChange({ data: 2, target: fakePlayer }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).completed).toBe(false)
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark lesson complete" })))
    expect(screen.getByRole("button", { name: "Lesson completed" })).toBeDisabled()
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ lessonId: "lesson", progressSeconds: 133, completed: true, durationSeconds: 300 })
  })
  it("completes at the end and subsequent ticks do not undo completion", async () => {
    await mount(); await ready()
    seconds = 300
    await act(async () => options.events.onStateChange({ data: 0, target: fakePlayer }))
    expect(screen.getByRole("button", { name: "Lesson completed" })).toBeDisabled()
    seconds = 320
    await act(async () => vi.advanceTimersByTime(5000))
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).completed).toBe(true)
  })
  it("preserves an existing completed record", async () => {
    render(<YouTubeLessonPlayer {...props} initiallyCompleted />)
    await act(async () => {}); await ready()
    expect(screen.getByRole("button", { name: "Lesson completed" })).toBeDisabled()
    seconds = 150
    await act(async () => vi.advanceTimersByTime(5000))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).completed).toBe(true)
  })
  it("surfaces save failures and permits explicit completion retry", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true })
    await mount(); await ready()
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark lesson complete" })))
    expect(screen.getByRole("alert")).toHaveTextContent("could not save your progress")
    expect(screen.getByRole("button", { name: "Mark lesson complete" })).toBeEnabled()
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark lesson complete" })))
    expect(screen.getByRole("button", { name: "Lesson completed" })).toBeDisabled()
  })
  it("does not claim completion from an earlier in-flight progress save", async () => {
    let resolveProgress!: (response: { ok: boolean }) => void
    fetchMock.mockReturnValueOnce(new Promise(resolve => { resolveProgress = resolve }))
      .mockResolvedValueOnce({ ok: false })
    await mount(); await ready()
    seconds = 150
    await act(async () => vi.advanceTimersByTime(5000))
    act(() => fireEvent.click(screen.getByRole("button", { name: "Mark lesson complete" })))
    await act(async () => resolveProgress({ ok: true }))
    expect(screen.queryByRole("button", { name: "Lesson completed" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mark lesson complete" })).toBeEnabled()
    expect(screen.getByRole("alert")).toHaveTextContent("could not save your progress")
  })
  it("handles unavailable or embedding-disabled videos without exposing technical errors", async () => {
    await mount()
    act(() => options.events.onError({ data: 150 }))
    expect(screen.getByRole("alert")).toHaveTextContent("cannot be played here")
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled()
  })
  it("cleans up player and progress timers on navigation", async () => {
    const view = await mount(); await ready()
    view.unmount()
    expect(destroy).toHaveBeenCalledOnce()
    await act(async () => vi.advanceTimersByTime(60000))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
describe("personal watermark", () => {
  it("moves within its own band without obscuring the player", () => {
    render(<VideoWatermark label="For Ali" />)
    const band = screen.getByTestId("video-watermark")
    expect(band).toHaveAttribute("data-position", "left")
    act(() => vi.advanceTimersByTime(30000))
    expect(band).toHaveAttribute("data-position", "right")
    act(() => vi.advanceTimersByTime(30000))
    expect(band).toHaveAttribute("data-position", "left")
  })
  it("stays static for reduced-motion users", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as never)
    render(<VideoWatermark label="For Ali" />)
    act(() => vi.advanceTimersByTime(90000))
    expect(screen.getByTestId("video-watermark")).toHaveAttribute("data-position", "left")
    vi.restoreAllMocks()
  })
  it("responds to reduced-motion changes and cleans up its listener and timer", () => {
    const query = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.spyOn(window, "matchMedia").mockReturnValue(query as never)
    const view = render(<VideoWatermark label="For Ali" />)
    const band = screen.getByTestId("video-watermark")
    const update = query.addEventListener.mock.calls[0][1]
    act(() => vi.advanceTimersByTime(30000))
    expect(band).toHaveAttribute("data-position", "right")
    query.matches = true
    act(() => { update(); vi.advanceTimersByTime(60000) })
    expect(band).toHaveAttribute("data-position", "left")
    query.matches = false
    act(() => { update(); vi.advanceTimersByTime(30000) })
    expect(band).toHaveAttribute("data-position", "right")
    view.unmount()
    expect(query.removeEventListener).toHaveBeenCalledWith("change", update)
    expect(vi.getTimerCount()).toBe(0)
    vi.restoreAllMocks()
  })
})
