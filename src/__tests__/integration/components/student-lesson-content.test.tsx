import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
vi.mock("@/features/student/player-data", () => ({ getStudentLessonData: vi.fn() }))
vi.mock("@/components/student/youtube-lesson-player", () => ({ YouTubeLessonPlayer: ({ videoId, startTime }: { videoId: string; startTime: number }) => <div data-testid="private-video">{videoId}:{startTime}</div> }))
import { getStudentLessonData } from "@/features/student/player-data"
import StudentLessonPage from "@/app/student/lessons/[lessonId]/page"
const id = "550e8400-e29b-41d4-a716-446655440001"
async function page(type: string) {
  vi.mocked(getStudentLessonData).mockResolvedValue({ ok: true, data: { profile: { full_name: "Ali", email: "ali@example.com" }, course: { title: "Course", course_sections: [] }, lesson: { id, title: "Lesson", lesson_type: type, description: '<script>alert("unsafe")</script>\nSecond paragraph', youtube_video_id: "dQw4w9WgXcQ", lesson_resources: [{ id, title: "Handout.pdf", resource_type: "application/pdf", file_path: "secret/storage/path" }] }, progress: { progress_seconds: 120, is_completed: false } } } as never)
  return render(await StudentLessonPage({ params: Promise.resolve({ lessonId: id }) }))
}
beforeEach(() => vi.clearAllMocks())
describe("type-appropriate student lesson content", () => {
  it("renders the YouTube player and preserves resume time", async () => {
    const { container } = await page("video")
    expect(screen.getByTestId("private-video")).toHaveTextContent("dQw4w9WgXcQ:120")
    expect(container.outerHTML).not.toMatch(/youtube\.com|youtu\.be|youtube-nocookie\.com/i)
    expect(container.textContent).not.toMatch(/Share video|Copy (?:video )?link|Open on YouTube/i)
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([`/api/student/resources/${id}`, "/student/courses"])
  })
  it("renders no player or resource actions when server authorization denies access", async () => {
    vi.mocked(getStudentLessonData).mockResolvedValue({ ok: false, reason: "forbidden", message: "This lesson is not available for your account." } as never)
    render(await StudentLessonPage({ params: Promise.resolve({ lessonId: id }) }))
    expect(screen.getByRole("alert")).toHaveTextContent("not available")
    expect(screen.queryByTestId("private-video")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
  it("renders plain text safely without HTML execution or a video player", async () => {
    const { container } = await page("text")
    expect(container.querySelector("article")).toHaveTextContent('<script>alert("unsafe")</script>')
    expect(container.querySelector("script")).toBeNull()
    expect(screen.queryByTestId("private-video")).not.toBeInTheDocument()
  })
  it.each(["pdf_resource", "external_resource", "live_class"])("renders appropriate %s content and secure resource routes", async type => {
    await page(type)
    expect(screen.queryByTestId("private-video")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Download: Handout.pdf" })).toHaveAttribute("href", `/api/student/resources/${id}`)
    expect(screen.queryByText("secret/storage/path")).not.toBeInTheDocument()
    if (type === "live_class") expect(screen.getByRole("link", { name: "Live Classes" })).toHaveAttribute("href", "/student/live-classes")
  })
  it("saves non-video completion with pending and success feedback", async () => {
    const user = userEvent.setup()
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetch)
    await page("text")
    await user.click(screen.getByRole("button", { name: "Mark lesson complete" }))
    expect(await screen.findByRole("button", { name: "Lesson completed" })).toBeDisabled()
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ lessonId: id, progressSeconds: 0, completed: true })
  })
  it("provides retry feedback if completion fails", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    await page("text")
    await user.click(screen.getByRole("button", { name: "Mark lesson complete" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again")
    expect(screen.getByRole("button", { name: "Mark lesson complete" })).toBeEnabled()
  })
})

afterEach(() => vi.unstubAllGlobals())
