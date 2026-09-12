import { describe, it, expect, vi } from "vitest"

import "@/test/mocks/mux"

import { render, screen, waitFor } from "@/test/utils/render"
import userEvent from "@testing-library/user-event"
import { MuxLessonPlayer } from "@/components/student/mux-lesson-player"

describe("MuxLessonPlayer", () => {
  it("shows message when playbackId is null", () => {
    render(<MuxLessonPlayer lessonId="lesson-1" playbackId={null} title="Test Lesson" />)
    expect(screen.getByText("This lesson does not have a Mux playback ID yet.")).toBeInTheDocument()
  })

  it("shows loading state while fetching token", () => {
    render(<MuxLessonPlayer lessonId="lesson-1" playbackId="playback-1" title="Test Lesson" />)
    expect(screen.getByText("Loading secure player...")).toBeInTheDocument()
  })

  it("shows error state when token fetch fails", async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false } as Response))

    render(<MuxLessonPlayer lessonId="lesson-1" playbackId="playback-1" title="Test Lesson" />)

    await waitFor(() => {
      expect(screen.getByText("Playback is not authorized.")).toBeInTheDocument()
    })
  })

  it("renders player when token is available", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      } as Response)
    )

    render(<MuxLessonPlayer lessonId="lesson-1" playbackId="playback-1" title="Test Lesson" />)

    await waitFor(() => {
      expect(screen.getByTestId("mux-player")).toBeInTheDocument()
    })
  })

  it("fetches token with correct query params", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      } as Response)
    )
    global.fetch = mockFetch

    render(<MuxLessonPlayer lessonId="lesson-1" playbackId="playback-1" title="Test Lesson" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/mux/playback-token?lessonId=lesson-1")
    })
  })

  it("shows Mark as Complete button when token is loaded", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      } as Response)
    )

    render(<MuxLessonPlayer lessonId="lesson-1" playbackId="playback-1" title="Test Lesson" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mark as Complete" })).toBeInTheDocument()
    })
  })

  it("calls progress API when Mark as Complete is clicked", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: "test-token" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
      } as Response)

    global.fetch = mockFetch

    render(<MuxLessonPlayer lessonId="lesson-1" playbackId="playback-1" title="Test Lesson" />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mark as Complete" })).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Mark as Complete" }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/student/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: "lesson-1", progressSeconds: 0, completed: true }),
      })
    })
  })
})
