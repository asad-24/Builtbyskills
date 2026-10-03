import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LessonVideoPreview } from "@/components/admin/lesson-video-preview"
describe("admin video preview", () => {
  it("opens native playback on demand and refreshes access while keeping position", () => {
    const { container } = render(<LessonVideoPreview lessonId="lesson" uploadId="upload" />)
    expect(container.querySelector("video")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Preview video" }))
    const video = container.querySelector("video")!
    expect(video).toHaveAttribute("controls")
    expect(video).toHaveAttribute("playsinline")
    expect(video.getAttribute("src")).toBe("/api/admin/lesson-videos/preview?lessonId=lesson&uploadId=upload")
    video.currentTime = 42; fireEvent.timeUpdate(video)
    fireEvent.error(video)
    expect(screen.getByRole("alert")).toHaveTextContent("cannot play")
    const load = vi.spyOn(video, "load").mockImplementation(() => {})
    fireEvent.click(screen.getByRole("button", { name: "Refresh preview access" }))
    expect(load).toHaveBeenCalledOnce()
    Object.defineProperty(video, "duration", { value: 100 })
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(42)
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
